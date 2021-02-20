import {wallet, flow, chain} from './wallet';
import {Wallet} from '@ethersproject/wallet';
import type {Contract} from '@ethersproject/contracts';
import {keccak256} from '@ethersproject/solidity';
import {xyToLocation} from '../common/src';
import type {OwnFleet} from '../common/src/types';
import {BigNumber} from '@ethersproject/bignumber';
import {finality} from '../config';
import aes from 'aes-js';
import {
  base64,
  compressToUint8Array,
  decompressFromUint8Array,
} from '../lib/utils';
import localCache from '../lib/utils/localCache';
import {VERSION, params} from '../init';

const SYNC_URI = params.sync || import.meta.env.SNOWPACK_PUBLIC_SYNC_URI;
const DB_NAME = 'conquest-v' + VERSION;

const LOCAL_ONLY_STORAGE = '_local_only_';
function LOCAL_ONLY_STORAGE_KEY(address: string, chainId: string) {
  return `${LOCAL_ONLY_STORAGE}_${address.toLowerCase()}_${chainId}`;
}

const LOCAL_STORAGE_PRIVATE_ACCOUNT = '_privateAccount';
function LOCAL_STORAGE_KEY(address: string, chainId: string) {
  return `${LOCAL_STORAGE_PRIVATE_ACCOUNT}_${address.toLowerCase()}_${chainId}`;
}

type SyncStatus = 'SYNCING' | 'SYNCED';

type OnSyncStatusUpdate = (status: SyncStatus) => void;

export class Synced {
  private _lastId = 0;
  private _syncEnabled = false;
  constructor(private _func: OnSyncStatusUpdate) {}

  load(
    address: string,
    chainId: string,
    syncEnabled: boolean,
    onData: (data: any) => void
  ): void {
    this._syncEnabled = syncEnabled;
    // TODO load from signature based DB
    const fromStorage = localCache.getItem(LOCAL_STORAGE_KEY(address, chainId));
    let data = {fleets: {}, exits: {}, captures: {}};
    if (fromStorage) {
      try {
        const decrypted = this.decrypt(fromStorage);
        data = JSON.parse(decrypted);
      } catch (e) {
        console.error(e);
      }
    }
    onData(data);
    this._syncDown().then((result) => {
      if (result && result.newDataOnLocal) {
        // TODO flag to ensure syncing up when first checks
      }
    });
  }

  private async _syncRequest(
    method: string,
    params: string[]
  ): Promise<Response> {
    return await fetch(SYNC_URI, {
      // TODO env variable
      method: 'POST',
      body: JSON.stringify({
        method,
        params,
        jsonrpc: '2.0',
        id: ++this._lastId,
      }),
      headers: {
        'Content-type': 'application/json; charset=UTF-8',
      },
    });
  }

  private async _syncDown(): Promise<
    | {newDataOnLocal: boolean; newDataOnRemote: boolean; counter: BigNumber}
    | undefined
  > {
    if (!this._syncEnabled) {
      return;
    }
    this._func('SYNCING');
    let json;
    let error;
    try {
      if (!this.address) {
        throw new Error(`no address`);
      }
      const response = await this._syncRequest('wallet_getString', [
        this.address,
        DB_NAME,
      ]);
      json = await response.json();
      if (json.error) {
        throw new Error(json.error);
      }
    } catch (e) {
      error = e;
    }
    if (error || json.error) {
      this._func('NOT_SYNCED', syncError: error || json.error);
      return; // TODO retry ?
    }
    let data: SecretData = {fleets: {}, exits: {}, captures: {}};
    if (json.result.data && json.result.data !== '') {
      try {
        const decryptedData = this.decrypt(json.result.data);
        data = JSON.parse(decryptedData);
      } catch (e) {
        console.error(e);
      }
    }
    const {newDataOnLocal, newDataOnRemote} = this._merge(data);

    if (!this.$store.walletAddress) {
      throw new Error(`no this.$store.walletAddress`);
    }
    if (!this.$store.chainId) {
      throw new Error(`no this.$store.chainId`);
    }
    if (!this.$store.data) {
      throw new Error(`no this.$store.data`);
    }
    this.setPartial({data: this.$store.data});
    this._saveToLocalStorage(
      this.$store.walletAddress,
      this.$store.chainId,
      this.$store.data
    );

    if (!newDataOnLocal) {
      this.setPartial({sync: 'SYNCED'});
    } else {
      // do not sync up as we will do that latter as part of the usual fleet checks
    }
    return {
      newDataOnLocal,
      newDataOnRemote,
      counter: BigNumber.from(json.result.counter),
    };
  }

  _merge(
    data: SecretData
  ): {newDataOnLocal: boolean; newDataOnRemote: boolean} {
    if (!this.$store.data) {
      this.$store.data = {fleets: {}, exits: {}, captures: {}};
    }
    if (!this.$store.data.fleets) {
      this.$store.data.fleets = {};
    }
    let newDataOnLocal = false;
    let newDataOnRemote = false;
    const localFleets = this.$store.data.fleets;
    const remoteFleets = data.fleets;
    if (remoteFleets) {
      for (const key of Object.keys(remoteFleets)) {
        if (!localFleets[key]) {
          newDataOnRemote = true;
          localFleets[key] = remoteFleets[key]; // new
        } else {
          const localFleet = localFleets[key];
          const remoteFleet = remoteFleets[key];
          if (
            localFleet.to.x !== remoteFleet.to.x ||
            localFleet.to.y !== remoteFleet.to.y
          ) {
            console.error('fleet with different destination but same id');
          }
          if (localFleet.resolveTxHash) {
            if (remoteFleet.resolveTxHash) {
              // if (localFleet.resolveTxHash != remoteFleet.resolveTxHash) {
              // }
            } else {
              newDataOnLocal = true;
            }
          } else {
            if (remoteFleet.resolveTxHash) {
              newDataOnRemote = true;
              localFleet.resolveTxHash = remoteFleet.resolveTxHash;
            }
          }
          if (localFleet.sendTxHash) {
            if (remoteFleet.sendTxHash) {
              // if (localFleet.sendTxHash != remoteFleet.sendTxHash) {
              // }
            } else {
              newDataOnLocal = true;
            }
          } else {
            if (remoteFleet.sendTxHash) {
              newDataOnRemote = true;
              localFleet.sendTxHash = remoteFleet.sendTxHash;
            }
          }
        }
      }
    }
    for (const key of Object.keys(localFleets)) {
      if (!remoteFleets[key]) {
        newDataOnLocal = true;
      }
    }
    this.set(this.$store);
    return {newDataOnLocal, newDataOnRemote};
  }

  encrypt(data: string): string {
    if (!this.$store || !this.$store.aesKey) {
      throw new Error('no aes key set');
    }
    const textBytes = compressToUint8Array(data); // const textBytes = aes.utils.utf8.toBytes(data);
    const ctr = new aes.ModeOfOperation.ctr(this.$store.aesKey);
    const encryptedBytes = ctr.encrypt(textBytes);
    return base64.bytesToBase64(encryptedBytes);
  }

  decrypt(data: string): string {
    if (!this.$store || !this.$store.aesKey) {
      throw new Error('no aes key set');
    }
    const encryptedBytes = base64.base64ToBytes(data);
    const ctr = new aes.ModeOfOperation.ctr(this.$store.aesKey);
    const decryptedBytes = ctr.decrypt(encryptedBytes);
    return decompressFromUint8Array(decryptedBytes) || ''; // return aes.utils.utf8.fromBytes(decryptedBytes);
  }

  async _sync(
    fleetsToDelete: string[] = [],
    exitsToDelete: string[] = [],
    capturesToDelete: string[] = []
  ) {
    if (!this.$store.syncEnabled) {
      return;
    }
    const syncDownResult = await this._syncDown();

    if (
      syncDownResult &&
      (syncDownResult.newDataOnLocal ||
        fleetsToDelete.length > 0 ||
        exitsToDelete.length > 0 ||
        capturesToDelete.length > 0)
    ) {
      this.setPartial({sync: 'SYNCING'});

      if (!this.$store.data) {
        throw new Error(`no this.$store.data`);
      }
      if (!this.$store.wallet) {
        throw new Error(`no this.$store.wallet`);
      }

      for (const fleetToDelete of fleetsToDelete) {
        delete this.$store.data.fleets[fleetToDelete];
      }
      for (const exitToDelete of exitsToDelete) {
        delete this.$store.data.exits[exitToDelete];
      }
      for (const captureToDelete of capturesToDelete) {
        delete this.$store.data.captures[captureToDelete];
      }
      this.set(this.$store);

      const dataToEncrypt = JSON.stringify(this.$store.data); // TODO compression + encryption

      const data = this.encrypt(dataToEncrypt);

      const counter = syncDownResult.counter.add(1).toString();
      const signature = await this.$store.wallet.signMessage(
        'put:' + DB_NAME + ':' + counter + ':' + data
      );

      let json;
      let error;
      try {
        const response = await this.syncRequest('wallet_putString', [
          this.$store.wallet.address,
          DB_NAME,
          counter,
          data,
          signature,
        ]);
        json = await response.json();
        if (json.error) {
          throw new Error(json.error);
        }
      } catch (e) {
        error = e;
      }
      if (error || json.error) {
        this.setPartial({sync: 'NOT_SYNCED', syncError: error || json.error});
        return; // TODO retry ?
      }
      if (!json.success) {
        this.setPartial({sync: 'NOT_SYNCED', syncError: 'no success'});
        return; // TODO retry ?
      }

      this.setPartial({sync: 'SYNCED'});
    }
  }

  _saveToLocalStorage(address: string, chainId: string, data?: SecretData) {
    if (!data) {
      return; // TODO ?
    }
    const toStorage = JSON.stringify(data);
    const encrypted = this.encrypt(toStorage);
    localCache.setItem(LOCAL_STORAGE_KEY(address, chainId), encrypted);
  }

  async _setData(
    address: string,
    chainId: string,
    data: SecretData,
    fleetIdsToDelete: string[] = [],
    exitsToDelete: string[] = [],
    capturesToDelete: string[] = []
  ) {
    this._saveToLocalStorage(address, chainId, data);
    this._sync(fleetIdsToDelete, exitsToDelete, capturesToDelete); // TODO fetch before set local storage to avoid aother encryption roundtrip
  }

  async clearData(): Promise<void> {
    const syncDownResult = await this._syncDown();
    if (!syncDownResult) {
      throw new Error(`failed to sync down`);
    }
    if (!wallet.address || !wallet.chain.chainId) {
      console.log(` no: ${wallet.address}, ${wallet.chain.chainId}`);
      return;
    }
    if (!this.$store.wallet) {
      throw new Error(`no this.$store.wallet`);
    }
    const key = LOCAL_STORAGE_KEY(wallet.address, wallet.chain.chainId);
    localCache.removeItem(key);
    const data = '';
    const counter = syncDownResult.counter.add(1).toString();
    const signature = await this.$store.wallet.signMessage(
      'put:' + DB_NAME + ':' + counter + ':' + data
    );
    await this.syncRequest('wallet_putString', [
      this.$store.wallet.address,
      DB_NAME,
      counter,
      data,
      signature,
    ]);
  }
}
