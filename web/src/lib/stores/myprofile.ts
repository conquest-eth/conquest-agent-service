import {BaseStoreWithData} from '$lib/utils/stores/base';
import {wallet} from './wallet';

export type ProfileFlow = {
  type: 'MY_PROFILE';
  step: 'IDLE' | 'LOADING' | 'READY';
  owner?: string;
  profile?: {
    name?: string;
    contact?: string; // generic contact
    telegram?: string;
    twitter?: string;
    email?: string;
    discord?: string;
    [key: string]: string;
  };
  error?: {message?: string};
};

const PROFILE_URI = import.meta.env.VITE_PROFILE_URI as string;
const DB_NAME = 'etherplay-profile';

class MyProfileFlowStore extends BaseStoreWithData<ProfileFlow, undefined> {
  public constructor() {
    super({
      type: 'MY_PROFILE',
      step: 'IDLE',
    });

    wallet.subscribe(($wallet) => {
      if ($wallet.address) {
        this.show($wallet.address);
      } else {
        if (this.$store.step === 'READY') {
          this.setPartial({
            step: 'IDLE',
            owner: undefined,
            profile: undefined,
          });
        }
      }
    });
  }

  private async show(owner: string): Promise<void> {
    this.setPartial({step: 'LOADING', owner});
    try {
      // TODO CACHE data
      const data = await fetch(PROFILE_URI, {
        method: 'POST',
        body: JSON.stringify({
          method: 'wallet_getString',
          params: [owner, DB_NAME],
          jsonrpc: '2.0',
          id: 99999999, // TODO ?
        }),
        headers: {
          'Content-type': 'application/json; charset=UTF-8',
        },
      });
      // TODO fetch ENS name first ?
      const json = await data.json();
      const result = json.result;
      // TODO check signature
      let parsedData = undefined;
      if (result.data && result.data !== '') {
        parsedData = JSON.parse(result.data);
        if (Object.keys(parsedData).length === 0) {
          parsedData = undefined; // an empty profile is the equivalent of no profile
        }
      }
      this.setPartial({step: 'READY', owner, profile: parsedData});
    } catch (e) {
      this.setPartial({error: e});
    }
  }

  async cancel(): Promise<void> {
    this._reset();
  }

  async acknownledgeSuccess(): Promise<void> {
    this._reset();
  }

  async acknownledgeError(): Promise<void> {
    this.setPartial({error: undefined});
  }

  private _reset() {
    this.setPartial({step: 'IDLE', owner: undefined});
  }
}

export default new MyProfileFlowStore();
