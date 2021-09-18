import type {SpaceInfo} from 'conquest-eth-common';
import type {Readable, Writable} from 'svelte/store';
import {writable} from 'svelte/store';
import {spaceInfo} from './spaceInfo';
import type {SpaceQueryWithPendingState} from '$lib/space/optimisticSpace';
import {spaceQueryWithPendingActions} from '$lib/space/optimisticSpace';
import type {AccountState, Acknowledgements, PendingActions} from '$lib/account/account';
import {account} from '$lib/account/account';
import type {FleetArrived} from './spaceQuery';

export type MyEventType = 'external_fleet' | 'internal_fleet';

export type MyEvent = {
  type: MyEventType;
  event: FleetArrived;
  acknowledged?: 'NO' | 'YES' | 'UPDATED_SINCE';
};

export class MyEventsStore implements Readable<MyEvent[]> {
  private readonly spaceInfo: SpaceInfo;
  private store: Writable<MyEvent[]>;
  private events: MyEvent[] = [];
  private currentOwner: string;
  private tmpEvents: MyEvent[] = [];
  private tmpPlayer: string;
  private acknowledgements: Acknowledgements;
  private pendingActions: PendingActions;

  constructor(spaceInfo: SpaceInfo) {
    this.spaceInfo = spaceInfo;
    this.store = writable(this.events);
    spaceQueryWithPendingActions.subscribe(this.onSpaceUpdate.bind(this));
    account.subscribe(this._handleAccountChange.bind(this));
  }

  private onSpaceUpdate(update: SpaceQueryWithPendingState): void {
    const newEvents = [];
    // TODO get access to update.accountAddress
    if (update.queryState.data?.fleetsArrivedFromYou) {
      for (const fleetArrived of update.queryState.data.fleetsArrivedFromYou) {
        newEvents.push({
          type: 'internal_fleet',
          event: fleetArrived,
        });
      }
      for (const fleetArrived of update.queryState.data.fleetsArrivedToYou) {
        newEvents.push({
          type: 'external_fleet',
          event: fleetArrived,
        });
      }
    }

    const newPlayer = update.queryState.data?.player;
    if (this.currentOwner !== newPlayer) {
      this.tmpPlayer = newPlayer;
      this.tmpEvents = newEvents;
      this.events.length = 0;
      // TODO loading ?
    } else {
      this.events = this.addAcknowledgements(newEvents);
    }

    this.store.set(this.events);
  }

  private addAcknowledgements(events: MyEvent[]): MyEvent[] {
    for (const event of events) {
      const acknowledgment = this.acknowledgements && this.acknowledgements[event.event.fleet.id];
      if (!acknowledgment) {
        if (event.type === 'internal_fleet') {
          const pendingAction = this.pendingActions && this.pendingActions[event.event.transaction.id];
          if (!pendingAction || typeof pendingAction === 'number') {
            event.acknowledged = 'YES';
          } else if (pendingAction.acknowledged) {
            event.acknowledged = 'YES';
          } else {
            event.acknowledged = 'NO';
          }
        } else {
          event.acknowledged = 'NO';
        }
      } else {
        const eventStateHash = event.event.planetLoss + ':' + event.event.fleetLoss + ':' + event.event.won;
        if (acknowledgment.stateHash !== eventStateHash) {
          event.acknowledged = 'UPDATED_SINCE';
        } else {
          event.acknowledged = 'YES';
        }
      }
    }
    return events;
  }

  private async _handleAccountChange($account: AccountState): Promise<void> {
    const newPlayer = $account.ownerAddress?.toLowerCase();
    this.acknowledgements = $account.data?.acknowledgements;
    this.pendingActions = $account.data?.pendingActions;

    if (this.currentOwner === newPlayer) {
      this.events = this.addAcknowledgements(this.events);
    } else if (newPlayer === this.tmpPlayer) {
      this.currentOwner = newPlayer;
      this.events = this.addAcknowledgements(this.tmpEvents);
    } else {
      this.currentOwner = newPlayer;
      this.events = [];
      // TODO loading
    }

    this.store.set(this.events);
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
