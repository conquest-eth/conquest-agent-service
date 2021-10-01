import {wallet} from '$lib/blockchain/wallet';
import {xyToLocation} from 'conquest-eth-common';
import {BaseStore} from '$lib/utils/stores/base';
import {account} from '$lib/account/account';
import {isCorrected, correctTime} from '$lib/time';
import type {Fleet} from '$lib/space/fleets';

export type ResolveFlow = {
  type: 'RESOLVE';
  step: 'IDLE' | 'CONNECTING' | 'CREATING_TX' | 'WAITING_TX' | 'SUCCESS';
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
    this.setPartial({step: 'CREATING_TX'});
    const fleetData = await account.hashFleet(fleet.from.location, fleet.to.location, fleet.sending.action.nonce);
    const latestBlock = await wallet.provider.getBlock('latest');
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

    const gasPrice = (await wallet.provider.getGasPrice()).mul(2);

    this.setPartial({step: 'WAITING_TX'});
    try {
      const tx = await wallet.contracts?.OuterSpace.resolveFleet(
        fleetData.fleetId,
        xyToLocation(fleet.from.location.x, fleet.from.location.y),
        xyToLocation(fleet.to.location.x, fleet.to.location.y),
        distance,
        secretHash,
        {gasPrice}
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
    this.setPartial({step: 'IDLE'});
  }
}

export default new ResolveFlowStore();
