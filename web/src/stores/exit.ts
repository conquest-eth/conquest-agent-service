import {writable} from 'svelte/store';
import {wallet} from './wallet';
import privateAccount from './privateAccount';
import {xyToLocation} from 'planet-wars-common';

type ExitData = {
  txHash?: string;
  location: {x: number; y: number};
};

export type ExitFlow<T> = {
  type: 'EXIT';
  step:
    | 'IDLE'
    | 'CONNECTING'
    | 'WAITING_CONFIRMATION'
    | 'WAITING_TX'
    | 'SUCCESS';
  data?: T;
  error?: unknown; // TODO
};

const $data: ExitFlow<ExitData> = {
  type: 'EXIT',
  step: 'IDLE',
};
const {subscribe, set} = writable($data);

function _set(obj: Partial<ExitFlow<Partial<ExitData>>>): ExitFlow<ExitData> {
  for (const key of Object.keys(obj)) {
    const objTyped = obj as Record<string, any>;
    const data = $data as Record<string, any>;
    if (data[key] && typeof objTyped[key] === 'object') {
      const subObj: Record<string, unknown> = objTyped[key] as Record<
        string,
        unknown
      >;
      if (typeof subObj === 'object') {
        for (const subKey of Object.keys(subObj as {})) {
          // TODO recursve
          data[key][subKey] = subObj[subKey];
        }
      }
    } else {
      data[key] = objTyped[key];
    }
  }
  set($data);
  return $data;
}

function _reset() {
  _set({step: 'IDLE', data: undefined});
}

async function cancel(): Promise<void> {
  _reset();
}

async function acknownledgeSuccess(): Promise<void> {
  _reset();
}

async function exitFrom(location: {x: number; y: number}): Promise<void> {
  _set({data: {location}, step: 'CONNECTING'});
  await privateAccount.login();
  _set({step: 'WAITING_CONFIRMATION'});
}

async function confirm(): Promise<void> {
  const flow = _set({step: 'WAITING_TX'});
  if (!flow.data) {
    throw new Error(`no flow data`);
  }
  const location = flow.data.location;
  const locationId = xyToLocation(location.x, location.y);
  const latestBlock = await wallet.provider?.getBlock('latest');
  if (!latestBlock) {
    throw new Error(`can't fetch latest block`);
  }
  let tx: {hash: string};
  try {
    tx = await wallet.contracts?.OuterSpace.exitFor(wallet.address, locationId);
  } catch (e) {
    _set({
      step: 'WAITING_CONFIRMATION',
      error: e,
    });
    return;
  }

  privateAccount.recordExit(locationId, latestBlock.timestamp);

  _set({
    step: 'SUCCESS',
    data: {txHash: tx.hash},
  });
}

let dataStore;
export default dataStore = {
  subscribe,
  cancel,
  acknownledgeSuccess,
  exitFrom,
  confirm,
};

/* eslint-disable @typescript-eslint/no-explicit-any */
if (typeof window !== 'undefined') {
  (window as any).flow_exit = dataStore;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
