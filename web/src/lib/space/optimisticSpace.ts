import {CheckedPendingActions, pendingActions} from '$lib/account/pendingActions';
import {SUBGRAPH_ENDPOINT} from '$lib/blockchain/subgraph';
import type {QueryState} from '$lib/utils/stores/graphql';
import {Readable, writable, Writable} from 'svelte/store';
import {spaceQuery, SpaceState} from './spaceQuery';

export type SpaceQueryWithPendingState = {
  pendingActions: CheckedPendingActions;
  queryState: QueryState<SpaceState>;
};

export class SpaceQueryWithPendingActions implements Readable<SpaceQueryWithPendingState> {
  private state: SpaceQueryWithPendingState;
  private store: Writable<SpaceQueryWithPendingState>;

  private rawPendingActions: CheckedPendingActions = [];
  private includedTx: {[txHash: string]: boolean} = {};
  private queryState: QueryState<SpaceState> = {step: 'IDLE'};

  private stopSpaceQuerySubscription: (() => void) | undefined = undefined;
  private stopPendingActionsSubscription: (() => void) | undefined = undefined;

  constructor() {
    this.state = {pendingActions: [], queryState: this.queryState};
    this.store = writable(this.state, this._start.bind(this));
  }
  subscribe(
    run: (value: SpaceQueryWithPendingState) => void,
    invalidate?: (value?: SpaceQueryWithPendingState) => void
  ): () => void {
    return this.store.subscribe(run, invalidate);
  }

  private _handlePendingActions(pendingActions: CheckedPendingActions): void {
    this.rawPendingActions = pendingActions;
    this._updateAndNotify();
  }

  private _updateAndNotify() {
    this.state.pendingActions = this.rawPendingActions.filter((v) => !this.includedTx[v.id]);
    this._notify();
  }

  private async _handleSpaceQuery(space: QueryState<SpaceState>): Promise<void> {
    // if pending request ? abort ?
    if (!space.data) {
      // TODO error
      return;
    }
    const txToCHeck: string[] = [];
    for (const pendingAction of this.rawPendingActions) {
      txToCHeck.push(pendingAction.id); // TODO SEND + RESOLVE
    }
    // TODO query txHash existence at same blockHash as query

    // const result = await SUBGRAPH_ENDPOINT.query(``, {
    //   variables: {txs: txToCHeck},
    //   context: {
    //     requestPolicy: 'cache-and-network', // required as cache-first will not try to get new data
    //   },
    // });

    // for all included add them to includedTx
    this.state.queryState = space;
    this._updateAndNotify();
  }

  private _start(): () => void {
    this.stopSpaceQuerySubscription = spaceQuery.subscribe(async ($spaceQuery) => {
      await this._handleSpaceQuery($spaceQuery);
    });
    this.stopPendingActionsSubscription = pendingActions.subscribe(async ($pendingActions) => {
      await this._handlePendingActions($pendingActions);
    });
    return this._stop.bind(this);
  }

  private _stop(): void {
    if (this.stopPendingActionsSubscription) {
      this.stopPendingActionsSubscription();
      this.stopPendingActionsSubscription = undefined;
    }
    if (this.stopSpaceQuerySubscription) {
      this.stopSpaceQuerySubscription();
      this.stopSpaceQuerySubscription = undefined;
    }
  }

  private _notify(): void {
    this.store.set(this.state);
  }
}

export const spaceQueryWithPendingActions = new SpaceQueryWithPendingActions();
