import {wallet} from '$lib/blockchain/wallet';
import {xyToLocation} from 'conquest-eth-common';
import {BaseStoreWithData} from '$lib/utils/stores/base';
import {account} from '$lib/account/account';

type Data = {
  txHash?: string;
  location: {x: number; y: number};
};
export type PlanetTransferFlow = {
  type: 'TRANSFER_PLANET';
  step: 'IDLE' | 'CONNECTING' | 'CHOOSE_NEW_OWNER' | 'WAITING_TX' | 'SUCCESS';
  cancelingConfirmation?: boolean;
  data?: Data;
  error?: {message?: string};
};

class PlanetTransferFlowStore extends BaseStoreWithData<PlanetTransferFlow, Data> {
  public constructor() {
    super({
      type: 'TRANSFER_PLANET',
      step: 'IDLE',
    });
  }

  async transfer(location: {x: number; y: number}): Promise<void> {
    this.setData({location}, {step: 'CHOOSE_NEW_OWNER'});
    this.setPartial({step: 'CHOOSE_NEW_OWNER', cancelingConfirmation: false});
  }

  async confirm(newOwner: string): Promise<void> {
    const flow = this.setPartial({step: 'WAITING_TX'});
    if (!flow.data) {
      throw new Error(`no flow data`);
    }
    const latestBlock = await wallet.provider.getBlock('latest');
    const location = flow.data.location;
    const locationId = xyToLocation(location.x, location.y);
    // const latestBlock = await wallet.provider?.getBlock('latest');
    // if (!latestBlock) {
    //   throw new Error(`can't fetch latest block`);
    // }
    let tx: {hash: string; nonce: number};
    try {
      tx = await wallet.contracts?.OuterSpace.transferFrom(wallet.address, newOwner, locationId);
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
        step: 'CHOOSE_NEW_OWNER',
        error: e,
      });
      return;
    }

    account.recordExit(location, tx.hash, latestBlock.timestamp, tx.nonce);

    this.setData({txHash: tx.hash}, {step: 'SUCCESS'});
  }

  async cancelCancelation(): Promise<void> {
    this.setPartial({cancelingConfirmation: false});
  }

  async cancel(cancelingConfirmation = false): Promise<void> {
    if (cancelingConfirmation) {
      this.setPartial({cancelingConfirmation: true});
    } else {
      this._reset();
    }
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

export default new PlanetTransferFlowStore();
