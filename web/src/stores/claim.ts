import {writable} from 'svelte/store';
import {wallet} from './wallet';
import privateAccount from './privateAccount';
import {BigNumber} from '@ethersproject/bignumber';
import type {PlanetInfo} from 'planet-wars-common';

type ClaimData = {txHash?: string; planet: PlanetInfo};

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
    if ($data[key] && typeof obj[key] === 'object') {
      for (const subKey of Object.keys(obj[key])) {
        // TODO recursve
        $data[key][subKey] = obj[key][subKey];
      }
    } else {
      $data[key] = obj[key];
    }
  }
  set($data);
  return $data;
}

function _reset() {
  _set({step: 'IDLE', data: undefined});
}

let dataStore;
export default dataStore = {
  subscribe,

  async cancel(): Promise<void> {
    _reset();
  },

  async acknownledgeSuccess(): Promise<void> {
    // TODO automatic ?
    _reset();
  },

  async claim(planet: PlanetInfo): Promise<void> {
    _set({data: {planet}, step: 'CONNECTING'});
    await privateAccount.login();
    _set({step: 'CHOOSE_STAKE'});
  },

  async confirm(): Promise<void> {
    const flow = _set({step: 'WAITING_TX'});
    const tx = await wallet.contracts.OuterSpace.acquire(
      flow.data.planet.location.id
    );
    _set({
      step: 'SUCCESS',
      data: {txHash: tx.hash},
    });
  },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
if (typeof window !== 'undefined') {
  (window as any).flow_claim = dataStore;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
