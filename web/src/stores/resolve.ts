import {writable} from 'svelte/store';
import {wallet} from './wallet';
import privateAccount from './privateAccount';
import {xyToLocation} from '../common/src';
import {spaceInfo} from '../app/mapState';

// type ResolveData = {};

export type ResolveFlow = {
  type: 'RESOLVE';
  step: 'IDLE' | 'CONNECTING' | 'CREATING_TX' | 'WAITING_TX' | 'SUCCESS';
  // data?: T;
};

const $data: ResolveFlow = {
  type: 'RESOLVE',
  step: 'IDLE',
};
const {subscribe, set} = writable($data);

function _set(obj: Partial<ResolveFlow>): ResolveFlow {
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
  _set({step: 'IDLE'});
}

async function cancel(): Promise<void> {
  _reset();
}

async function acknownledgeSuccess(): Promise<void> {
  // TODO automatic ?
  _reset();
}

async function resolve(fleetId: string): Promise<void> {
  _set({step: 'CONNECTING'});
  await privateAccount.login();
  _set({step: 'CREATING_TX'});
  const fleet = privateAccount.getFleet(fleetId);
  if (!fleet) {
    throw new Error(`no fleet with id ${fleetId}`);
  }
  const secretHash = privateAccount.fleetSecret(fleetId);
  console.log('resolve', {secretHash});
  const to = spaceInfo.getPlanetInfo(fleet.to.x, fleet.to.y);
  const from = spaceInfo.getPlanetInfo(fleet.from.x, fleet.from.y);
  if (!from || !to) {
    throw new Error(`cannot get from or to`);
  }
  const distanceSquared =
    Math.pow(to.location.globalX - from.location.globalX, 2) +
    Math.pow(to.location.globalY - from.location.globalY, 2);
  const distance = Math.floor(Math.sqrt(distanceSquared));
  _set({step: 'WAITING_TX'});
  const tx = await wallet.contracts?.OuterSpace.resolveFleet(
    fleetId,
    xyToLocation(fleet.from.x, fleet.from.y),
    xyToLocation(fleet.to.x, fleet.to.y),
    distance,
    secretHash
  );
  privateAccount.recordFleetResolvingTxhash(fleetId, tx.hash);
  _set({step: 'SUCCESS'}); // TODO IDLE ?
}

export default {
  subscribe,
  cancel,
  acknownledgeSuccess,
  resolve,
  confirm,
};
