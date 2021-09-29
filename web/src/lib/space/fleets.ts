import {account} from '$lib/account/account';
import type {SpaceQueryWithPendingState, SyncedPendingAction} from '$lib/space/optimisticSpace';
import {spaceQueryWithPendingActions} from '$lib/space/optimisticSpace';
import {now, time} from '$lib/time';
import type {SpaceInfo, PlanetInfo} from 'conquest-eth-common';
import type {Readable, Writable} from 'svelte/store';
import {writable} from 'svelte/store';
import {spaceInfo} from './spaceInfo';

export type FleetState =
  | 'LOADING'
  | 'SEND_BROADCASTED'
  | 'TRAVELING'
  | 'READY_TO_RESOLVE'
  | 'TOO_LATE_TO_RESOLVE'
  | 'RESOLVE_BROADCASTED'
  | 'WAITING_ACKNOWLEDGMENT';

// object representing a fleet (publicly)
export type Fleet = {
  txHash: string; // TODO better id
  from: PlanetInfo;
  to: PlanetInfo;
  quantity: number; // not needed to store, except to not require contract fetch
  duration: number;
  launchTime: number;
  amountDestroyed: number;
  timeLeft: number; // not needed to store, except to not require computing stats from from planet
  timeToResolve: number;
  sending: {
    id: string;
    status: 'SUCCESS' | 'FAILURE' | 'LOADING' | 'PENDING' | 'CANCELED' | 'TIMEOUT';
    action: {nonce: number; timestamp: number; queueID?: string};
  }; // TODO use pendingaction type
  resolution?: {
    id: string;
    status: 'SUCCESS' | 'FAILURE' | 'LOADING' | 'PENDING' | 'CANCELED' | 'TIMEOUT';
    action: {nonce: number; timestamp: number};
  }; // TODO use pendingaction type
  state: FleetState;
};

export class FleetsStore implements Readable<Fleet[]> {
  private readonly spaceInfo: SpaceInfo;
  private store: Writable<Fleet[]>;
  private fleets: Fleet[] = [];

  constructor(spaceInfo: SpaceInfo) {
    this.spaceInfo = spaceInfo;
    this.store = writable(this.fleets, this._start.bind(this));
  }

  _start(): void {
    time.subscribe(this.onTime.bind(this));
    spaceQueryWithPendingActions.subscribe(this.onSpaceUpdate.bind(this));
  }

  private onTime() {
    for (const fleet of this.fleets) {
      fleet.timeLeft = Math.max(fleet.duration - (now() - fleet.launchTime), 0);
      if (fleet.timeLeft <= 0) {
        fleet.timeToResolve = Math.max(fleet.launchTime + fleet.duration + spaceInfo.resolveWindow - now(), 0);
      }
    }
    this.store.set(this.fleets);
  }

  private onSpaceUpdate(update: SpaceQueryWithPendingState): void {
    this.fleets.length = 0;
    for (const pendingAction of update.pendingActions) {
      if (pendingAction.action.type === 'SEND') {
        const sendAction = pendingAction.action;
        // TODO
        if (pendingAction.status === 'FAILURE') {
        } else if (pendingAction.status === 'CANCELED') {
        } else if (pendingAction.status === 'TIMEOUT') {
        } else {
          const from = spaceInfo.getPlanetInfo(sendAction.from.x, sendAction.from.y);
          const to = spaceInfo.getPlanetInfo(sendAction.to.x, sendAction.to.y);
          const duration = spaceInfo.timeToArrive(from, to);
          let launchTime = now(); // TODO  update.queryState.data?.chain.timestamp ?
          if (sendAction.actualLaunchTime) {
            launchTime = sendAction.actualLaunchTime;
          } else if (pendingAction.txTimestamp) {
            launchTime = pendingAction.txTimestamp;
            account.recordFleetLaunchTime(pendingAction.id, launchTime);
          }

          const timeLeft = Math.max(duration - (now() - launchTime), 0);
          let timeToResolve = 0;

          let state: FleetState = 'SEND_BROADCASTED';
          if (pendingAction.status === 'SUCCESS') {
            state = 'TRAVELING';
            if (timeLeft <= 0) {
              state = 'READY_TO_RESOLVE';
              timeToResolve = Math.max(launchTime + duration + spaceInfo.resolveWindow - now(), 0);
              if (timeToResolve <= 0) {
                state = 'TOO_LATE_TO_RESOLVE';
              }
            }
          } else if (pendingAction.status === 'LOADING') {
            state = 'LOADING';
          }

          let resolution: SyncedPendingAction | undefined;
          if (sendAction.resolution) {
            // console.log('RESOLUTION', sendAction.resolution);
            // TODO handle multiple resolution
            const pendingResolution = update.pendingActions.find((v) => v.id === sendAction.resolution[0]);
            if (pendingResolution) {
              resolution = pendingResolution;
              state = 'RESOLVE_BROADCASTED';

              if (pendingResolution.action.acknowledged) {
                continue; // alterady acknowledged
              }

              if (resolution.status === 'SUCCESS' || resolution.counted) {
                // TODO error
                state = 'WAITING_ACKNOWLEDGMENT';
                // continue; // acknowledgement go through events // TODO enable even though but should be required
              }
            } else {
              // TODO error ?
            }
          }
          // console.log({state})
          if (!(resolution && resolution.action.acknowledged)) {
            this.fleets.push({
              txHash: pendingAction.id, // TODO better id
              from,
              to,
              duration,
              quantity: sendAction.quantity,
              launchTime,
              amountDestroyed: 0, // TODO
              timeLeft,
              timeToResolve,
              sending: pendingAction,
              resolution,
              state,
            });
          }
        }
      }
    }

    this.store.set(this.fleets);
  }

  subscribe(run: (value: Fleet[]) => void, invalidate?: (value?: Fleet[]) => void): () => void {
    return this.store.subscribe(run, invalidate);
  }
}

export const fleets = new FleetsStore(spaceInfo);

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).fleets = fleets;
}
