import type {SpaceInfo} from 'conquest-eth-common';
import type {Readable, Writable} from 'svelte/store';
import {writable} from 'svelte/store';
import {spaceInfo} from './spaceInfo';
import type {SpaceQueryWithPendingState} from '$lib/space/optimisticSpace';
import {spaceQueryWithPendingActions} from '$lib/space/optimisticSpace';
import {BigNumber} from '@ethersproject/bignumber';
import {now} from '$lib/time';

export type MyToken = {
  balance?: BigNumber;
  allowance?: BigNumber;
};

export class MyTokenStore implements Readable<MyToken> {
  private readonly spaceInfo: SpaceInfo;
  private data: MyToken;

  private store: Writable<MyToken>;

  constructor(spaceInfo: SpaceInfo) {
    this.spaceInfo = spaceInfo;
    this.store = writable({});
    spaceQueryWithPendingActions.subscribe(this.onSpaceUpdate.bind(this));
  }

  private getPendingSpending(update: SpaceQueryWithPendingState): BigNumber {
    let spending = BigNumber.from(0);
    const pendingActions = update.pendingActions;
    for (const pendingAction of pendingActions) {
      if (pendingAction.counted) {
        continue;
      }
      if (pendingAction.action.type === 'CAPTURE') {
        const captureAction = pendingAction.action;
        // TODO
        if (pendingAction.status === 'FAILURE') {
        } else if (pendingAction.status === 'CANCELED') {
        } else if (pendingAction.status === 'TIMEOUT') {
        } else if (
          pendingAction.status === 'PENDING' ||
          // TODO better? we give LOADING 60 seconds counting from tx submission
          (pendingAction.status === 'LOADING' && now() - pendingAction.action.timestamp < 60)
        ) {
          if (captureAction.planetCoords) {
            const planetInfo = spaceInfo.getPlanetInfo(captureAction.planetCoords.x, captureAction.planetCoords.y);
            spending = spending.add(BigNumber.from(planetInfo.stats.stake).mul('1000000000000000000'));
          }
        }
      }
    }
    return spending;
  }

  private onSpaceUpdate(update: SpaceQueryWithPendingState): void {
    // console.log({update});
    const updatePlayer = update.queryState.data?.player?.id;
    if (!updatePlayer) {
      this.data = {};
    } else {
      this.data = {balance: update.queryState.data.player.tokenBalance.sub(this.getPendingSpending(update))};
    }
    this.store.set(this.data);
  }

  subscribe(run: (value: MyToken) => void, invalidate?: (value?: MyToken) => void): () => void {
    return this.store.subscribe(run, invalidate);
  }
}

export const myTokens = new MyTokenStore(spaceInfo);

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).myTokens = myTokens;
}
