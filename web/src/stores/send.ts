import {writable} from 'svelte/store';
import {wallet} from './wallet';
import login from './login';
import secret from './secret';
import {xyToLocation} from 'planet-wars-common';
import {BigNumber} from '@ethersproject/bignumber';
import {keccak256} from '@ethersproject/solidity';

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
    await login.login();
    _set({step: 'PICK_DESTINATION'});
  }
}

async function sendTo(to: {x: number; y: number}): Promise<void> {
  if ($data.step == 'PICK_DESTINATION') {
    pickDestination(to);
  } else {
    _set({data: {to}, step: 'CONNECTING'});
    await login.login();
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
  const flow = _set({step: 'WAITING_TX'});
  const from = flow.data.from;
  const to = flow.data.to;
  const toString = xyToLocation(to.x, to.y);
  const subId =
    '0x' +
    ((crypto.getRandomValues(new Uint8Array(10)) as unknown) as number[])
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  const fleetId = BigNumber.from(subId)
    .add(BigNumber.from(wallet.address).shl(96))
    .toHexString();
  const hashString = await login.getHashString();
  const secretHash = keccak256(['bytes32', 'uint88'], [hashString, subId]);
  const toHash = keccak256(['bytes32', 'uint256'], [secretHash, toString]);
  console.log({secretHash, toString, toHash});
  const tx = await wallet.contracts.OuterSpace.send(
    subId,
    xyToLocation(from.x, from.y),
    fleetAmount,
    toHash
  );
  secret.recordFleet(fleetId, {to, from, fleetAmount});
  _set({
    step: 'SUCCESS',
    data: {txHash: tx.hash},
  });

  // TODO REMOVE DEBUG :
  // await tx.wait();
  // // TODO distance
  // // const distanceSquared =
  // //   Math.pow(to.location.x - from.location.globalX, 2) +
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
