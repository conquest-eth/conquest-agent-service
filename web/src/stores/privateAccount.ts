import {writable} from 'svelte/store';
import {wallet, flow, chain} from './wallet';
import {Wallet} from '@ethersproject/wallet';
import type {Contract} from '@ethersproject/contracts';
import {keccak256} from '@ethersproject/solidity';
import {OwnFleet, xyToLocation} from 'planet-wars-common';
import {BigNumber} from '@ethersproject/bignumber';
import {finality} from '../config';
import aes from "aes-js";

type SecretData = {
  fleets: Record<string, OwnFleet>;
};

type PrivateAccountData = {
  wallet?: Wallet;
  step:
    | 'READY'
    | 'CONNECTING'
    | 'SIGNATURE_REQUIRED'
    | 'SIGNATURE_REQUESTED'
    | 'LOADING'
    | 'IDLE';
  data: SecretData | undefined;
  sync: 'IDLE' | 'SYNCING' | 'SYNCED' | 'NOT_SYNCED';
  syncError: unknown;
  walletAddress?: string;
  chainId?: string;
};

// TODO
const aesKey = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ];
try {
  new aes.ModeOfOperation.ctr(aesKey);
} catch(e) {

}


const $data: PrivateAccountData = {
  wallet: undefined,
  step: 'IDLE',
  data: undefined,
  sync: 'IDLE',
  syncError: undefined,
};
const {subscribe, set} = writable($data);

function _set(obj: Partial<PrivateAccountData>): PrivateAccountData {
  for (const key of Object.keys(obj)) {
    $data[key] = obj[key];
  }
  set($data);
  return $data;
}

const LOCAL_STORAGE_PRIVATE_ACCOUNT = '_privateAccount';

let monitorProcess: NodeJS.Timeout | undefined = undefined;

function LOCAL_STORAGE_KEY(address: string, chainId: string) {
  const localStoragePrefix =
    window.basepath &&
    (window.basepath.startsWith('/ipfs/') ||
      window.basepath.startsWith('/ipns/'))
      ? window.basepath.slice(6)
      : ''; // ensure local storage is not conflicting across web3w-based apps on ipfs gateways (require encryption for sensitive data)
  return `${localStoragePrefix}_${LOCAL_STORAGE_PRIVATE_ACCOUNT}_${address.toLowerCase()}_${chainId}`;
}

async function _loadData(address: string, chainId: string) {
  // TODO load from signature based DB
  const fromStorage = localStorage.getItem(LOCAL_STORAGE_KEY(address, chainId));
  let data;
  if (fromStorage) {
    data = JSON.parse(fromStorage);
    // TODO decrypt + uncompress
  }
  _set({data});
  _syncDown().then((result) => {
    if (result && result.newDataOnLocal) {
      // TODO flag to ensure syncing up when first checks
    }
  })
  startMonitoring(address, chainId);
}

let _lastId = 0;
async function syncRequest(method: string, params: string[]): Promise<Response> {
  return await fetch("https://cf-worker-2.rim.workers.dev/", { // TODO env variable
    method: "POST",
    body: JSON.stringify({
        method,
        params,
        "jsonrpc": "2.0",
        id: ++_lastId
    }),
    headers: {
        "Content-type": "application/json; charset=UTF-8"
    }
  });
}

// async function getSyncedData(): Promise<string> {

// }

async function _syncDown(): Promise<{newDataOnLocal: boolean, counter: BigNumber} | undefined> {
  _set({sync: 'SYNCING'});
  let json;
  let error;
  try {
    const response = await syncRequest("wallet_getString", [$data.wallet.address, "planet-wars-test"]);
    json = await response.json();
  } catch(e) {
    error = e;
  }
  if (error || json.error) {
    _set({sync: 'NOT_SYNCED', syncError: error || json.error});
    return; // TODO retry ?
  }
  const data = json.result.data ? JSON.parse(json.result.data) :  {}; // TODO decryption
  const newDataOnLocal = _merge(data);

  _set({data:$data.data});
  _saveToLocalStorage($data.walletAddress, $data.chainId, $data.data);

  if (!newDataOnLocal) {
    _set({sync: 'SYNCED'});
  } else {
    // do not sync up as we will do that latter as part of the usual fleet checks
  }
  return {newDataOnLocal, counter: BigNumber.from(json.result.counter)};
}

function _merge(data: SecretData): boolean {
  if (!$data.data) {
    $data.data = {fleets: {}}
  }
  if (!$data.data.fleets) {
    $data.data.fleets = {};
  }
  let newDataOnLocal = false;
  const localFleets = $data.data.fleets;
  const remoteFleets = data.fleets;
  if (remoteFleets) {
    for (const key of Object.keys(remoteFleets)) {
      if (!localFleets[key]) {
        localFleets[key] = remoteFleets[key]; // new
      } else {
        const localFleet = localFleets[key];
        const remoteFleet = remoteFleets[key];
        if (localFleet.to.x !== remoteFleet.to.x || localFleet.to.y !== remoteFleet.to.y) {
          console.error("fleet with different destination but same id");
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
  set($data);
  return newDataOnLocal;
}

async function _sync(fleetsToDelete: string[] = []) {

  const syncDownResult = await _syncDown();


  if (syncDownResult && (syncDownResult.newDataOnLocal || fleetsToDelete.length > 0 )) {
    _set({sync: 'SYNCING'});

    for (const fleetToDelete of fleetsToDelete) {
      delete $data.data.fleets[fleetToDelete];
    }
    _set($data);

    const data = JSON.stringify($data.data); // TODO compression + encryption

    const counter = syncDownResult.counter.add(1).toString();
    const signature = await $data.wallet.signMessage('put:' + 'planet-wars-test' + ':' + counter + ':' + data);

    let json;
    let error;
    try {
      const response = await syncRequest("wallet_putString", [$data.wallet.address, "planet-wars-test", counter, data, signature]);
      json = await response.json();
    } catch(e) {
      error = e;
    }
    if (error || json.error) {
      _set({sync: 'NOT_SYNCED', syncError: error || json.error});
      return; // TODO retry ?
    }
    if (!json.success) {
      _set({sync: 'NOT_SYNCED', syncError: "no success"});
      return; // TODO retry ?
    }

    _set({sync: 'SYNCED'});
  }
}

function _saveToLocalStorage(address: string, chainId: string, data: SecretData) {
  const toStorage = JSON.stringify(data);
  // TODO compress + encrypt
  localStorage.setItem(LOCAL_STORAGE_KEY(address, chainId), toStorage);
}

async function _setData(address: string, chainId: string, data: SecretData, fleetIdsToDelete: string[] = []) {
  _saveToLocalStorage(address, chainId, data);
  _sync(fleetIdsToDelete); // TODO fetch before set local storage to avoid aother encryption roundtrip
}

const walletData: Record<string, {wallet: Wallet}> = {};

type Contracts = {
  [name: string]: Contract;
};

function start(walletAddress, chainId): void {
  // console.log("START", {walletAddress, chainId});
  const walletDiff =
    !$data.walletAddress ||
    walletAddress.toLowerCase() !== $data.walletAddress.toLowerCase();
  const chainDiff = !$data.chainId || chainId !== $data.chainId;

  if (chainId && walletAddress) {
    // console.log("READY");
    const existingData = walletData[walletAddress.toLowerCase()];
    if (existingData) {
      _set({
        step: 'READY',
        wallet: existingData.wallet,
        walletAddress,
        chainId,
      });
    } else {
      _set({
        wallet: undefined,
        walletAddress,
        chainId,
        data: undefined,
      });
      if ($data.step === 'READY') {
        _set({step: 'IDLE'});
      }
    }
    if (walletDiff || chainDiff) {
      console.log({walletDiff, chainDiff});
      if ($data.walletAddress && walletData[$data.walletAddress.toLowerCase()]) {
        console.log('loading data');
        _loadData($data.walletAddress, $data.chainId);
      }
    }
  } else {
    // console.log("STOP");
    _set({walletAddress, chainId});
    stopMonitoring();
  }
}

chain.subscribe(($chain) => {
  if ($chain.state === 'Ready') {
    start($data.walletAddress, $chain.chainId);
  } else {
    _set({wallet: undefined});
    if ($data.step === 'READY') {
      _set({step: 'IDLE', chainId: undefined, data: undefined});
    }
    stopMonitoring();
  }
});

wallet.subscribe(($wallet) => {
  if ($wallet.address) {
    start($wallet.address, $data.chainId);
  } else {
    _set({wallet: undefined});
    if ($data.step === 'READY') {
      _set({step: 'IDLE', walletAddress: undefined, data: undefined});
    }
    stopMonitoring();
  }
});

function stopMonitoring() {
  if (monitorProcess !== undefined) {
    clearInterval(monitorProcess);
    monitorProcess = undefined;
  }
}

function startMonitoring(address: string, chainId: string) {
  stopMonitoring();
  listenForFleets(address, chainId);
  monitorProcess = setInterval(() => listenForFleets(address, chainId), 1000); // TODO time config
}

async function listenForFleets(
  address: string,
  chainId: string
): Promise<void> {
  if (!$data.data) {
    return;
  }
  const latestBlockNumber = await wallet.provider.getBlockNumber();
  if (!$data.data) {
    return;
  }
  const fleetIds = Object.keys($data.data.fleets);
  for (const fleetId of fleetIds) {
    // if ($data.data.fleets[fleetId].launchTime) // TODO filter out fleet that are not yet ready to be resolved
    let fleetData;
    try {
      fleetData = await wallet.contracts.OuterSpace.callStatic.getFleet(
        fleetId,
        {blockTag: Math.max(0, latestBlockNumber - finality)}
      );
    } catch (e) {
      //
    }
    if (
      !$data.walletAddress ||
      $data.walletAddress.toLowerCase() !== address.toLowerCase() ||
      $data.chainId !== chainId
    ) {
      return;
    }

    if (fleetData && fleetData.launchTime.gt(0) && fleetData.quantity === 0) {
      deleteFleet(fleetId);
    }
  }
}

async function login(): Promise<void> {
  await execute();
}

let _promise: Promise<void> | undefined;
let _resolve: () => void;
let _reject: (error: unknown) => void;
let _func: () => Promise<void>;
let _contracts: Contracts;

async function confirm(): Promise<void> {
  _set({step: 'SIGNATURE_REQUESTED'});
  try {
    const walletAddress = wallet.address.toLowerCase();
    const signature = await wallet.provider
      .getSigner()
      .signMessage('Only sign this message on "planet-wars"');
    const privateWallet = new Wallet(signature.slice(0, 130));
    walletData[walletAddress] = {wallet: privateWallet};

    _set({step: 'LOADING'});

    _set({step: 'READY', wallet: privateWallet});

    await _loadData(walletAddress, wallet.chain.chainId);

    if (_func) {
      await _func();
    }
  } catch (e) {
    _set({step: 'IDLE', wallet: undefined});
    _reject(e);
    _resolve = undefined;
    _reject = undefined;
    _promise = undefined;
    _contracts = undefined;
    return;
  }
  _resolve();
  _resolve = undefined;
  _reject = undefined;
  _promise = undefined;
  _contracts = undefined;
}

function execute(
  func?: (contracts: Contracts) => Promise<void>
): Promise<Contracts> {
  if (_promise) {
    return _promise.then(() => _contracts);
  }
  // TODO if already connected skip
  if ($data.step !== 'READY') {
    _set({step: 'CONNECTING'});
  }

  return flow.execute(
    (contracts: Contracts): Promise<void> => {
      if ($data.step !== 'READY') {
        _set({step: 'SIGNATURE_REQUIRED'});
        _promise = new Promise<void>((resolve, reject) => {
          _contracts = contracts;
          _resolve = resolve;
          _reject = reject;
          if (func) {
            _func = () => func(contracts);
          }
        });
        return _promise;
      }
      if (func) {
        return func(contracts);
      } else {
        return Promise.resolve();
      }
    }
  );
}

function recordFleet(fleetId: string, fleet: OwnFleet) {
  if (!$data.data) {
    $data.data = {fleets: {}};
  }
  const fleets = $data.data.fleets;
  fleets[fleetId] = fleet;
  _set({
    data: $data.data,
  });
  _setData(wallet.address, wallet.chain.chainId, $data.data);
}

function deleteFleet(fleetId: string) {
  if (!$data.data) {
    return;
  }
  const fleets = $data.data.fleets;
  delete fleets[fleetId];
  _set({
    data: $data.data,
  });
  _setData(wallet.address, wallet.chain.chainId, $data.data, [fleetId]);
}

function _hashString() {
  return keccak256(
    ['bytes32', 'bytes32'],
    [
      $data.wallet.privateKey.slice(0, 66),
      '0x' + $data.wallet.privateKey.slice(66, 130),
    ]
  );
}

async function hashFleet(
  subId: string,
  to: {x: number; y: number}
): Promise<string> {
  const toString = xyToLocation(to.x, to.y);
  const secretHash = keccak256(['bytes32', 'uint88'], [_hashString(), subId]);
  const toHash = keccak256(['bytes32', 'uint256'], [secretHash, toString]);
  return toHash;
}

function fleetSecret(fleetId: string): string {
  const subId = BigNumber.from(fleetId)
    .mod('0x10000000000000000000000')
    .toString();
  console.log('fleetSecret', {subId});
  return keccak256(['bytes32', 'uint88'], [_hashString(), subId]);
}

function recordFleetResolvingTxhash(fleetId: string, txHash: string): void {
  if (!$data.data) {
    $data.data = {fleets: {}};
  }
  const fleets = $data.data.fleets;
  const fleet = fleets[fleetId];
  if (fleet) {
    fleet.resolveTxHash = txHash;
    _set({
      data: $data.data,
    });
    _setData(wallet.address, wallet.chain.chainId, $data.data); // TODO chainId / wallet address (when wallet account changes) // TODO test
  }
}

function getFleets(): OwnFleet[] {
  if ($data.data) {
    return Object.values($data.data.fleets);
  } else {
    return [];
  }
}

function getFleet(fleetId: string): OwnFleet | null {
  if ($data.data) {
    return $data.data.fleets[fleetId];
  }
  return null;
}

let dataStore;
export default dataStore = {
  subscribe,
  login,
  confirm,
  execute,
  recordFleet,
  recordFleetResolvingTxhash,
  get privateWallet() {
    return $data.wallet;
  },
  hashFleet,
  fleetSecret,
  getFleets,
  getFleet,
  get walletAddress() {
    return $data.walletAddress;
  },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
if (typeof window !== 'undefined') {
  (window as any).privateAccount = dataStore;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
