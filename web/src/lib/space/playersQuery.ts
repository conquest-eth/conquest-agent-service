import type {Invalidator, Subscriber, Unsubscriber} from 'web3w/dist/esm/utils/internals';
import {SUBGRAPH_ENDPOINT} from '$lib/blockchain/subgraph';
import type {QueryState, QueryStore, QueryStoreWithRuntimeVariables} from '$lib/utils/stores/graphql';
import {HookedQueryStore} from '$lib/utils/stores/graphql';
import type {EndPoint} from '$lib/utils/graphql/endpoint';
import {chainTempo} from '$lib/blockchain/chainTempo';
import type {Writable} from 'svelte/store';
import {writable} from 'svelte/store';
import type {AccountState} from '$lib/account/account';
import {account} from '$lib/account/account';

export type Player = {
  address: string;
  alliances: {address: string; ally: boolean}[];
};

export type Alliance = {
  address: string;
  members: Player[];
};

export type PlayersMap = {[address: string]: Player};

export type AlliancesMap = {[address: string]: Alliance};

export type PlayersQueryResult = {
  owners: {id: string; alliances: {alliance: {id: string}}[]}[];
  chain: {blockHash: string; blockNumber: string};
};

export type PlayersState = {
  loading: boolean;
  players: PlayersMap;
  alliances: AlliancesMap;
  chain: {blockHash: string; blockNumber: string};
};

export class SpaceQueryStore implements QueryStore<PlayersState> {
  private queryStore: QueryStoreWithRuntimeVariables<PlayersQueryResult>;
  private store: Writable<QueryState<PlayersState>>;
  private $players: PlayersMap = {};
  private $alliances: AlliancesMap = {};
  private unsubscribeFromQuery: () => void | undefined;
  private stopAccountSubscription: (() => void) | undefined = undefined;
  private _resolveFetch: () => void | undefined;

  constructor(endpoint: EndPoint) {
    this.queryStore = new HookedQueryStore( // TODO full list
      endpoint,
      `query($first: Int! $lastId: ID!) {
  owners(first: $first where: {id_gt: $lastId }) {
    id
    alliances {
      alliance {
        id
      }
    }
  }
  chain(id: "Chain") {
    blockHash
    blockNumber
  }
}`,
      chainTempo, // replayTempo, //
      {
        list: {path: 'owners'},
      }
    );

    this.store = writable({step: 'IDLE'}, this.start.bind(this));
  }

  getPlayer(address: string): Player | undefined {
    return this.$players[address];
  }

  protected start(): () => void {
    this.stopAccountSubscription = account.subscribe(async ($account) => {
      await this._handleAccountChange($account);
    });
    this.unsubscribeFromQuery = this.queryStore.subscribe(this.update.bind(this));
    return this.stop.bind(this);
  }

  protected stop(): void {
    if (this.stopAccountSubscription) {
      this.stopAccountSubscription();
      this.stopAccountSubscription = undefined;
    }
    if (this.unsubscribeFromQuery) {
      this.unsubscribeFromQuery();
      this.unsubscribeFromQuery = undefined;
    }
  }

  triggerUpdate(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._resolveFetch = resolve;
      this.queryStore.fetch({blockNumber: chainTempo.chainInfo.lastBlockNumber}).catch((e) => reject(e));
    });
  }

  private async _handleAccountChange($account: AccountState): Promise<void> {
    const accountAddress = $account.ownerAddress?.toLowerCase();
    if (this.queryStore.runtimeVariables.owner !== accountAddress) {
      this.queryStore.runtimeVariables.owner = accountAddress;
      this.store.update((v) => {
        if (v.data) {
          v.data.loading = true;
        }
        return v;
      });
      this.queryStore.fetch({blockNumber: chainTempo.chainInfo.lastBlockNumber});
    }
    // TODO
    // delete other account data in sync
    // by the way, planet can be considered loading if the blockHash their state is taken from is different than latest query blockHash
    // this means we have to keep track of each planet query's blockHash
    // then a global loading flag could be set based on whether there is at least one planet loading, or account changed
  }

  _transform(data?: PlayersQueryResult): PlayersState | undefined {
    if (!data) {
      return undefined;
    }

    // TODO remove, but for now delete alliance
    for (const owner of data.owners) {
      owner.alliances = owner.alliances.filter((v) => v.alliance.id !== '0x1b4d6f16c224b32661da98362a123106a7c731f8');
    }

    const playerAlliances = {};
    if (this.queryStore.runtimeVariables.owner) {
      const playerAddress = this.queryStore.runtimeVariables.owner.toLowerCase();
      const playerObject = data.owners.find((v) => v.id === playerAddress);
      if (playerObject) {
        for (const alliance of playerObject.alliances) {
          playerAlliances[alliance.alliance.id] = true;
        }
      }
    }

    this.$players = {};
    this.$alliances = {};
    for (const owner of data.owners) {
      const player = (this.$players[owner.id] = {
        address: owner.id,
        alliances: owner.alliances.map((v) => {
          return {address: v.alliance.id, ally: playerAlliances[v.alliance.id]};
        }),
      });
      for (const alliance of owner.alliances) {
        let existingAlliance = this.$alliances[alliance.alliance.id];
        if (!existingAlliance) {
          existingAlliance = this.$alliances[alliance.alliance.id] = {
            address: alliance.alliance.id,
            members: [],
          };
        }
        existingAlliance.members.push(player);
      }
    }

    return {
      loading: false,
      players: this.$players,
      chain: {
        blockHash: data.chain.blockHash,
        blockNumber: data.chain.blockNumber,
      },
      alliances: this.$alliances,
    };
  }

  private async update($query: QueryState<PlayersQueryResult>): Promise<void> {
    const transformed = {
      step: $query.step,
      error: $query.error,
      data: this._transform($query.data),
    };
    this.store.set(transformed);

    // trigger the waiting
    const resolveFetch = this._resolveFetch;
    if (resolveFetch) {
      this._resolveFetch = undefined;
      resolveFetch();
    }
  }

  acknowledgeError(): void {
    return this.queryStore.acknowledgeError();
  }

  subscribe(
    run: Subscriber<QueryState<PlayersState>>,
    invalidate?: Invalidator<QueryState<PlayersState>> | undefined
  ): Unsubscriber {
    return this.store.subscribe(run, invalidate);
  }
}

export const playersQuery = new SpaceQueryStore(SUBGRAPH_ENDPOINT);
