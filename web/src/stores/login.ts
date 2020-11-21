import {writable} from 'svelte/store';
import {wallet, flow} from './wallet';
import {Wallet} from '@ethersproject/wallet';
import type { Contract } from '@ethersproject/contracts';
import {keccak256} from '@ethersproject/solidity';

type LoginData = {wallet?: Wallet, step: "READY" | "CONNECTING" | "SIGNATURE_REQUIRED" | "SIGNATURE_REQUESTED" | "IDLE"};

const $data: LoginData = {
  wallet: undefined,
  step: "IDLE"
}
const {subscribe, set} = writable($data);

function _set(
  obj: Partial<LoginData>
): LoginData {
  for (const key of Object.keys(obj)) {
    $data[key] = obj[key];
  }
  set($data);
  return $data;
}

const walletData: Record<string, {wallet: Wallet}> = {};

type Contracts = {
  [name: string]: Contract;
};

wallet.subscribe(($wallet) => {
  if($wallet.address) {
    const existingData = walletData[$wallet.address.toLowerCase()];
    if (existingData) {
      _set({step: "READY", wallet: existingData.wallet});
    } else {
      _set({wallet: undefined});
      if ($data.step === 'READY') {
        _set({step: 'IDLE'});
      }
    }
  } else {
    _set({wallet: undefined});
    if ($data.step === 'READY') {
      _set({step: 'IDLE'});
    }
  }
})

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
    const signature = await wallet.provider.getSigner().signMessage('Only sign this message on "planet-wars"');
    const privateWallet = new Wallet(signature.slice(0,130));
    walletData[walletAddress] = {wallet: privateWallet};
    _set({step: "READY", wallet: privateWallet});
    if (_func) {
      await _func();
    }
  } catch(e) {
    _set({step: "IDLE", wallet: undefined});
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

function execute(func?: (contracts: Contracts) => Promise<void>): Promise<Contracts> {
  if (_promise) {
    return _promise.then(() => _contracts);
  }
  // TODO if already connected skip
  if ($data.step !== 'READY') {
    _set({step: 'CONNECTING'});
  }

  return flow.execute((contracts: Contracts): Promise<void> => {
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
  });
}

let dataStore;
export default dataStore = {
  subscribe,
  login,
  confirm,
  execute,
  get privateWallet() {
    return $data.wallet
  },
  async getHashString() {
    return keccak256(["bytes32", "bytes32"], [$data.wallet.privateKey.slice(0,66), "0x" + $data.wallet.privateKey.slice(66, 130)]); // TODO use different key
  }
};

/* eslint-disable @typescript-eslint/no-explicit-any */
if (typeof window !== 'undefined') {
  (window as any).login = dataStore;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
