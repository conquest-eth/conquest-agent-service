import {writable} from 'svelte/store';
import {wallet, flow, chain} from './wallet';
import {Wallet} from '@ethersproject/wallet';
import type {Contract} from '@ethersproject/contracts';
import {keccak256} from '@ethersproject/solidity';
import {xyToLocation} from '../common/src';
import type {OwnFleet} from '../common/src/types';
import {BigNumber} from '@ethersproject/bignumber';
import {finality} from '../config';
import aes from 'aes-js';
import * as base64 from 'byte-base64';
import * as lz from 'lz-string';
import contractsInfo from '../contracts.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const {compressToUint8Array, decompressFromUint8Array} = (lz as any)
  .default as lz.LZStringStatic;

type Capture = {
  txHash: string;
  nonce: number;
  time: number;
};

type Withdrawal = {
  txHash: string;
  nonce: number;
};

type SecretData = {
  fleets: Record<string, OwnFleet>;
  exits: Record<string, number>;
  captures: Record<string, Capture>;
  lastWithdrawal?: Withdrawal;
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
  const data = $data as Record<string, unknown>;
  const objTyped = obj as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    data[key] = objTyped[key];
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
  let data = {fleets: {}, exits: {}, captures: {}};
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
  });
  startMonitoring(address, chainId);
}

const _txPerformed: Record<string, boolean> = {};

let _lastId = 0;
async function syncRequest(
  method: string,
  params: string[]
): Promise<Response> {
  return await fetch('https://cf-worker-2.rim.workers.dev/', {
    // TODO env variable
    method: 'POST',
    body: JSON.stringify({
      method,
      params,
      jsonrpc: '2.0',
      id: ++_lastId,
    }),
    headers: {
      'Content-type': 'application/json; charset=UTF-8',
    },
  });
}

// async function getSyncedData(): Promise<string> {

// }

async function _syncDown(): Promise<
  | {newDataOnLocal: boolean; newDataOnRemote: boolean; counter: BigNumber}
  | undefined
> {
  _set({sync: 'SYNCING'});
  let json;
  let error;
  try {
    if (!$data.wallet) {
      throw new Error(`no $data.wallet`);
    }
    const response = await syncRequest('wallet_getString', [
      $data.wallet.address,
      'planet-wars-test',
    ]);
    json = await response.json();
  } catch (e) {
    error = e;
  }
  if (error || json.error) {
    _set({sync: 'NOT_SYNCED', syncError: error || json.error});
    return; // TODO retry ?
  }
  let data: SecretData = {fleets: {}, exits: {}, captures: {}};
  if (json.result.data && json.result.data !== '') {
    try {
      const decryptedData = decrypt(json.result.data);
      data = JSON.parse(decryptedData);
    } catch (e) {
      console.error(e);
    }
  }
  const {newDataOnLocal, newDataOnRemote} = _merge(data);

  if (!$data.walletAddress) {
    throw new Error(`no $data.walletAddress`);
  }
  if (!$data.chainId) {
    throw new Error(`no $data.chainId`);
  }
  if (!$data.data) {
    throw new Error(`no $data.data`);
  }
  _set({data: $data.data});
  _saveToLocalStorage($data.walletAddress, $data.chainId, $data.data);

  if (!newDataOnLocal) {
    _set({sync: 'SYNCED'});
  } else {
    // do not sync up as we will do that latter as part of the usual fleet checks
  }
  return {
    newDataOnLocal,
    newDataOnRemote,
    counter: BigNumber.from(json.result.counter),
  };
}

function _merge(
  data: SecretData
): {newDataOnLocal: boolean; newDataOnRemote: boolean} {
  if (!$data.data) {
    $data.data = {fleets: {}, exits: {}, captures: {}};
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
  set($data);
  return {newDataOnLocal, newDataOnRemote};
}

function encrypt(data: string): string {
  if (!$data || !$data.aesKey) {
    throw new Error('no aes key set');
  }
  const textBytes = compressToUint8Array(data); // const textBytes = aes.utils.utf8.toBytes(data);
  const ctr = new aes.ModeOfOperation.ctr($data.aesKey);
  const encryptedBytes = ctr.encrypt(textBytes);
  return base64.bytesToBase64(encryptedBytes);
}

function decrypt(data: string): string {
  if (!$data || !$data.aesKey) {
    throw new Error('no aes key set');
  }
  const encryptedBytes = base64.base64ToBytes(data);
  const ctr = new aes.ModeOfOperation.ctr($data.aesKey);
  const decryptedBytes = ctr.decrypt(encryptedBytes);
  return decompressFromUint8Array(decryptedBytes) || ''; // return aes.utils.utf8.fromBytes(decryptedBytes);
}

async function _sync(
  fleetsToDelete: string[] = [],
  exitsToDelete: string[] = [],
  capturesToDelete: string[] = []
) {
  const syncDownResult = await _syncDown();

  if (
    syncDownResult &&
    (syncDownResult.newDataOnLocal || fleetsToDelete.length > 0)
  ) {
    _set({sync: 'SYNCING'});

    if (!$data.data) {
      throw new Error(`no $data.data`);
    }
    if (!$data.wallet) {
      throw new Error(`no $data.wallet`);
    }

    for (const fleetToDelete of fleetsToDelete) {
      delete $data.data.fleets[fleetToDelete];
    }
    for (const exitToDelete of exitsToDelete) {
      delete $data.data.exits[exitToDelete];
    }
    for (const captureToDelete of capturesToDelete) {
      delete $data.data.captures[captureToDelete];
    }
    _set($data);

    const dataToEncrypt = JSON.stringify($data.data); // TODO compression + encryption

    const data = encrypt(dataToEncrypt);

    const counter = syncDownResult.counter.add(1).toString();
    const signature = await $data.wallet.signMessage(
      'put:' + 'planet-wars-test' + ':' + counter + ':' + data
    );

    let json;
    let error;
    try {
      const response = await syncRequest('wallet_putString', [
        $data.wallet.address,
        'planet-wars-test',
        counter,
        data,
        signature,
      ]);
      json = await response.json();
    } catch (e) {
      error = e;
    }
    if (error || json.error) {
      _set({sync: 'NOT_SYNCED', syncError: error || json.error});
      return; // TODO retry ?
    }
    if (!json.success) {
      _set({sync: 'NOT_SYNCED', syncError: 'no success'});
      return; // TODO retry ?
    }

    _set({sync: 'SYNCED'});
  }
}

function _saveToLocalStorage(
  address: string,
  chainId: string,
  data?: SecretData
) {
  if (!data) {
    return; // TODO ?
  }
  const toStorage = JSON.stringify(data);
  const encrypted = encrypt(toStorage);
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY(address, chainId), encrypted);
  } catch (e) {
    console.error(e);
  }
}

async function _setData(
  address: string,
  chainId: string,
  data: SecretData,
  fleetIdsToDelete: string[] = [],
  exitsToDelete: string[] = [],
  capturesToDelete: string[] = []
) {
  _saveToLocalStorage(address, chainId, data);
  _sync(fleetIdsToDelete, exitsToDelete, capturesToDelete); // TODO fetch before set local storage to avoid aother encryption roundtrip
}

async function clearData() {
  const syncDownResult = await _syncDown();
  if (!syncDownResult) {
    throw new Error(`failed to sync down`);
  }
  if (!wallet.address || !wallet.chain.chainId) {
    console.log(` no: ${wallet.address}, ${wallet.chain.chainId}`);
    return;
  }
  if (!$data.wallet) {
    throw new Error(`no $data.wallet`);
  }
  const key = LOCAL_STORAGE_KEY(wallet.address, wallet.chain.chainId);
  localStorage.removeItem(key);
  const data = '';
  const counter = syncDownResult.counter.add(1).toString();
  const signature = await $data.wallet.signMessage(
    'put:' + 'planet-wars-test' + ':' + counter + ':' + data
  );
  await syncRequest('wallet_putString', [
    $data.wallet.address,
    'planet-wars-test',
    counter,
    data,
    signature,
  ]);
}

const walletData: Record<string, {wallet: Wallet; aesKey: Uint8Array}> = {};

type Contracts = {
  [name: string]: Contract;
};

function start(walletAddress?: string, chainId?: string): void {
  // console.log("START", {walletAddress, chainId});
  const walletDiff =
    !$data.walletAddress ||
    walletAddress?.toLowerCase() !== $data.walletAddress.toLowerCase();
  const chainDiff = !$data.chainId || chainId !== $data.chainId;

  if (chainId && walletAddress) {
    // console.log("READY");
    const existingData = walletData[walletAddress.toLowerCase()];
    if (existingData) {
      _set({
        step: 'READY', // TODO why READY ?
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
      if ($data.walletAddress && $data.chainId && existingData) {
        _set({
          wallet: existingData.wallet,
          aesKey: existingData.aesKey,
          walletAddress,
          chainId,
          data: undefined,
        });
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
  monitorProcess = setInterval(() => checking(address, chainId), 5000); // TODO time config
}

async function checking(address: string, chainId: string) {
  // TODO check blockNumber and only perform if different ?
  listenForFleets(address, chainId);
  listenForExits(address, chainId);
  listenForCaptures(address, chainId);
}

async function listenForExits(address: string, chainId: string): Promise<void> {
  if (!$data.data) {
    return;
  }
  if (!wallet.provider) {
    throw new Error(`no wallet.provider`);
  }
  const latestBlock = await wallet.provider.getBlock('latest');
  const latestBlockNumber = latestBlock.number;
  if (!$data.data) {
    return;
  }
  const exitIds = Object.keys($data.data.exits);
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
        !$data.walletAddress ||
        $data.walletAddress.toLowerCase() !== address.toLowerCase() ||
        $data.chainId !== chainId
      ) {
        return;
      }

      if (
        planetData &&
        (planetData[0].exitTime === 0 || planetData[0].owner !== address)
      ) {
        deleteExit(exitId);
      }
    }
  }
}

async function listenForCaptures(
  address: string,
  chainId: string
): Promise<void> {
  if (!$data.data) {
    return;
  }
  if (!wallet.provider) {
    throw new Error(`no wallet.provider`);
  }
  const latestBlock = await wallet.provider.getBlock('latest');
  const latestBlockNumber = latestBlock.number;
  if (!$data.data) {
    return;
  }
  const locations = Object.keys($data.data.captures);
  for (const location of locations) {
    const capture = $data.data.captures[location];
    const receipt = await wallet.provider.getTransactionReceipt(capture.txHash);
    if (
      !$data.walletAddress ||
      $data.walletAddress.toLowerCase() !== address.toLowerCase() ||
      $data.chainId !== chainId
    ) {
      return;
    }
    if (receipt) {
      if (receipt.status && receipt.status === 0) {
        // TODO record Error ?
      }
      if (receipt.confirmations == finality) {
        // TODO finality
        deleteCapture(location); // TODO pending
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
        !$data.walletAddress ||
        $data.walletAddress.toLowerCase() !== address.toLowerCase() ||
        $data.chainId !== chainId
      ) {
        return;
      }
      if (finalNonce > capture.nonce) {
        // TODO check equality or not
        deleteCapture(location);
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
  if (!wallet.provider) {
    throw new Error(`no wallet.provider`);
  }
  const latestBlock = await wallet.provider.getBlock('latest');
  const latestBlockNumber = latestBlock.number;

  const latestFinalityBlock = await wallet.provider.getBlock(
    latestBlockNumber - finality
  );
  if (!$data.data) {
    return;
  }
  const fleetIds = Object.keys($data.data.fleets);
  for (const fleetId of fleetIds) {
    const fleet = $data.data.fleets[fleetId];
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
      !$data.walletAddress ||
      $data.walletAddress.toLowerCase() !== address.toLowerCase() ||
      $data.chainId !== chainId
    ) {
      return;
    }

    if (
      fleet.resolveTxHash &&
      currentFleetData &&
      currentFleetData.launchTime > 0
    ) {
      if (currentFleetData.quantity == 0) {
        _txPerformed[fleet.resolveTxHash] = true;
      } else {
        _txPerformed[fleet.resolveTxHash] = false;
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
          deleteFleet(fleetId);
          continue;
        }
      }
    }

    if (fleetData && fleetData.launchTime > 0) {
      const launchTime = fleetData.launchTime;
      if (fleetData.quantity === 0) {
        // TODO use resolveTxHash instead ? // this would allow resolve to clear storage in OuterSpace.sol
        deleteFleet(fleetId);
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
          deleteFleet(fleetId);
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

async function login(): Promise<void> {
  await execute();
}

let _promise: Promise<void> | undefined;
let _resolve: (() => void) | undefined;
let _reject: ((error: unknown) => void) | undefined;
let _func: (() => Promise<void>) | undefined;
let _contracts: Contracts | undefined;

async function confirm(): Promise<void> {
  _set({step: 'SIGNATURE_REQUESTED'});
  if (!wallet.provider) {
    throw new Error(`no wallet.provider`);
  }
  if (!wallet.address) {
    throw new Error(`no wallet.address`);
  }
  if (!wallet.chain.chainId) {
    throw new Error(`no chainId, not connected?`);
  }
  try {
    const walletAddress = wallet.address.toLowerCase();
    const signature = await wallet.provider
      .getSigner()
      .signMessage('Only sign this message on "planet-wars"');
    const privateWallet = new Wallet(signature.slice(0, 130));
    const aesKeySignature = await privateWallet.signMessage('AES KEY');
    const aesKey = aes.utils.hex.toBytes(aesKeySignature.slice(2, 66)); // TODO mix ?
    walletData[walletAddress] = {wallet: privateWallet, aesKey};

    _set({step: 'LOADING'});

    _set({step: 'READY', wallet: privateWallet, aesKey});

    await _loadData(walletAddress, wallet.chain.chainId);

    if (_func) {
      await _func();
    }
  } catch (e) {
    _set({step: 'IDLE', wallet: undefined, aesKey: undefined});
    _reject && _reject(e);
    _resolve = undefined;
    _reject = undefined;
    _promise = undefined;
    _contracts = undefined;
    return;
  }
  _resolve && _resolve();
  _resolve = undefined;
  _reject = undefined;
  _promise = undefined;
  _contracts = undefined;
}

function execute(
  func?: (contracts: Contracts) => Promise<void>
): Promise<Contracts> {
  if (_promise) {
    return _promise.then(() => _contracts as Contracts); // TODO check _contracts undefined case
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
  if (!wallet.address) {
    throw new Error(`no wallet.address`);
  }
  if (!wallet.chain.chainId) {
    throw new Error(`no chainId, not connected?`);
  }
  if (!$data.data) {
    $data.data = {fleets: {}, exits: {}, captures: {}}; // TODO everywhere
  }
  const exits = $data.data.exits;
  exits[location + '_' + timestamp] = timestamp;
  _set({
    data: $data.data,
  });
  _setData(wallet.address, wallet.chain.chainId, $data.data);
}

function recordWithdrawal(loctions: string[], txHash: string) {
  // TODO
}

function recordCapture(
  location: string,
  txHash: string,
  time: number,
  nonce: number
) {
  if (!wallet.address) {
    throw new Error(`no wallet.address`);
  }
  if (!wallet.chain.chainId) {
    throw new Error(`no chainId, not connected?`);
  }
  console.log(`record capture ${location}`);
  if (!$data.data) {
    $data.data = {fleets: {}, exits: {}, captures: {}}; // TODO everywhere
  }
  const captures = $data.data.captures;
  captures[location] = {
    txHash,
    time,
    nonce,
  };
  _set({
    data: $data.data,
  });
  _setData(wallet.address, wallet.chain.chainId, $data.data);
}

function deleteCapture(id: string) {
  if (!wallet.address) {
    throw new Error(`no wallet.address`);
  }
  if (!wallet.chain.chainId) {
    throw new Error(`no chainId, not connected?`);
  }
  console.log(`delete capture ${id}`);
  if (!$data.data) {
    return;
  }
  const captures = $data.data.captures;
  delete captures[id];
  _set({
    data: $data.data,
  });
  _setData(wallet.address, wallet.chain.chainId, $data.data, [], [], [id]);
}

function deleteExit(id: string) {
  if (!wallet.address) {
    throw new Error(`no wallet.address`);
  }
  if (!wallet.chain.chainId) {
    throw new Error(`no chainId, not connected?`);
  }
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
  if (!wallet.address) {
    throw new Error(`no wallet.address`);
  }
  if (!wallet.chain.chainId) {
    throw new Error(`no chainId, not connected?`);
  }
  if (!$data.data) {
    $data.data = {fleets: {}, exits: {}, captures: {}};
  }
  const fleets = $data.data.fleets;
  fleets[fleetId] = fleet;
  _set({
    data: $data.data,
  });
  _setData(wallet.address, wallet.chain.chainId, $data.data);
}

function deleteFleet(fleetId: string) {
  if (!wallet.address) {
    throw new Error(`no wallet.address`);
  }
  if (!wallet.chain.chainId) {
    throw new Error(`no chainId, not connected?`);
  }
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
  if (!$data.wallet) {
    throw new Error(`no $data.wallet`);
  }
  // TODO cache
  return keccak256(
    ['bytes32', 'bytes32'],
    [
      $data.wallet.privateKey.slice(0, 66),
      '0x' + $data.wallet.privateKey.slice(66, 130),
    ]
  );
}

async function hashFleet(
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
    [_hashString(), randomNonce]
  );
  console.log({secretHash});
  const toHash = keccak256(['bytes32', 'uint256'], [secretHash, toString]);
  const fleetId = keccak256(['bytes32', 'uint256'], [toHash, fromString]);
  return {toHash, fleetId, secret: secretHash};
}

function fleetSecret(fleetId: string): string {
  if (!$data.data) {
    throw new Error(`no $data.data`);
  }
  return $data.data.fleets[fleetId].secret;
}

function recordFleetResolvingTxhash(fleetId: string, txHash: string): void {
  if (!wallet.address) {
    throw new Error(`no wallet.address`);
  }
  if (!wallet.chain.chainId) {
    throw new Error(`no chainId, not connected?`);
  }
  if (!$data.data) {
    $data.data = {fleets: {}, exits: {}, captures: {}};
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

function isTxPerformed(txHash?: string): boolean {
  if (!txHash) {
    return false;
  }
  return _txPerformed[txHash];
}

function isCapturing(location: string): boolean {
  if (!$data.data) {
    return false;
  }
  return (
    $data.data &&
    $data.data.captures[location] &&
    $data.data.captures[location].txHash !== null
  );
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
  recordCapture,
  isCapturing,
  get privateWallet() {
    return $data.wallet;
  },
  hashFleet,
  fleetSecret,
  getFleets,
  getFleet,
  isTxPerformed,
  get walletAddress() {
    return $data.walletAddress;
  },
  clearData,
};

/* eslint-disable @typescript-eslint/no-explicit-any */
if (typeof window !== 'undefined') {
  (window as any).privateAccount = dataStore;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
