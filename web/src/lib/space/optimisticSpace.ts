import {CheckedPendingAction, CheckedPendingActions, pendingActions} from '$lib/account/pendingActions';
import {SUBGRAPH_ENDPOINT} from '$lib/blockchain/subgraph';
import {now} from '$lib/time';
import type {QueryState} from '$lib/utils/stores/graphql';
import {Readable, writable, Writable} from 'svelte/store';
import {spaceQuery, SpaceState} from './spaceQuery';

export type SyncedPendingAction = CheckedPendingAction & {
  counted: boolean;
};

export type SyncedPendingActions = SyncedPendingAction[];

export type SpaceQueryWithPendingState = {
  pendingActions: SyncedPendingActions;
  queryState: QueryState<SpaceState>;
};

export class SpaceQueryWithPendingActions implements Readable<SpaceQueryWithPendingState> {
  private state: SpaceQueryWithPendingState;
  private store: Writable<SpaceQueryWithPendingState>;

  private lastQueryTime: number;
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
    // this._updateAndNotify();
    // TODO consider loading
    // show pendingActions as loading, since we do not want to show them until we queries the graph and check if these have already been included
    // we could trigger a query update, or just a query for txs with last query result

    // TODO consider account switching
    // if account switches, this should bring loading again as above

    // TODO consider new pendingActions: they won't be visible
    // issue: newly added pendingActions are not visible straight away
    // fix : use lastQueryTimestamp vs pendingAction timestamp

    if (!this.lastQueryTime) {
      return this._updateAndNotify();
    }

    const dict: {[id: string]: boolean} = {};
    for (const pendingAction of this.state.pendingActions) {
      dict[pendingAction.id] = true;
    }
    for (const pendingAction of this.rawPendingActions) {
      if (!dict[pendingAction.id] && pendingAction.action.timestamp >= this.lastQueryTime) {
        // not full proof (a second resolution) but sufficient
        this.state.pendingActions.push({...pendingAction, counted: false});
      }
    }
    this._notify();
  }

  private _updateAndNotify() {
    this.state.pendingActions = this.rawPendingActions.map((v) => {
      return {...v, counted: this.includedTx[v.id]};
    });
    this._notify();
  }

  private async _handleSpaceQuery(space: QueryState<SpaceState>): Promise<void> {
    // if pending request ? abort ?
    if (!space.data) {
      // TODO error
      return;
    }
    const txsToCheck: string[] = [];
    for (const pendingAction of this.rawPendingActions) {
      // TODO filter out aknowledged one, => auto acknowledge
      txsToCheck.push(pendingAction.id); // TODO SEND + RESOLVE
    }

    this.lastQueryTime = now();
    let includedTx: string[] = [];
    if (txsToCheck.length > 0) {
      const variables = {txs: txsToCheck, blockHash: space.data.chain.blockHash};
      console.log(variables);

      const result = await SUBGRAPH_ENDPOINT.query<{transactions: {id: string}[]}>(
        `query($blockHash: String! $txs: [String]) {
      transactions( where: {id_in: $txs} block: {hash: $blockHash}) {
        id
      }
    }`,
        {
          variables,
          context: {
            requestPolicy: 'cache-and-network', // required as cache-first will not try to get new data
          },
        }
      );
      if (result.error) {
        this.state.queryState.error = result.error.message;
        this._notify();
        return;
      }
      if (result.data && result.data.transactions) {
        includedTx = result.data.transactions.map((v) => v.id);
      }
    }

    this.includedTx = {};
    for (const tx of includedTx) {
      this.includedTx[tx] = true;
    }

    this.state = {queryState: space, pendingActions: this.state.pendingActions};
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
