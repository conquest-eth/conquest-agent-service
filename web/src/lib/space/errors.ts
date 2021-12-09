import type {PendingAction} from '$lib/account/account';
import type {SpaceQueryWithPendingState} from '$lib/space/optimisticSpace';
import {spaceQueryWithPendingActions} from '$lib/space/optimisticSpace';
import {now} from '$lib/time';
import type {Readable, Writable} from 'svelte/store';
import {writable} from 'svelte/store';
import {spaceInfo} from './spaceInfo';
// object representing a fleet (publicly)
export type SpaceError = {
  txHash: string; // TODO better id
  status: 'SUCCESS' | 'FAILURE' | 'LOADING' | 'PENDING' | 'CANCELED' | 'TIMEOUT';
  action: PendingAction;
  location: {x: number; y: number};
  acknowledged: boolean;
  late?: boolean;
};

export class ErrorsStore implements Readable<SpaceError[]> {
  private store: Writable<SpaceError[]>;
  private errors: SpaceError[] = [];

  constructor() {
    this.store = writable(this.errors, this._start.bind(this));
  }

  _start(): void {
    spaceQueryWithPendingActions.subscribe(this.onSpaceUpdate.bind(this));
  }

  private onSpaceUpdate(update: SpaceQueryWithPendingState): void {
    this.errors.length = 0;
    for (const pendingAction of update.pendingActions) {
      let errorProcessed = false;
      let location: {x: number; y: number} | undefined;
      if (pendingAction.action.type === 'SEND') {
        location = pendingAction.action.from;

        const sendAction = pendingAction.action;
        if (!sendAction.resolution) {
          // copied from fleets, TODO DRY
          const from = spaceInfo.getPlanetInfo(sendAction.from.x, sendAction.from.y);
          const to = spaceInfo.getPlanetInfo(sendAction.to.x, sendAction.to.y);
          const duration = spaceInfo.timeToArrive(from, to);
          if (sendAction.actualLaunchTime) {
            const launchTime = sendAction.actualLaunchTime;
            const timeLeft = Math.max(duration - (now() - launchTime), 0);
            let timeToResolve = 0;
            if (pendingAction.status === 'SUCCESS') {
              if (timeLeft <= 0) {
                timeToResolve = Math.max(launchTime + duration + spaceInfo.resolveWindow - now(), 0);
                if (timeToResolve <= 0) {
                  errorProcessed = true;
                  location = pendingAction.action.to;
                  this.errors.push({
                    action: pendingAction.action,
                    status: 'TIMEOUT',
                    txHash: pendingAction.id,
                    location,
                    acknowledged: pendingAction.action.acknowledged === 'ERROR',
                    late: true, // special case
                  });
                }
              }
            }
          }
        }
      } else if (pendingAction.action.type === 'CAPTURE') {
        location = pendingAction.action.planetCoords;
      } else if (pendingAction.action.type === 'RESOLUTION') {
        location = pendingAction.action.to;
      } else if (pendingAction.action.type === 'EXIT') {
        location = pendingAction.action.planetCoords;
      }

      if (
        !errorProcessed &&
        (pendingAction.status === 'FAILURE' ||
          pendingAction.status === 'CANCELED' ||
          pendingAction.status === 'TIMEOUT')
      ) {
        this.errors.push({
          action: pendingAction.action,
          status: pendingAction.status,
          txHash: pendingAction.id,
          location,
          acknowledged: pendingAction.action.acknowledged === 'ERROR',
        });
      }
    }

    this.errors = this.errors.filter((v) => !v.acknowledged);
    this.store.set(this.errors);
  }

  subscribe(run: (value: SpaceError[]) => void, invalidate?: (value?: SpaceError[]) => void): () => void {
    return this.store.subscribe(run, invalidate);
  }
}

export const errors = new ErrorsStore();

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).errors = errors;
}
