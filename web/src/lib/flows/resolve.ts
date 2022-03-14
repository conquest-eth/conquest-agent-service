import {wallet} from '$lib/blockchain/wallet';
import {xyToLocation} from 'conquest-eth-common';
import {BaseStore} from '$lib/utils/stores/base';
import {account} from '$lib/account/account';
import {isCorrected, correctTime} from '$lib/time';
import type {Fleet} from '$lib/space/fleets';
import type {BigNumber} from '@ethersproject/bignumber';

export type ResolveFlow = {
  type: 'RESOLVE';
  step: 'IDLE' | 'CONNECTING' | 'CREATING_TX' | 'WAITING_TX' | 'SUCCESS';
  cancelingConfirmation?: boolean;
  error?: unknown;
};

class ResolveFlowStore extends BaseStore<ResolveFlow> {
  constructor() {
    super({
      type: 'RESOLVE',
      step: 'IDLE',
    });
  }

  async resolve(fleet: Fleet): Promise<void> {
    this.setPartial({step: 'CONNECTING'});
    this.setPartial({step: 'CREATING_TX', cancelingConfirmation: undefined});

    let nonce = fleet.sending.action.nonce;
    if (!nonce) {
      console.error('NO NONCE FOUND, fetching from transaciton hash');

      let tx: {nonce: number};
      try {
        tx = await wallet.provider.getTransaction(fleet.sending.id);
      } catch (e) {
        this.setPartial({
          step: 'IDLE',
          error: e,
        });
        return;
      }
      nonce = tx.nonce;
      // TODO why the following was needed in one instance?
      // nonce = tx.nonce - 1;
    }

    const fleetData = await account.hashFleet(
      fleet.from.location,
      fleet.to.location,
      fleet.gift,
      fleet.specific,
      fleet.arrivalTimeWanted,
      nonce,
      fleet.owner,
      fleet.fleetSender,
      fleet.operator
    );

    let latestBlock;
    try {
      latestBlock = await wallet.provider.getBlock('latest');
    } catch (e) {
      this.setPartial({
        step: 'IDLE',
        error: e,
      });
      return;
    }
    if (!isCorrected) {
      // TODO extreact or remove (assume time will be corrected by then)
      correctTime(latestBlock.timestamp);
    }

    const secretHash = fleetData.secretHash;
    // console.log('resolve', {secretHash});
    const distanceSquared =
      Math.pow(fleet.to.location.globalX - fleet.from.location.globalX, 2) +
      Math.pow(fleet.to.location.globalY - fleet.from.location.globalY, 2);
    const distance = Math.floor(Math.sqrt(distanceSquared));

    console.log({
      fleetData,
      secretHash,
      distance,
      fleet,
    });

    // let currentGasPrice;
    // try {
    //   currentGasPrice = await wallet.provider.getGasPrice();
    // } catch (e) {
    //   this.setPartial({
    //     step: 'IDLE',
    //     error: e,
    //   });
    //   return;
    // }
    // const gasPrice = currentGasPrice.mul(2);
    const gasPrice = undefined;

    let gasEstimation: BigNumber;
    try {
      gasEstimation = await wallet.contracts?.OuterSpace.estimateGas.resolveFleet(fleetData.fleetId, {
        from: xyToLocation(fleet.from.location.x, fleet.from.location.y),
        to: xyToLocation(fleet.to.location.x, fleet.to.location.y),
        distance,
        arrivalTimeWanted: fleet.arrivalTimeWanted,
        secret: secretHash,
        gift: fleet.gift,
        specific: fleet.specific,
        fleetSender: fleet.fleetSender || fleet.owner,
        operator: fleet.operator || fleet.owner,
      });
    } catch (e) {
      this.setPartial({
        step: 'IDLE',
        error: e,
      });
      return;
    }
    // TODO gasEstimation for resolve
    const gasLimit = gasEstimation.add(200000);

    // const gasLimit = 1000000;

    this.setPartial({step: 'WAITING_TX'});
    try {
      const tx = await wallet.contracts?.OuterSpace.resolveFleet(
        fleetData.fleetId,
        {
          from: xyToLocation(fleet.from.location.x, fleet.from.location.y),
          to: xyToLocation(fleet.to.location.x, fleet.to.location.y),
          distance,
          arrivalTimeWanted: fleet.arrivalTimeWanted,
          secret: secretHash,
          gift: fleet.gift,
          specific: fleet.specific,
          fleetSender: fleet.fleetSender || fleet.owner,
          operator: fleet.operator || fleet.owner,
        },
        {gasPrice, gasLimit}
      );
      account.recordFleetResolvingTxhash(
        fleet.txHash,
        tx.hash,
        fleet.to.location,
        latestBlock.timestamp,
        tx.nonce,
        false
      );
      this.setPartial({step: 'SUCCESS'}); // TODO IDLE ?
    } catch (e) {
      console.error(e);
      // TODO get next Fleet instead ?
      if (e.message && e.message.indexOf('User denied') >= 0) {
        this.setPartial({
          step: 'IDLE',
          error: undefined,
        });
        return;
      }
      this.setPartial({error: e, step: 'IDLE'});
      return;
    }
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
    this.setPartial({step: 'IDLE'});
  }
}

export default new ResolveFlowStore();
