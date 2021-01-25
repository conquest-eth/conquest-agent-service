import {writable} from 'svelte/store';
import {wallet} from './wallet';
import privateAccount from './privateAccount';

type ClaimData = {txHash?: string; location: string};

export type ClaimFlow<T> = {
  type: 'CLAIM';
  step:
    | 'IDLE'
    | 'CONNECTING'
    | 'CHOOSE_STAKE'
    | 'CREATING_TX'
    | 'WAITING_TX'
    | 'SUCCESS';
  data?: T;
};

const $data: ClaimFlow<ClaimData> = {
  type: 'CLAIM',
  step: 'IDLE',
};
const {subscribe, set} = writable($data);

function _set(
  obj: Partial<ClaimFlow<Partial<ClaimData>>>
): ClaimFlow<ClaimData> {
  for (const key of Object.keys(obj)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const objTyped = obj as Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = $data as Record<string, any>;
    if (data[key] && typeof objTyped[key] === 'object') {
      const subObj: Record<string, unknown> = objTyped[key] as Record<
        string,
        unknown
      >;
      if (typeof subObj === 'object') {
        for (const subKey of Object.keys(subObj as Record<string, unknown>)) {
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

export default {
  subscribe,

  async cancel(): Promise<void> {
    _reset();
  },

  async acknownledgeSuccess(): Promise<void> {
    // TODO automatic ?
    _reset();
  },

  async claim(location: string): Promise<void> {
    _set({data: {location}, step: 'CONNECTING'});
    await privateAccount.login();
    _set({step: 'CHOOSE_STAKE'});
  },

  async confirm(): Promise<void> {
    const flow = _set({step: 'WAITING_TX'});
    if (!flow.data) {
      throw new Error(`no flow data`);
    }
    const latestBlock = await wallet.provider?.getBlock('latest');
    if (!latestBlock) {
      throw new Error(`can't fetch latest block`);
    }
    const tx = await wallet.contracts?.OuterSpace.acquire(flow.data?.location);

    privateAccount.recordCapture(
      flow.data.location,
      tx.hash,
      latestBlock.timestamp,
      tx.nonce
    ); // TODO check
    _set({
      step: 'SUCCESS',
      data: {txHash: tx.hash},
    });
  },
};
