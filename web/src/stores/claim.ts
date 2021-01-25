import {wallet} from './wallet';
import privateAccount from './privateAccount';
import {BaseStore} from '../lib/utils/stores';

export type ClaimFlow = {
  type: 'CLAIM';
  step:
    | 'IDLE'
    | 'CONNECTING'
    | 'CHOOSE_STAKE'
    | 'CREATING_TX'
    | 'WAITING_TX'
    | 'SUCCESS';
  data?: {txHash?: string; location: string};
};

class ClaimFlowStore extends BaseStore<ClaimFlow> {
  public constructor() {
    super({
      type: 'CLAIM',
      step: 'IDLE',
    });
  }

  async cancel(): Promise<void> {
    this._reset();
  }

  async acknownledgeSuccess(): Promise<void> {
    // TODO automatic ?
    this._reset();
  }

  async claim(location: string): Promise<void> {
    this.setPartial({data: {location}, step: 'CONNECTING'});
    await privateAccount.login();
    this.setPartial({step: 'CHOOSE_STAKE'});
  }

  async confirm(): Promise<void> {
    const flow = this.setPartial({step: 'WAITING_TX'});
    if (!flow.data) {
      throw new Error(`no flow data`);
    }
    const latestBlock = await wallet.provider?.getBlock('latest');
    if (!latestBlock) {
      throw new Error(`can't fetch latest block`);
    }
    console.log('HELLO');
    const tx = await wallet.contracts?.OuterSpace.acquire(flow.data?.location);

    privateAccount.recordCapture(
      flow.data.location,
      tx.hash,
      latestBlock.timestamp,
      tx.nonce
    ); // TODO check
    this.setRecursivePartial({
      step: 'SUCCESS',
      data: {txHash: tx.hash},
    });
  }

  private _reset() {
    this.setPartial({step: 'IDLE', data: undefined});
  }
}

export default new ClaimFlowStore();
