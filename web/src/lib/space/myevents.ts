// import { account } from '$lib/account/account';
// import type { CheckedPendingAction } from '$lib/account/pendingActions';
// import {
//   spaceQueryWithPendingActions,
//   SpaceQueryWithPendingState
// } from '$lib/space/optimisticSpace';
// import {now, time} from '$lib/time';
import type { SpaceInfo } from 'conquest-eth-common';
// import { writable, Writable } from 'svelte/store';
import {spaceInfo} from './spaceInfo';

export class MyEventsStore {
  private readonly spaceInfo: SpaceInfo;

  constructor(spaceInfo: SpaceInfo) {
    this.spaceInfo = spaceInfo;
  }


}

export const myevents = new MyEventsStore(spaceInfo);

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).myevents = myevents;
}

