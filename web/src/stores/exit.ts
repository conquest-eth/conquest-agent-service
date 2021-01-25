import {wallet} from './wallet';
import privateAccount from './privateAccount';
import {xyToLocation} from '../common/src';
import {BaseStore} from '../lib/utils/stores';

export type ExitFlow = {
  type: 'EXIT';
  step:
    | 'IDLE'
    | 'CONNECTING'
    | 'WAITING_CONFIRMATION'
    | 'WAITING_TX'
    | 'SUCCESS';
  data?: {
    txHash?: string;
    location: {x: number; y: number};
  };
  error?: unknown; // TODO
};

class ExitFlowStore extends BaseStore<ExitFlow> {
  public constructor() {
    super({
      type: 'EXIT',
      step: 'IDLE',
    });
  }

  async exitFrom(location: {x: number; y: number}): Promise<void> {
    this.setRecursivePartial({data: {location}, step: 'CONNECTING'});
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
    const latestBlock = await wallet.provider?.getBlock('latest');
    if (!latestBlock) {
      throw new Error(`can't fetch latest block`);
    }
    let tx: {hash: string};
    try {
      tx = await wallet.contracts?.OuterSpace.exitFor(
        wallet.address,
        locationId
      );
    } catch (e) {
      this.setPartial({
        step: 'WAITING_CONFIRMATION',
        error: e,
      });
      return;
    }

    privateAccount.recordExit(locationId, latestBlock.timestamp);

    this.setRecursivePartial({
      step: 'SUCCESS',
      data: {txHash: tx.hash},
    });
  }

  async cancel(): Promise<void> {
    this._reset();
  }

  async acknownledgeSuccess(): Promise<void> {
    this._reset();
  }

  private _reset() {
    this.setPartial({step: 'IDLE', data: undefined});
  }
}

export default new ExitFlowStore();
