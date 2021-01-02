import {writable} from 'svelte/store';
import {wallet, flow, chain} from './wallet';
import {Wallet} from '@ethersproject/wallet';
import type {Contract} from '@ethersproject/contracts';
import {keccak256} from '@ethersproject/solidity';
import {OwnFleet, xyToLocation} from 'planet-wars-common';
import {BigNumber} from '@ethersproject/bignumber';
import {finality} from '../config';
import aes from "aes-js";
import * as base64 from "byte-base64";
import * as lz from 'lz-string'
import contractsInfo from '../contracts.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { compressToUint8Array, decompressFromUint8Array } = (lz as any).default as lz.LZStringStatic;

type SecretData = {
  fleets: Record<string, OwnFleet>;
  exits: Record<string, number>
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
  sync: 'IDLE' | 'SYNCING' | 'SYNCED' | 'NOT_SYNCED';
  syncError: unknown;
  walletAddress?: string;
  chainId?: string;
};

const $data: PrivateAccountData = {
  wallet: undefined,
  aesKey: undefined,
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
  let data = {fleets: {}, exits: {}};
  if (fromStorage) {
    try {
      const decrypted = decrypt(fromStorage);
      data = JSON.parse(decrypted);
    } catch (e) {
      console.error(e);
    }
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

async function _syncDown(): Promise<{newDataOnLocal: boolean, newDataOnRemote: boolean, counter: BigNumber} | undefined> {
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
  let data: SecretData = {fleets: {}, exits: {}};
  if (json.result.data && json.result.data !== "") {
    try {
      const decryptedData = decrypt(json.result.data);
      data = JSON.parse(decryptedData);
    } catch (e) {
      console.error(e);
    }
  }
  const {newDataOnLocal, newDataOnRemote} = _merge(data);

  _set({data:$data.data});
  _saveToLocalStorage($data.walletAddress, $data.chainId, $data.data);

  if (!newDataOnLocal) {
    _set({sync: 'SYNCED'});
  } else {
    // do not sync up as we will do that latter as part of the usual fleet checks
  }
  return {newDataOnLocal, newDataOnRemote, counter: BigNumber.from(json.result.counter)};
}

function _merge(data: SecretData): {newDataOnLocal: boolean, newDataOnRemote: boolean} {
  if (!$data.data) {
    $data.data = {fleets: {}, exits: {}}
  }
  if (!$data.data.fleets) {
    $data.data.fleets = {};
  }
  let newDataOnLocal = false;
  let newDataOnRemote = false;
  const localFleets = $data.data.fleets;
  const remoteFleets = data.fleets;
  if (remoteFleets) {
    for (const key of Object.keys(remoteFleets)) {
      if (!localFleets[key]) {
        newDataOnRemote = true;
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
  set($data);
  return {newDataOnLocal, newDataOnRemote};
}

function encrypt(data: string): string {
  if (!$data || !$data.aesKey) {
    throw new Error("no aes key set");
  }
  const textBytes = compressToUint8Array(data);
  const ctr = new aes.ModeOfOperation.ctr($data.aesKey);
  const encryptedBytes = ctr.encrypt(textBytes);
  return base64.bytesToBase64(encryptedBytes);
}

function decrypt(data: string): string {
  if (!$data || !$data.aesKey) {
    throw new Error("no aes key set");
  }
  const encryptedBytes = base64.base64ToBytes(data);
  const ctr = new aes.ModeOfOperation.ctr($data.aesKey);
  const decryptedBytes = ctr.decrypt(encryptedBytes);
  return decompressFromUint8Array(decryptedBytes);
}

async function _sync(fleetsToDelete: string[] = [], exitsToDelete: string[] = []) {

  const syncDownResult = await _syncDown();


  if (syncDownResult && (syncDownResult.newDataOnLocal || fleetsToDelete.length > 0 )) {
    _set({sync: 'SYNCING'});

    for (const fleetToDelete of fleetsToDelete) {
      delete $data.data.fleets[fleetToDelete];
    }
    for (const exitToDelete of exitsToDelete) {
      delete $data.data.exits[exitToDelete];
    }
    _set($data);

    const dataToEncrypt = JSON.stringify($data.data); // TODO compression + encryption

    const data = encrypt(dataToEncrypt);

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
  const encrypted = encrypt(toStorage);
  // TODO compress + encrypt
  localStorage.setItem(LOCAL_STORAGE_KEY(address, chainId), encrypted);
}

async function _setData(address: string, chainId: string, data: SecretData, fleetIdsToDelete: string[] = [], exitsToDelete: string[] = []) {
  _saveToLocalStorage(address, chainId, data);
  _sync(fleetIdsToDelete, exitsToDelete); // TODO fetch before set local storage to avoid aother encryption roundtrip
}

const walletData: Record<string, {wallet: Wallet, aesKey: Uint8Array}> = {};

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
        aesKey: existingData.aesKey,
        walletAddress,
        chainId,
      });
    } else {
      _set({
        wallet: undefined,
        aesKey: undefined,
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
    _set({wallet: undefined, aesKey: undefined});
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
    _set({wallet: undefined, aesKey: undefined});
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
  checking(address, chainId);
  monitorProcess = setInterval(() => checking(address, chainId), 1000); // TODO time config
}

async function checking(
  address: string,
  chainId: string
) {
  await listenForFleets(address, chainId);
  await listenForExits(address, chainId);
}

async function listenForExits(
  address: string,
  chainId: string
): Promise<void> {
  if (!$data.data) {
    return;
  }
  const latestBlock = await wallet.provider.getBlock("latest");
  const latestBlockNumber = latestBlock.number;
  if (!$data.data) {
    return;
  }
  const exitIds = Object.keys($data.data.exits);
  for (const exitId of exitIds) {
    const split = exitId.split("_");
    const location = split[0];
    const timestamp = parseInt(split[1]);

    console.log({timestamp, location});
    if (latestBlock.timestamp > timestamp + contractsInfo.contracts.OuterSpace.linkedData.exitDuration) {
      let planetData;
      try {
        planetData = await wallet.contracts.OuterSpace.callStatic.getPlanetStates(
          [location],
          {blockTag: Math.max(0, latestBlockNumber - finality)}
        );
      } catch (e) {
        console.error(e);
      }
      if (
        !$data.walletAddress ||
        $data.walletAddress.toLowerCase() !== address.toLowerCase() ||
        $data.chainId !== chainId
      ) {
        return;
      }

      console.log({planetData, location})

      if (planetData && (planetData[0].exitTime === 0 || planetData[0].owner !== address)) {
        deleteExit(exitId);
      }
    }
  }
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
      fleetData = await wallet.contracts.OuterSpace.callStatic.getFleet( // TODO batch getFleets
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
    const aesKeySignature = await privateWallet.signMessage('AES KEY');
    const aesKey = aes.utils.hex.toBytes(aesKeySignature.slice(2,66)); // TODO mix ?
    walletData[walletAddress] = {wallet: privateWallet, aesKey };

    _set({step: 'LOADING'});

    _set({step: 'READY', wallet: privateWallet, aesKey});

    await _loadData(walletAddress, wallet.chain.chainId);

    if (_func) {
      await _func();
    }
  } catch (e) {
    _set({step: 'IDLE', wallet: undefined, aesKey: undefined});
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

function recordExit(location: string, timestamp: number) {
  if (!$data.data) {
    $data.data = {fleets: {}, exits: {}}; // TODO everywhere
  }
  const exits = $data.data.exits;
  exits[location + "_" + timestamp] = timestamp;
  _set({
    data: $data.data,
  });
  _setData(wallet.address, wallet.chain.chainId, $data.data);
}


function deleteExit(id: string) {
  if (!$data.data) {
    return;
  }
  const exits = $data.data.exits;
  delete exits[id];
  _set({
    data: $data.data,
  });
  _setData(wallet.address, wallet.chain.chainId, $data.data, [], [id]);
}

function recordFleet(fleetId: string, fleet: OwnFleet) {
  if (!$data.data) {
    $data.data = {fleets: {}, exits: {}};
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
    $data.data = {fleets: {}, exits: {}};
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
  recordExit,
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
