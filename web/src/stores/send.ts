import {writable} from 'svelte/store';
import {wallet} from './wallet';
import privateAccount from './privateAccount';
import {xyToLocation} from 'planet-wars-common';
import {BigNumber} from '@ethersproject/bignumber';
import {spaceInfo} from '../app/mapState';

type SendData = {
  txHash?: string;
  to: {x: number; y: number};
  from: {x: number; y: number};
  fleet: number;
};

export type SendFlow<T> = {
  type: 'SEND';
  step:
    | 'IDLE'
    | 'CONNECTING'
    | 'PICK_DESTINATION'
    | 'PICK_ORIGIN'
    | 'CHOOSE_FLEET_AMOUNT'
    | 'CREATING_TX'
    | 'WAITING_TX'
    | 'SUCCESS';
  data?: T;
};

const $data: SendFlow<SendData> = {
  type: 'SEND',
  step: 'IDLE',
};
const {subscribe, set} = writable($data);

function _set(obj: Partial<SendFlow<Partial<SendData>>>): SendFlow<SendData> {
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

async function cancel(): Promise<void> {
  _reset();
}

async function acknownledgeSuccess(): Promise<void> {
  // TODO automatic ?
  _reset();
}

async function sendFrom(from: {x: number; y: number}): Promise<void> {
  if ($data.step == 'PICK_ORIGIN') {
    pickOrigin(from);
  } else {
    _set({data: {from}, step: 'CONNECTING'});
    await privateAccount.login();
    _set({step: 'PICK_DESTINATION'});
  }
}

async function sendTo(to: {x: number; y: number}): Promise<void> {
  if ($data.step == 'PICK_DESTINATION') {
    pickDestination(to);
  } else {
    _set({data: {to}, step: 'CONNECTING'});
    await privateAccount.login();
    _set({step: 'PICK_ORIGIN'});
  }
}

async function pickDestination(to: {x: number; y: number}): Promise<void> {
  if ($data.step !== 'PICK_DESTINATION') {
    throw new Error(`Need to be in step PICK_DESTINATION`);
  }
  _set({data: {to}, step: 'CHOOSE_FLEET_AMOUNT'});
}

async function pickOrigin(from: {x: number; y: number}): Promise<void> {
  if ($data.step !== 'PICK_ORIGIN') {
    throw new Error(`Need to be in step PICK_ORIGIN`);
  }
  _set({data: {from}, step: 'CHOOSE_FLEET_AMOUNT'});
}

async function confirm(fleetAmount: number): Promise<void> {
  const flow = _set({step: 'CREATING_TX'});
  const from = flow.data.from;
  const to = flow.data.to;
  const {toHash, fleetId, secret} = await privateAccount.hashFleet(from, to);

  _set({step: 'WAITING_TX'});
  const tx = await wallet.contracts.OuterSpace.send(
    xyToLocation(from.x, from.y),
    fleetAmount,
    toHash
  );
  const fromPlanetInfo = spaceInfo.getPlanetInfo(from.x, from.y);
  const toPlanetInfo = spaceInfo.getPlanetInfo(to.x, to.y);
  const gToX = toPlanetInfo.location.globalX;
  const gToY = toPlanetInfo.location.globalY;
  const gFromX = fromPlanetInfo.location.globalX;
  const gFromY = fromPlanetInfo.location.globalY;
  const speed = fromPlanetInfo.stats.speed;
  const fullDistance = Math.floor(
    Math.sqrt(Math.pow(gToX - gFromX, 2) + Math.pow(gToY - gFromY, 2))
  );
  const fleetDuration = fullDistance * ((spaceInfo.timePerDistance * 10000) / speed);

  privateAccount.recordFleet(fleetId, {
    to,
    from,
    fleetAmount,
    duration: fleetDuration, // TODO stricly speaking not necessary but allow us to not need to refetch the stats from spaceInfo
    launchTime: Math.floor(Date.now() / 1000), //TODO adjust + service to adjust once tx is mined // use block time instead of Date.now
    owner: wallet.address,
    sendTxHash: tx.hash,
    secret: secret
  });

  _set({
    step: 'SUCCESS',
    data: {txHash: tx.hash},
  });

  // TODO REMOVE DEBUG :
  // await tx.wait();
  // // TODO distance
  // // const distanceSquared =
  // //   Math.pow(to.location.globalX - from.location.globalX, 2) +
  // //   Math.pow(to.location.globalY - from.location.globalY, 2);
  // const distance = 1; // TODO Math.floor(Math.sqrt(distanceSquared));
  // await wallet.contracts.OuterSpace.resolveFleet(
  //   fleetId,
  //   xyToLocation(to.x, to.y),
  //   distance,
  //   secretHash
  // );
}

let dataStore;
export default dataStore = {
  subscribe,
  cancel,
  acknownledgeSuccess,
  sendTo,
  sendFrom,
  pickDestination,
  pickOrigin,
  confirm,
};

/* eslint-disable @typescript-eslint/no-explicit-any */
if (typeof window !== 'undefined') {
  (window as any).flow_send = dataStore;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
