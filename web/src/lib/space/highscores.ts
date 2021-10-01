import {BaseStoreWithData} from '$lib/utils/stores/base';
import {blockTime, finality, logPeriod, lowFrequencyFetch} from '$lib/config';
import {SUBGRAPH_ENDPOINT} from '$lib/blockchain/subgraph';
import {BigNumber} from '@ethersproject/bignumber';

type Highscore = {
  id: string;
  total: number;
  score: number;
  currentStake: number;
  playTokenToWithdraw: number;
  playTokenBalance: number;
  playTokenGiven: number;
};

export type Highscores = {
  step: 'IDLE' | 'LOADING' | 'READY';
  data?: Highscore[];
  error?: string;
};

type QueryOwner = {
  id: string;
  currentStake: string;
  playTokenToWithdraw: string;
  playTokenBalance: string;
  playTokenGiven: string;
};

const DECIMALS_18 = BigNumber.from('1000000000000000000');

class HighscoresStore extends BaseStoreWithData<Highscores, Highscore[]> {
  private timeout: NodeJS.Timeout;
  public constructor() {
    super({
      step: 'IDLE',
    });
  }

  async fetch() {
    const query = `
query($first: Int! $lastId: ID!) {
  owners(first: $first where: {
    totalStaked_gt: 0
    id_gt: $lastId
  }) {
    id
    currentStake
    playTokenToWithdraw
    playTokenBalance
    playTokenGiven
  }
}
`;

    try {
      let highscoreQueryResult: QueryOwner[];
      try {
        highscoreQueryResult = await SUBGRAPH_ENDPOINT.queryList<QueryOwner>(query, {
          path: 'owners',
          context: {
            requestPolicy: 'network-only', // required as cache-first will not try to get new data
          },
        });
      } catch (e) {
        console.error(e);
        this.setPartial({error: `cannot fetch from thegraph node`});
        throw new Error(`cannot fetch from thegraph node`);
      }
      const highscores = highscoreQueryResult
        .map((p) => {
          const currentStake = BigNumber.from(p.currentStake);
          const playTokenToWithdraw = BigNumber.from(p.playTokenToWithdraw);
          const playTokenBalance = BigNumber.from(p.playTokenBalance);
          const playTokenGiven = BigNumber.from(p.playTokenGiven);
          const total = currentStake.add(playTokenToWithdraw).add(playTokenBalance);
          return {
            id: p.id,
            total: total.div(DECIMALS_18).toNumber(),
            score: total.sub(playTokenGiven).mul(1000000).div(playTokenGiven).toNumber(),
            currentStake: currentStake.div(DECIMALS_18).toNumber(),
            playTokenToWithdraw: playTokenToWithdraw.div(DECIMALS_18).toNumber(),
            playTokenBalance: playTokenBalance.div(DECIMALS_18).toNumber(),
            playTokenGiven: playTokenGiven.div(DECIMALS_18).toNumber(),
          };
        })
        .sort((a, b) => b.score - a.score);

      this.setPartial({step: 'READY', data: highscores.slice(0, 18)});
    } catch (e) {
      console.error(e);
    }

    this.timeout = setTimeout(this.fetch.bind(this), lowFrequencyFetch * 1000);
  }

  start() {
    if (this.$store.step === 'IDLE') {
      this.setPartial({step: 'LOADING'});
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(this.fetch.bind(this), 1000);
  }

  stop() {
    this.setPartial({step: 'IDLE'});
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }
}

export const highscores = new HighscoresStore();
