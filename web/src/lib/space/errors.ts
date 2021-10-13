import type { SpaceQueryWithPendingState } from '$lib/space/optimisticSpace';
import { spaceQueryWithPendingActions } from '$lib/space/optimisticSpace';
import type { Readable, Writable } from 'svelte/store';
import { writable } from 'svelte/store';
// object representing a fleet (publicly)
export type SpaceError = {
  txHash: string; // TODO better id
  status: 'SUCCESS' | 'FAILURE' | 'LOADING' | 'PENDING' | 'CANCELED' | 'TIMEOUT';
  action: { nonce: number; timestamp: number; queueID?: string, type: string };
  location: { x: number; y: number };
  acknowledged: boolean;
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
      let location: { x: number; y: number } | undefined;
      if (pendingAction.action.type === 'SEND') {
        location = pendingAction.action.from;
      } else if (pendingAction.action.type === 'CAPTURE') {
        location = pendingAction.action.planetCoords;
      } else if (pendingAction.action.type === 'RESOLUTION') {
        location = pendingAction.action.to;
      }
      if (
        pendingAction.status === 'FAILURE' ||
        pendingAction.status === 'CANCELED' ||
        pendingAction.status === 'TIMEOUT'
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
