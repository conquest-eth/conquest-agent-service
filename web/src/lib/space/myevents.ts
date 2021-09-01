import type { SpaceInfo } from 'conquest-eth-common';
import type { Readable, Writable } from 'svelte/store';
import {writable} from 'svelte/store';
import {spaceInfo} from './spaceInfo';
import type {
  SpaceQueryWithPendingState
} from '$lib/space/optimisticSpace';
import {
  spaceQueryWithPendingActions,
} from '$lib/space/optimisticSpace';
import type {AccountState} from '$lib/account/account';
import { account } from '$lib/account/account';
import type { FleetArrived } from './spaceQuery';

export type MyEventType = 'external_fleet' | 'internal_fleet';

export type MyEvent = {
  type: MyEventType;
  event: FleetArrived
}

export class MyEventsStore implements Readable<MyEvent[]> {
  private readonly spaceInfo: SpaceInfo;
  private store: Writable<MyEvent[]>;
  private events: MyEvent[] = [];

  constructor(spaceInfo: SpaceInfo) {
    this.spaceInfo = spaceInfo;
    this.store = writable(this.events);
    spaceQueryWithPendingActions.subscribe(this.onSpaceUpdate.bind(this))
    account.subscribe(this._handleAccountChange.bind(this));
  }

  private onSpaceUpdate(update: SpaceQueryWithPendingState): void {
    this.events.length = 0;
    // TODO get access to update.accountAddress
    if (update.queryState.data?.fleetsArrivedFromYou) {
      for (const fleetArrived of update.queryState.data.fleetsArrivedFromYou) {
        this.events.push({
          type: 'internal_fleet',
          event: fleetArrived
        })
      }
      for (const fleetArrived of update.queryState.data.fleetsArrivedToYou) {
        this.events.push({
          type: 'external_fleet',
          event: fleetArrived
        })
      }
    }

    this.store.set(this.events);
  }

  private async _handleAccountChange($account: AccountState): Promise<void> {
    // TODO $account.data.acknowledgements
  }

  subscribe(run: (value: MyEvent[]) => void, invalidate?: (value?: MyEvent[]) => void): () => void {
    return this.store.subscribe(run, invalidate);
  }

}

export const myevents = new MyEventsStore(spaceInfo);

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).myevents = myevents;
}

