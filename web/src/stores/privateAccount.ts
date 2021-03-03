import {wallet, flow, chain} from './wallet';
import {Wallet} from '@ethersproject/wallet';
import type {Contract} from '@ethersproject/contracts';
import {keccak256} from '@ethersproject/solidity';
import {xyToLocation} from '../common/src';
import type {OwnFleet, TxStatus} from '../common/src/types';
import {BigNumber} from '@ethersproject/bignumber';
import {finality, blockTime} from '../config';
import aes from 'aes-js';
import {
  base64,
  compressToUint8Array,
  decompressFromUint8Array,
} from '../lib/utils';
import localCache from '../lib/utils/localCache';
import {VERSION, params} from '../init';

import contractsInfo from '../contracts.json';
import {BaseStoreWithData} from '../lib/utils/stores';

type Capture = {
  txHash: string;
  nonce: number;
  time: number;
};

type Withdrawal = {
  txHash: string;
  nonce: number;
};

type LocalData = {
  signature?: string;
  syncRemotely: boolean;
};

type SecretData = {
  fleets: Record<string, OwnFleet>;
  exits: Record<string, number>;
  captures: Record<string, Capture>;
  lastWithdrawal?: Withdrawal;
  welcomingStep?: number;
};

type PrivateAccountData = {
  wallet?: Wallet;
  aesKey?: Uint8Array;
  step:
    | 'READY'
    | 'CONNECTING'
    | 'SIGNATURE_REQUIRED'
    | 'SIGNATURE_REQUESTED'
    | 'LOADING'
    | 'IDLE';
  data: SecretData | undefined;
  syncEnabled: boolean;
  sync: 'IDLE' | 'SYNCING' | 'SYNCED' | 'NOT_SYNCED';
  syncError: unknown;
  walletAddress?: string;
  chainId?: string;
  txStatuses: {[txHash: string]: TxStatus};
};

type Contracts = {
  [name: string]: Contract;
};

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

class PrivateAccountStore extends BaseStoreWithData<
  PrivateAccountData,
  SecretData
> {
  private monitorProcess: NodeJS.Timeout | undefined = undefined;
  private _lastId = 0;
  private walletData: Record<string, {wallet: Wallet; aesKey: Uint8Array}> = {};

  private _promise: Promise<void> | undefined;
  private _resolve: (() => void) | undefined;
  private _reject: ((error: unknown) => void) | undefined;
  private _func: (() => Promise<void>) | undefined;
  private _contracts: Contracts | undefined;

  constructor() {
    super({
      wallet: undefined,
      aesKey: undefined,
      step: 'IDLE',
      data: undefined,
      sync: 'IDLE',
      syncEnabled: false,
      syncError: undefined,
      txStatuses: {},
    });

    // THIS sill trigger on all hmr reload what to do ?
    chain.subscribe(($chain) => {
      if ($chain.state === 'Ready') {
        this.start(this.$store.walletAddress, $chain.chainId);
      } else {
        this.setPartial({wallet: undefined, aesKey: undefined});
        if (this.$store.step === 'READY') {
          this.setPartial({step: 'IDLE', chainId: undefined, data: undefined});
        }
        this.stopMonitoring();
      }
    });

    wallet.subscribe(($wallet) => {
      if ($wallet.address) {
        this.start($wallet.address, this.$store.chainId);
      } else {
        this.setPartial({wallet: undefined, aesKey: undefined});
        if (this.$store.step === 'READY') {
          this.setPartial({
            step: 'IDLE',
            walletAddress: undefined,
            data: undefined,
          });
        }
        this.stopMonitoring();
      }
    });
  }

  async _loadData(address: string, chainId: string) {
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
    this.setPartial({data, txStatuses: {}});
    this._syncDown().then((result) => {
      if (result && result.newDataOnLocal) {
        // TODO flag to ensure syncing up when first checks
      }
    });
    this.startMonitoring(address, chainId);
  }

  async syncRequest(method: string, params: string[]): Promise<Response> {
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

  async _syncDown(
    fleetsToDelete: string[] = [],
    exitsToDelete: string[] = [],
    capturesToDelete: string[] = []
  ): Promise<
    | {newDataOnLocal: boolean; newDataOnRemote: boolean; counter: BigNumber}
    | undefined
  > {
    if (!this.$store.syncEnabled) {
      return;
    }
    this.setPartial({sync: 'SYNCING'});
    let json;
    let error;
    try {
      if (!this.$store.wallet) {
        throw new Error(`no this.$store.wallet`);
      }
      const response = await this.syncRequest('wallet_getString', [
        this.$store.wallet.address,
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
      console.error('syncDown', error || json.error);
      this.setPartial({sync: 'NOT_SYNCED', syncError: error || json.error});
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

    // console.log('remote data', data);

    for (const fleetToDelete of fleetsToDelete) {
      delete data.fleets[fleetToDelete];
    }
    for (const exitToDelete of exitsToDelete) {
      delete data.exits[exitToDelete];
    }
    for (const captureToDelete of capturesToDelete) {
      delete data.captures[captureToDelete];
    }

    const {newDataOnLocal, newDataOnRemote} = this._merge(data);

    // console.log('post merge data', this.$store.data);

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

    const localCaptures = this.$store.data.captures;
    const remoteCaptures = data.captures;
    if (remoteCaptures) {
      for (const key of Object.keys(remoteCaptures)) {
        if (!localCaptures[key]) {
          newDataOnRemote = true;
          localCaptures[key] = remoteCaptures[key]; // new
        } else {
          const localCapture = localCaptures[key];
          const remoteCapture = remoteCaptures[key];
          if (localCapture.txHash != remoteCapture.txHash) {
            // skip, local take precedence, TODO deal differently
          } else {
          }
        }
      }
    }
    for (const key of Object.keys(localCaptures)) {
      if (!remoteCaptures[key]) {
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
    // console.log('syncing...');
    const syncDownResult = await this._syncDown(
      fleetsToDelete,
      exitsToDelete,
      capturesToDelete
    );

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
        console.error(error || json.error);
        this.setPartial({sync: 'NOT_SYNCED', syncError: error || json.error});
        return; // TODO retry ?
      }
      if (!json.result || !json.result.success) {
        console.error('sync no success', json);
        this.setPartial({sync: 'NOT_SYNCED', syncError: 'no success'});
        return; // TODO retry ?
      } else {
        // console.log('synced!');
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
    // console.log('_setData', data);
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

  async start(walletAddress?: string, chainId?: string): Promise<void> {
    // console.log("START", {walletAddress, chainId});
    const walletDiff =
      !this.$store.walletAddress ||
      walletAddress?.toLowerCase() !== this.$store.walletAddress.toLowerCase();
    const chainDiff = !this.$store.chainId || chainId !== this.$store.chainId;

    if (chainId && walletAddress) {
      // console.log("READY");

      let storage: LocalData = {
        syncRemotely: true,
      };
      const fromStorage = localCache.getItem(
        LOCAL_ONLY_STORAGE_KEY(walletAddress, chainId)
      );
      if (fromStorage) {
        try {
          storage = JSON.parse(fromStorage);
        } catch (e) {
          console.error(e);
        }
        if (storage) {
          const signature = storage.signature;
          if (signature) {
            const {privateWallet, aesKey} = await this.generateKeys(signature);
            this.walletData[walletAddress.toLowerCase()] = {
              wallet: privateWallet,
              aesKey,
            };
          }
        }
      }

      const existingData = this.walletData[walletAddress.toLowerCase()];
      if (existingData) {
        this.setPartial({
          step: 'READY', // TODO why READY ?
          wallet: existingData.wallet,
          aesKey: existingData.aesKey,
          syncEnabled: storage.syncRemotely,
          walletAddress,
          chainId,
        });
        this._resolve && this._resolve();
        this._resolve = undefined;
        this._reject = undefined;
        this._promise = undefined;
        this._contracts = undefined;
      } else {
        this.setPartial({
          wallet: undefined,
          aesKey: undefined,
          walletAddress,
          chainId,
          data: undefined,
        });
        if (this.$store.step === 'READY') {
          this.setPartial({step: 'IDLE'});
        }
      }
      if (walletDiff || chainDiff) {
        // console.log({walletDiff, chainDiff});
        if (this.$store.walletAddress && this.$store.chainId && existingData) {
          this.setPartial({
            wallet: existingData.wallet,
            aesKey: existingData.aesKey,
            walletAddress,
            chainId,
            data: undefined,
          });
          // console.log('loading data');
          this._loadData(this.$store.walletAddress, this.$store.chainId);
        }
      }
    } else {
      // console.log("STOP");
      this.setPartial({walletAddress, chainId});
      this.stopMonitoring();
    }
  }

  stopMonitoring() {
    if (this.monitorProcess !== undefined) {
      clearInterval(this.monitorProcess);
      this.monitorProcess = undefined;
    }
  }

  startMonitoring(address: string, chainId: string) {
    this.stopMonitoring();
    this.checking(address, chainId);
    this.monitorProcess = setInterval(
      () => this.checking(address, chainId),
      5000
    ); // TODO time config
  }

  async checking(address: string, chainId: string) {
    // TODO check blockNumber and only perform if different ?
    this.listenForFleets(address, chainId);
    this.listenForExits(address, chainId);
    this.listenForCaptures(address, chainId);
  }

  async listenForExits(address: string, chainId: string): Promise<void> {
    if (!this.$store.data) {
      return;
    }
    if (!wallet.provider) {
      throw new Error(`no wallet.provider`);
    }
    const latestBlock = await wallet.provider.getBlock('latest');
    const latestBlockNumber = latestBlock.number;
    if (!this.$store.data) {
      return;
    }
    const exitIds = Object.keys(this.$store.data.exits);
    for (const exitId of exitIds) {
      const split = exitId.split('_');
      const location = split[0];
      const timestamp = parseInt(split[1]);

      if (
        latestBlock.timestamp >
        timestamp + contractsInfo.contracts.OuterSpace.linkedData.exitDuration
      ) {
        let planetData;
        try {
          planetData = await wallet.contracts?.OuterSpace.callStatic.getPlanetStates(
            [location],
            {blockTag: Math.max(0, latestBlockNumber - finality)}
          );
        } catch (e) {
          console.error(e);
        }
        if (
          !this.$store.walletAddress ||
          this.$store.walletAddress.toLowerCase() !== address.toLowerCase() ||
          this.$store.chainId !== chainId
        ) {
          return;
        }

        if (
          planetData &&
          (planetData[0].exitTime === 0 || planetData[0].owner !== address)
        ) {
          this.deleteExit(exitId);
        }
      }
    }
  }

  async listenForCaptures(address: string, chainId: string): Promise<void> {
    if (!this.$store.data) {
      return;
    }
    if (!wallet.provider) {
      throw new Error(`no wallet.provider`);
    }
    const latestBlock = await wallet.provider.getBlock('latest');
    const latestBlockNumber = latestBlock.number;
    if (!this.$store.data) {
      return;
    }
    const locations = Object.keys(this.$store.data.captures);
    for (const location of locations) {
      const capture = this.$store.data.captures[location];
      const receipt = await wallet.provider.getTransactionReceipt(
        capture.txHash
      );
      if (
        !this.$store.walletAddress ||
        this.$store.walletAddress.toLowerCase() !== address.toLowerCase() ||
        this.$store.chainId !== chainId
      ) {
        return;
      }
      if (receipt) {
        const finalized = receipt.confirmations >= finality;
        if (receipt.status !== undefined && receipt.status === 0) {
          this.$store.txStatuses[capture.txHash] = {
            finalized,
            status: 'Failure',
          };
          this.set(this.$store);
        } else {
          // TODO !receipt.status ?
          if (finalized) {
            this.deleteCapture(location);
          } else {
            this.$store.txStatuses[capture.txHash] = {
              finalized,
              status: 'Success',
            };
            this.set(this.$store);
          }
        }
      } else {
        if (!wallet.address) {
          throw new Error(`no wallet.address`);
        }
        const finalNonce = await wallet.provider.getTransactionCount(
          wallet.address,
          latestBlockNumber - finality
        );
        if (
          !this.$store.walletAddress ||
          this.$store.walletAddress.toLowerCase() !== address.toLowerCase() ||
          this.$store.chainId !== chainId
        ) {
          return;
        }
        if (finalNonce > capture.nonce) {
          // TODO check for failure ? or success through contract call ?
          this.deleteCapture(location);
        } else {
          this.$store.txStatuses[capture.txHash] = {
            finalized: false,
            status: 'Pending',
          };
          this.set(this.$store);
        }
      }
    }
  }

  // TODO use it:
  async fetchThen<T>(
    address: string,
    chainId: string,
    fetch: () => Promise<T>,
    doNext: (data: T) => Promise<void>
  ) {
    const data = await fetch();
    if (
      !this.$store.walletAddress ||
      this.$store.walletAddress.toLowerCase() !== address.toLowerCase() ||
      this.$store.chainId !== chainId
    ) {
      return;
    }
    await doNext(data);
  }

  async listenForFleets(address: string, chainId: string): Promise<void> {
    if (!this.$store.data) {
      return;
    }
    if (!wallet.provider) {
      throw new Error(`no wallet.provider`);
    }
    const latestBlock = await wallet.provider.getBlock('latest');
    const latestBlockNumber = latestBlock.number;

    const latestFinalityBlock = await wallet.provider.getBlock(
      latestBlockNumber - finality
    );
    if (!this.$store.data) {
      return;
    }
    const fleetIds = Object.keys(this.$store.data.fleets);
    for (const fleetId of fleetIds) {
      const fleet = this.$store.data.fleets[fleetId];

      // if sendTxHash has not been confirmed yet, check it (if resolveTxHash is set assume sendTxHash has been confirmed too and thus skip this)
      if (
        !fleet.resolveTxHash &&
        !fleet.actualLaunchTime &&
        !(
          this.$store.txStatuses[fleet.sendTxHash] &&
          this.$store.txStatuses[fleet.sendTxHash].finalized
        )
      ) {
        console.log(`checking fleet sending ${fleetId}...`);
        // fetch receipt for sendTx
        const receipt = await wallet.provider.getTransactionReceipt(
          fleet.sendTxHash
        );
        if (
          !this.$store.walletAddress ||
          this.$store.walletAddress.toLowerCase() !== address.toLowerCase() ||
          this.$store.chainId !== chainId
        ) {
          return;
        }
        if (receipt) {
          // if receipt then anaylyse it only if confirmed ?
          const finalized = receipt.confirmations >= finality;
          if (receipt.status !== undefined && receipt.status === 0) {
            // failure
            this.$store.txStatuses[fleet.sendTxHash] = {
              finalized,
              status: 'Failure',
            };
            this.set(this.$store);
            continue; // no point checking further, deleting will happen through acknowledgement
          } else {
            this.$store.txStatuses[fleet.sendTxHash] = {
              finalized,
              status: 'Success',
            };
            this.set(this.$store);
          }
        } else {
          // TODO check for cancelation ?

          this.$store.txStatuses[fleet.sendTxHash] = {
            finalized: false,
            status: 'Pending',
          };
          this.set(this.$store);
          // TODO keep waiting for ever ? or add mechanism to delete it?
        }
      }

      // if the fleet has not been given a final actualLaunchTime, fetch it, this will be considered as confirmaation for the sendTx too
      if (!fleet.actualLaunchTime) {
        // could use receipt above (if finalized, else wait next tick) instead of fleetData from contract and use timestamp for getting actualLaunchTime
        let fleetData;
        try {
          fleetData = await wallet.contracts?.OuterSpace.callStatic.getFleet(
            // TODO batch getFleets ?
            fleetId,
            {blockTag: Math.max(0, latestBlockNumber - finality)}
          );
        } catch (e) {
          //
        }
        if (
          !this.$store.walletAddress ||
          this.$store.walletAddress.toLowerCase() !== address.toLowerCase() ||
          this.$store.chainId !== chainId
        ) {
          return;
        }
        // use only finalised data
        if (
          fleetData.launchTime > 0 &&
          fleet.actualLaunchTime !== fleetData.launchTime
        ) {
          fleet.actualLaunchTime = fleetData.launchTime;
          this.recordFleet(fleetId, fleet);
        }
      } else {
        const launchTime = fleet.actualLaunchTime;
        const resolveWindow =
          contractsInfo.contracts.OuterSpace.linkedData.resolveWindow;
        const expiryTime = launchTime + fleet.duration + resolveWindow;

        // else (if the fleet has been confirmed to be flying) we can check the resolution
        // but let only do the check if it has a tx hash
        // else we can delete if too late
        if (fleet.resolveTxHash) {
          // skip if resolveTxHash is already finalized and recorded as such
          if (
            this.$store.txStatuses[fleet.resolveTxHash] &&
            this.$store.txStatuses[fleet.resolveTxHash].finalized
          ) {
            continue;
          }

          const receipt = await wallet.provider.getTransactionReceipt(
            fleet.resolveTxHash
          );
          if (
            !this.$store.walletAddress ||
            this.$store.walletAddress.toLowerCase() !== address.toLowerCase() ||
            this.$store.chainId !== chainId
          ) {
            return;
          }

          if (receipt) {
            const finalized = receipt.confirmations >= finality;
            if (receipt.status !== undefined && receipt.status === 0) {
              this.$store.txStatuses[fleet.resolveTxHash] = {
                finalized,
                status: 'Failure',
              };
              this.set(this.$store);
              if (finalized) {
                console.log(`fleet ${fleetId} failed to arrive!`);
              }
              continue; // no point checking further, deleting will happen through acknowledgement
            } else {
              this.$store.txStatuses[fleet.resolveTxHash] = {
                finalized,
                status: 'Success',
              };
              if (finalized) {
                console.log(`fleet ${fleetId} arrived!`);
              }

              this.set(this.$store);
              // TODO delete fleet // or record for success
            }
          } else {
            if (
              latestFinalityBlock.timestamp >
              expiryTime + finality * blockTime
            ) {
              // we predict the failure here
              this.$store.txStatuses[fleet.resolveTxHash] = {
                finalized: true,
                status: 'Failure',
              };
              this.set(this.$store);
              console.log(`fleet ${fleetId} expired!`);
            } else {
              // check for cancelation ?
              this.$store.txStatuses[fleet.resolveTxHash] = {
                finalized: false,
                status: 'Pending',
              };
              this.set(this.$store);
              // TODO keep waiting for ever ? or add mechanism to delete it?
            }
          }
        } else {
          if (latestFinalityBlock.timestamp > expiryTime) {
            console.log({fleetExpired: fleetId});
            // consider it expired elsewhere (expired for sure = no resolveTxHash + expired time )
          }
        }
      }
    }
  }

  async login(): Promise<void> {
    await this.execute();
  }

  async generateKeys(
    signature: string
  ): Promise<{privateWallet: Wallet; aesKey: Uint8Array}> {
    const privateWallet = new Wallet(signature.slice(0, 130));
    const aesKeySignature = await privateWallet.signMessage('AES KEY');
    const aesKey = aes.utils.hex.toBytes(aesKeySignature.slice(2, 66)); // TODO mix ?
    return {privateWallet, aesKey};
  }

  async confirm({
    storeSignatureLocally,
    syncRemotely,
  }: {
    storeSignatureLocally: boolean;
    syncRemotely: boolean;
  }): Promise<void> {
    // TODO
    this.setPartial({step: 'SIGNATURE_REQUESTED'});
    if (!wallet.provider) {
      return this.cancel(new Error(`no wallet.provider`));
    }
    if (!wallet.address) {
      return this.cancel(new Error(`no wallet.address`));
    }
    if (!wallet.chain.chainId) {
      return this.cancel(new Error(`no chainId, not connected?`));
    }
    try {
      const walletAddress = wallet.address.toLowerCase();
      const signature = await wallet.provider
        .getSigner()
        .signMessage(
          'Only sign this message on "conquest.eth" or other trusted frontend'
        );
      const {privateWallet, aesKey} = await this.generateKeys(signature);
      this.walletData[walletAddress] = {wallet: privateWallet, aesKey};

      if (storeSignatureLocally) {
        const toStorage = JSON.stringify({signature, syncRemotely});
        localCache.setItem(
          LOCAL_ONLY_STORAGE_KEY(walletAddress, wallet.chain.chainId),
          toStorage
        );
      }

      this.setPartial({step: 'LOADING', syncEnabled: syncRemotely});

      this.setPartial({step: 'READY', wallet: privateWallet, aesKey});

      await this._loadData(walletAddress, wallet.chain.chainId);

      if (this._func) {
        await this._func();
      }
    } catch (e) {
      return this.cancel(e);
    }
    this._resolve && this._resolve();
    this._resolve = undefined;
    this._reject = undefined;
    this._promise = undefined;
    this._contracts = undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cancel(e?: any): void {
    flow.cancel();
    this.setPartial({step: 'IDLE', wallet: undefined, aesKey: undefined});
    if (e) {
      this._reject && this._reject(e);
    }
    this._resolve = undefined;
    this._reject = undefined;
    this._promise = undefined;
    this._contracts = undefined;
  }

  execute(func?: (contracts: Contracts) => Promise<void>): Promise<Contracts> {
    if (this._promise) {
      return this._promise.then(() => this._contracts as Contracts); // TODO check _contracts undefined case
    }
    // TODO if already connected skip
    if (this.$store.step !== 'READY') {
      this.setPartial({step: 'CONNECTING'});
    }

    return flow.execute(
      (contracts: Contracts): Promise<void> => {
        if (this.$store.step !== 'READY') {
          this.setPartial({step: 'SIGNATURE_REQUIRED'});
          this._promise = new Promise<void>((resolve, reject) => {
            this._contracts = contracts;
            this._resolve = resolve;
            this._reject = reject;
            if (func) {
              this._func = () => func(contracts);
            }
          });
          return this._promise;
        }
        if (func) {
          return func(contracts);
        } else {
          return Promise.resolve();
        }
      }
    );
  }

  recordExit(location: string, timestamp: number) {
    if (!wallet.address) {
      throw new Error(`no wallet.address`);
    }
    if (!wallet.chain.chainId) {
      throw new Error(`no chainId, not connected?`);
    }
    if (!this.$store.data) {
      this.$store.data = {fleets: {}, exits: {}, captures: {}}; // TODO everywhere
    }
    const exits = this.$store.data.exits;
    exits[location + '_' + timestamp] = timestamp;
    this.setPartial({
      data: this.$store.data,
    });
    this._setData(wallet.address, wallet.chain.chainId, this.$store.data);
  }

  // recordWithdrawal(loctions: string[], txHash: string) {
  //   // TODO
  // }

  recordCapture(location: string, txHash: string, time: number, nonce: number) {
    if (!wallet.address) {
      throw new Error(`no wallet.address`);
    }
    if (!wallet.chain.chainId) {
      throw new Error(`no chainId, not connected?`);
    }
    // console.log(`record capture ${location}`);
    if (!this.$store.data) {
      this.$store.data = {fleets: {}, exits: {}, captures: {}}; // TODO everywhere
    }
    const captures = this.$store.data.captures;
    captures[location] = {
      txHash,
      time,
      nonce,
    };
    this.setPartial({
      data: this.$store.data,
    });
    this._setData(wallet.address, wallet.chain.chainId, this.$store.data);
  }

  acknowledgeCaptureFailure(id: string) {
    const capture = this.$store.data?.captures[id];
    if (capture) {
      this.deleteCapture(id);
    }
  }

  acknowledgeResolveFailure(fleetId: string) {
    const fleet = this.$store.data?.fleets[fleetId];
    if (fleet) {
      if (wallet.address && wallet.chain.chainId && this.$store.data) {
        fleet.resolveTxHash = undefined; // TODO ensure merge do not bring it back : use time,nonce ?
        this.setPartial({
          data: this.$store.data,
        });
        this._setData(wallet.address, wallet.chain.chainId, this.$store.data);
      }
    } else {
      throw new Error(`wallet not ready`);
    }
  }

  deleteCapture(id: string) {
    if (!wallet.address) {
      throw new Error(`no wallet.address`);
    }
    if (!wallet.chain.chainId) {
      throw new Error(`no chainId, not connected?`);
    }
    if (!this.$store.data) {
      return;
    }
    // console.log(`delete capture ${id}`);
    const captures = this.$store.data.captures;
    const capture = captures[id];
    if (capture) {
      const txHash = capture.txHash;
      delete this.$store.txStatuses[txHash];
    }
    delete captures[id];
    this.set(this.$store);
    // this.setPartial({
    //   data: this.$store.data,
    // });
    this._setData(
      wallet.address,
      wallet.chain.chainId,
      this.$store.data,
      [],
      [],
      [id]
    );
  }

  deleteExit(id: string) {
    if (!wallet.address) {
      throw new Error(`no wallet.address`);
    }
    if (!wallet.chain.chainId) {
      throw new Error(`no chainId, not connected?`);
    }
    if (!this.$store.data) {
      return;
    }
    const exits = this.$store.data.exits;
    delete exits[id];
    this.setPartial({
      data: this.$store.data,
    });
    this._setData(
      wallet.address,
      wallet.chain.chainId,
      this.$store.data,
      [],
      [id]
    );
  }

  recordFleet(fleetId: string, fleet: OwnFleet): void {
    if (!wallet.address) {
      throw new Error(`no wallet.address`);
    }
    if (!wallet.chain.chainId) {
      throw new Error(`no chainId, not connected?`);
    }
    if (!this.$store.data) {
      this.$store.data = {fleets: {}, exits: {}, captures: {}};
    }
    const fleets = this.$store.data.fleets;
    fleets[fleetId] = fleet;
    this.setPartial({
      data: this.$store.data,
    });
    this._setData(wallet.address, wallet.chain.chainId, this.$store.data);
  }

  ckeckCompletion(value: number | undefined, bit: number): boolean {
    return value === undefined
      ? false
      : (value & Math.pow(2, bit)) == Math.pow(2, bit);
  }

  isWelcomingStepCompleted(bit: number): boolean {
    return this.ckeckCompletion(this.$store.data?.welcomingStep, bit);
  }

  recordWelcomingStep(bit: number): void {
    if (bit > 32) {
      throw new Error('bit > 32');
    }
    if (!wallet.address) {
      throw new Error(`no wallet.address`);
    }
    if (!wallet.chain.chainId) {
      throw new Error(`no chainId, not connected?`);
    }
    if (!this.$store.data) {
      this.$store.data = {
        fleets: {},
        exits: {},
        captures: {},
        welcomingStep: Math.pow(2, bit),
      };
    } else {
      if (this.$store.data.welcomingStep) {
        this.$store.data.welcomingStep =
          this.$store.data.welcomingStep | Math.pow(2, bit);
      } else {
        this.$store.data.welcomingStep = Math.pow(2, bit);
      }
    }
    this.setPartial({
      data: this.$store.data,
    });
    this._setData(wallet.address, wallet.chain.chainId, this.$store.data);
  }

  deleteFleet(fleetId: string) {
    if (!wallet.address) {
      throw new Error(`no wallet.address`);
    }
    if (!wallet.chain.chainId) {
      throw new Error(`no chainId, not connected?`);
    }
    if (!this.$store.data) {
      return;
    }
    const fleets = this.$store.data.fleets;
    delete fleets[fleetId];
    this.setPartial({
      data: this.$store.data,
    });
    this._setData(wallet.address, wallet.chain.chainId, this.$store.data, [
      fleetId,
    ]);
  }

  _hashString() {
    if (!this.$store.wallet) {
      throw new Error(`no this.$store.wallet`);
    }
    // TODO cache
    return keccak256(
      ['bytes32', 'bytes32'],
      [
        this.$store.wallet.privateKey.slice(0, 66),
        '0x' + this.$store.wallet.privateKey.slice(66, 130),
      ]
    );
  }

  async hashFleet(
    from: {x: number; y: number},
    to: {x: number; y: number}
  ): Promise<{toHash: string; fleetId: string; secret: string}> {
    // TODO use timestamp to allow user to retrieve a lost secret by knowing `to` and approximate time of launch
    const randomNonce =
      '0x' +
      Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    const toString = xyToLocation(to.x, to.y);
    const fromString = xyToLocation(from.x, from.y);
    // console.log({randomNonce, toString, fromString});
    const secretHash = keccak256(
      ['bytes32', 'bytes32'],
      [this._hashString(), randomNonce]
    );
    // console.log({secretHash});
    const toHash = keccak256(['bytes32', 'uint256'], [secretHash, toString]);
    const fleetId = keccak256(['bytes32', 'uint256'], [toHash, fromString]);
    return {toHash, fleetId, secret: secretHash};
  }

  fleetSecret(fleetId: string): string {
    if (!this.$store.data) {
      throw new Error(`no this.$store.data`);
    }
    return this.$store.data.fleets[fleetId].secret;
  }

  recordFleetResolvingTxhash(fleetId: string, txHash: string): void {
    if (!wallet.address) {
      throw new Error(`no wallet.address`);
    }
    if (!wallet.chain.chainId) {
      throw new Error(`no chainId, not connected?`);
    }
    if (!this.$store.data) {
      this.$store.data = {fleets: {}, exits: {}, captures: {}};
    }
    const fleets = this.$store.data.fleets;
    const fleet = fleets[fleetId];
    if (fleet) {
      fleet.resolveTxHash = txHash;
      this.setPartial({
        data: this.$store.data,
      });
      this._setData(wallet.address, wallet.chain.chainId, this.$store.data); // TODO chainId / wallet address (when wallet account changes) // TODO test
    }
  }

  getFleets(): OwnFleet[] {
    if (this.$store.data) {
      return Object.values(this.$store.data.fleets);
    } else {
      return [];
    }
  }

  capturingStatus(location: string): TxStatus | null | 'Loading' {
    if (!this.$store.data) {
      return null;
    }
    if (
      this.$store.data &&
      this.$store.data.captures[location] &&
      this.$store.data.captures[location].txHash !== null
    ) {
      const txStatus = this.$store.txStatuses[
        this.$store.data.captures[location].txHash
      ];
      if (!txStatus) {
        return 'Loading';
      }
      return txStatus;
    }
    return null;
  }

  txStatus(txHash: string): TxStatus | null | 'Loading' {
    const txStatus = this.$store.txStatuses[txHash];
    if (!txStatus) {
      return 'Loading';
    }
    return txStatus;
  }

  getFleet(fleetId: string): OwnFleet | null {
    if (this.$store.data) {
      return this.$store.data.fleets[fleetId];
    }
    return null;
  }

  get walletAddress() {
    return this.$store.walletAddress;
  }
}

export default new PrivateAccountStore();
