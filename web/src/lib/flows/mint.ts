import {wallet} from '$lib/blockchain/wallet';
import {xyToLocation} from 'conquest-eth-common';
import {BaseStoreWithData} from '$lib/utils/stores/base';
import {account} from '$lib/account/account';
import {BigNumber} from '@ethersproject/bignumber';
import {spaceInfo} from '$lib/space/spaceInfo';

type Data = {
  txHash?: string;
  numTokenUnit?: number;
};
export type MintFlow = {
  type: 'MINT';
  step: 'IDLE' | 'CONNECTING' | 'WAITING_CONFIRMATION' | 'CREATING_TX' | 'WAITING_TX' | 'SUCCESS';
  cancelingConfirmation?: boolean;
  data?: Data;
  error?: {message?: string};
};

class MintFlowStore extends BaseStoreWithData<MintFlow, Data> {
  public constructor() {
    super({
      type: 'MINT',
      step: 'IDLE',
    });
  }

  async mint(numTokenUnit: number): Promise<void> {
    this.setPartial({step: 'WAITING_CONFIRMATION', cancelingConfirmation: false});
    this.setData({numTokenUnit: numTokenUnit});
  }

  async confirm(numTokenUnit?: number): Promise<void> {
    const flow = this.setPartial({step: 'CREATING_TX'});
    if (!flow.data) {
      throw new Error(`no flow data`);
    }

    if (!numTokenUnit) {
      numTokenUnit = flow.data.numTokenUnit;
    }

    const amount = BigNumber.from(numTokenUnit * 10).mul('100000000000000000');

    let gasEstimation: BigNumber;
    try {
      gasEstimation = await wallet.contracts?.PlayToken.estimateGas.mint(wallet.address, amount, {value: amount}); // TODO ratio multiplier for underlying token
    } catch (e) {
      this.setPartial({
        step: 'WAITING_CONFIRMATION',
        error: e,
      });
      return;
    }
    // TODO gasEstimation for EXIT
    const gasLimit = gasEstimation.add(100000);

    this.setPartial({step: 'WAITING_TX'});
    let tx: {hash: string; nonce?: number};
    try {
      tx = await wallet.contracts?.PlayToken.mint(wallet.address, amount, {value: amount, gasLimit}); // TODO ratio multiplier for underlying token
    } catch (e) {
      if (e.transactionHash) {
        tx = {hash: e.transactionHash};
        try {
          const tResponse = await wallet.provider.getTransaction(e.transactionHash);
          tx = tResponse;
        } catch (e) {
          console.log(`could not fetch tx, to get the nonce`);
        }
      }
      if (!tx || !tx.hash) {
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
    }

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

export default new MintFlowStore();
