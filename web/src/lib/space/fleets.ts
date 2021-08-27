import { account } from '$lib/account/account';
import type { CheckedPendingAction } from '$lib/account/pendingActions';
import {
  spaceQueryWithPendingActions,
  SpaceQueryWithPendingState
} from '$lib/space/optimisticSpace';
import {now, time} from '$lib/time';
import type { Fleet, SpaceInfo } from 'conquest-eth-common';
import { writable, Writable } from 'svelte/store';
import {spaceInfo} from './spaceInfo';

export class FleetsStore {
  private readonly spaceInfo: SpaceInfo;
  private store: Writable<Fleet[]>;
  private fleets: Fleet[] = [];

  constructor(spaceInfo: SpaceInfo) {
    this.spaceInfo = spaceInfo;
    this.store = writable(this.fleets);
  }

  start(): void {
    time.subscribe(this.onTime.bind(this));
    spaceQueryWithPendingActions.subscribe(this.onSpaceUpdate.bind(this));
  }

  private onTime() {
    for (const fleet of this.fleets) {
      fleet.timeLeft = Math.max(fleet.duration - (now() - fleet.launchTime), 0);
      if (fleet.timeLeft <= 0) {
        fleet.timeToResolve =  Math.max((fleet.launchTime + fleet.duration + spaceInfo.resolveWindow) - now(), 0);
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
          let state = 'SEND_BROADCASTED';
          if (pendingAction.status == 'SUCCESS') {
            state = 'TRAVELING';
          }

          const from = spaceInfo.getPlanetInfo(sendAction.from.x, sendAction.from.y);
          const to = spaceInfo.getPlanetInfo(sendAction.to.x, sendAction.to.y);
          const duration = spaceInfo.timeToArrive(from, to);
          let launchTime = sendAction.timestamp;
          if(sendAction.actualLaunchTime) {
            launchTime = sendAction.actualLaunchTime;
          } else if (pendingAction.txTimestamp) {
            launchTime = pendingAction.txTimestamp;
            account.recordFleetLaunchTime(pendingAction.id, launchTime);
          }


          const timeLeft = Math.max(duration - (now() - launchTime), 0);
          let timeToResolve = 0;
          if (timeLeft <= 0) {
            state = 'READY_TO_RESOLVE';
            timeToResolve = Math.max((launchTime + duration + spaceInfo.resolveWindow) - now(), 0);
            if (timeToResolve <= 0) {
              state = 'TOO_LATE_TO_RESOLVE';
            }
          }

          let resolution: CheckedPendingAction | undefined;
          if (sendAction.resolution) {
            // console.log('RESOLUTION', sendAction.resolution);
            // TODO handle multiple resolution
            const pendingResolution = update.pendingActions.find((v => v.id === sendAction.resolution[0]));
            if (pendingResolution) {
              resolution = pendingResolution;
              state = 'RESOLVE_BROADCASTED';

              if (resolution.status === 'SUCCESS') { // TODO error
                state = 'WAITING_ACKNOWLEDGMENT';
              }
            } else {
              // TODO error ?
            }
          }
          console.log({state})
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
              state
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

