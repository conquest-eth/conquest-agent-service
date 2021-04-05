import {wallet} from './wallet';
import privateAccount from './privateAccount';
import {xyToLocation} from '../common/src';
import {BaseStoreWithData} from '../lib/utils/stores';

type Data = {
  txHash?: string;
  location: {x: number; y: number};
};
export type ExitFlow = {
  type: 'EXIT';
  step:
    | 'IDLE'
    | 'CONNECTING'
    | 'WAITING_CONFIRMATION'
    | 'WAITING_TX'
    | 'SUCCESS';
  data?: Data;
  error?: unknown; // TODO
};

class ExitFlowStore extends BaseStoreWithData<ExitFlow, Data> {
  public constructor() {
    super({
      type: 'EXIT',
      step: 'IDLE',
    });
  }

  async exitFrom(location: {x: number; y: number}): Promise<void> {
    this.setData({location}, {step: 'CONNECTING'});
    await privateAccount.login();
    this.setPartial({step: 'WAITING_CONFIRMATION'});
  }

  async confirm(): Promise<void> {
    const flow = this.setPartial({step: 'WAITING_TX'});
    if (!flow.data) {
      throw new Error(`no flow data`);
    }
    const location = flow.data.location;
    const locationId = xyToLocation(location.x, location.y);
    // const latestBlock = await wallet.provider?.getBlock('latest');
    // if (!latestBlock) {
    //   throw new Error(`can't fetch latest block`);
    // }
    let tx: {hash: string; nonce: number};
    try {
      tx = await wallet.contracts?.OuterSpace.exitFor(
        wallet.address,
        locationId
      );
    } catch (e) {
      console.error(e);
      if (e.message && e.message.indexOf('User denied') >= 0) {
        this.setPartial({
          step: 'IDLE',
          error: undefined,
        });
        return;
      }
      this.setPartial({
        step: 'WAITING_CONFIRMATION',
        error: e,
      });
      return;
    }

    privateAccount.recordExit(locationId, tx.hash, tx.nonce);

    this.setData({txHash: tx.hash}, {step: 'SUCCESS'});
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
    this.setPartial({step: 'IDLE', data: undefined});
  }
}

export default new ExitFlowStore();
