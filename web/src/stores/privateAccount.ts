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
  welcomed?: boolean;
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
};

type Contracts = {
  [name: string]: Contract;
};

const LOCAL_ONLY_STORAGE = '_local_only_';
function LOCAL_ONLY_STORAGE_KEY(address: string, chainId: string) {
  const localStoragePrefix =
    window.basepath &&
    (window.basepath.startsWith('/ipfs/') ||
      window.basepath.startsWith('/ipns/'))
      ? window.basepath.slice(6)
      : ''; // ensure local storage is not conflicting across web3w-based apps on ipfs gateways (require encryption for sensitive data)
  return `${localStoragePrefix}_${LOCAL_ONLY_STORAGE}_${address.toLowerCase()}_${chainId}`;
}

const LOCAL_STORAGE_PRIVATE_ACCOUNT = '_privateAccount';
function LOCAL_STORAGE_KEY(address: string, chainId: string) {
  const localStoragePrefix =
    window.basepath &&
    (window.basepath.startsWith('/ipfs/') ||
      window.basepath.startsWith('/ipns/'))
      ? window.basepath.slice(6)
      : ''; // ensure local storage is not conflicting across web3w-based apps on ipfs gateways (require encryption for sensitive data)
  return `${localStoragePrefix}_${LOCAL_STORAGE_PRIVATE_ACCOUNT}_${address.toLowerCase()}_${chainId}`;
}

class PrivateAccountStore extends BaseStoreWithData<
  PrivateAccountData,
  SecretData
> {
  private monitorProcess: NodeJS.Timeout | undefined = undefined;
  private _txPerformed: Record<string, boolean> = {};
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
    const fromStorage = localStorage.getItem(
      LOCAL_STORAGE_KEY(address, chainId)
    );
    let data = {fleets: {}, exits: {}, captures: {}};
    if (fromStorage) {
      try {
        const decrypted = this.decrypt(fromStorage);
        data = JSON.parse(decrypted);
      } catch (e) {
        console.error(e);
      }
    }
    this.setPartial({data});
    this._syncDown().then((result) => {
      if (result && result.newDataOnLocal) {
        // TODO flag to ensure syncing up when first checks
      }
    });
    this.startMonitoring(address, chainId);
  }

  async syncRequest(method: string, params: string[]): Promise<Response> {
    return await fetch('https://cf-worker-2.rim.workers.dev/', {
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

  async _syncDown(): Promise<
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
        'planet-wars-test',
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
        'put:' + 'planet-wars-test' + ':' + counter + ':' + data
      );

      let json;
      let error;
      try {
        const response = await this.syncRequest('wallet_putString', [
          this.$store.wallet.address,
          'planet-wars-test',
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
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY(address, chainId), encrypted);
    } catch (e) {
      console.error(e);
    }
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
    localStorage.removeItem(key);
    const data = '';
    const counter = syncDownResult.counter.add(1).toString();
    const signature = await this.$store.wallet.signMessage(
      'put:' + 'planet-wars-test' + ':' + counter + ':' + data
    );
    await this.syncRequest('wallet_putString', [
      this.$store.wallet.address,
      'planet-wars-test',
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
      let fromStorage;
      try {
        fromStorage = localStorage.getItem(
          LOCAL_ONLY_STORAGE_KEY(walletAddress, chainId)
        );
      } catch (e) {
        console.error(e);
      }
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
        console.log({walletDiff, chainDiff});
        if (this.$store.walletAddress && this.$store.chainId && existingData) {
          this.setPartial({
            wallet: existingData.wallet,
            aesKey: existingData.aesKey,
            walletAddress,
            chainId,
            data: undefined,
          });
          console.log('loading data');
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
        if (receipt.status && receipt.status === 0) {
          // TODO record Error ?
        }
        if (receipt.confirmations == finality) {
          // TODO finality
          this.deleteCapture(location); // TODO pending
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
          // TODO check equality or not
          this.deleteCapture(location);
        }
      }
    }
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
      let fleetData;
      try {
        fleetData = await wallet.contracts?.OuterSpace.callStatic.getFleet(
          // TODO batch getFleets
          fleetId,
          {blockTag: Math.max(0, latestBlockNumber - finality)}
        );
      } catch (e) {
        //
      }
      let currentFleetData;
      try {
        currentFleetData = await wallet.contracts?.OuterSpace.callStatic.getFleet(
          // TODO batch getFleets
          fleetId
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

      // TODO use currentFleetData to update launchTime :

      if (
        fleet.resolveTxHash &&
        currentFleetData &&
        currentFleetData.launchTime > 0
      ) {
        if (currentFleetData.quantity == 0) {
          this._txPerformed[fleet.resolveTxHash] = true;
        } else {
          this._txPerformed[fleet.resolveTxHash] = false;
          const launchTime = currentFleetData.launchTime;
          const resolveWindow =
            contractsInfo.contracts.OuterSpace.linkedData.resolveWindow;
          console.log({
            duration: fleet.duration,
            launchTime: launchTime,
            resolveWindow,
          });
          const expiryTime = launchTime + fleet.duration + resolveWindow;
          if (latestFinalityBlock.timestamp > expiryTime) {
            console.log({expirted: fleetId});
            this.deleteFleet(fleetId);
            continue;
          }
        }
      }

      if (fleetData && fleetData.launchTime > 0) {
        const launchTime = fleetData.launchTime;
        if (fleetData.quantity === 0) {
          // TODO use resolveTxHash instead ? // this would allow resolve to clear storage in OuterSpace.sol
          this.deleteFleet(fleetId);
          continue;
        } else {
          const resolveWindow =
            contractsInfo.contracts.OuterSpace.linkedData.resolveWindow;
          console.log({
            duration: fleet.duration,
            launchTime: launchTime,
            resolveWindow,
          });
          const expiryTime = launchTime + fleet.duration + resolveWindow;
          if (latestFinalityBlock.timestamp > expiryTime) {
            console.log({expirted: fleetId});
            this.deleteFleet(fleetId);
          }
          continue;
        }
      } else {
        if (fleet.resolveTxHash) {
          // TODO should not happen
        } else {
          // TODO check for replaced tx
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
        try {
          localStorage.setItem(
            LOCAL_ONLY_STORAGE_KEY(walletAddress, wallet.chain.chainId),
            toStorage
          );
        } catch (e) {
          console.error(e);
        }
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
    console.log(`record capture ${location}`);
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

  deleteCapture(id: string) {
    if (!wallet.address) {
      throw new Error(`no wallet.address`);
    }
    if (!wallet.chain.chainId) {
      throw new Error(`no chainId, not connected?`);
    }
    console.log(`delete capture ${id}`);
    if (!this.$store.data) {
      return;
    }
    const captures = this.$store.data.captures;
    delete captures[id];
    this.setPartial({
      data: this.$store.data,
    });
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

  recordWelcomed(): void {
    if (!wallet.address) {
      throw new Error(`no wallet.address`);
    }
    if (!wallet.chain.chainId) {
      throw new Error(`no chainId, not connected?`);
    }
    if (!this.$store.data) {
      this.$store.data = {fleets: {}, exits: {}, captures: {}, welcomed: true};
    } else {
      this.$store.data.welcomed = true;
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
    console.log({randomNonce, toString, fromString});
    const secretHash = keccak256(
      ['bytes32', 'bytes32'],
      [this._hashString(), randomNonce]
    );
    console.log({secretHash});
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

  isTxPerformed(txHash?: string): boolean {
    if (!txHash) {
      return false;
    }
    return this._txPerformed[txHash];
  }

  isCapturing(location: string): boolean {
    if (!this.$store.data) {
      return false;
    }
    return (
      this.$store.data &&
      this.$store.data.captures[location] &&
      this.$store.data.captures[location].txHash !== null
    );
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
