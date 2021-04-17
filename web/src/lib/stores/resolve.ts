import {wallet} from './wallet';
import privateAccount from './privateAccount';
import {xyToLocation} from 'conquest-eth-common';
import {spaceInfo} from '$lib/app/mapState';
import {BaseStore} from '$lib/utils/stores';

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

  async resolve(fleetId: string): Promise<void> {
    this.setPartial({step: 'CONNECTING'});
    await privateAccount.login();
    this.setPartial({step: 'CREATING_TX'});
    const fleet = privateAccount.getFleet(fleetId);
    if (!fleet) {
      throw new Error(`no fleet with id ${fleetId}`);
    }
    const secretHash = privateAccount.fleetSecret(fleetId);
    // console.log('resolve', {secretHash});
    const to = spaceInfo.getPlanetInfo(fleet.to.x, fleet.to.y);
    const from = spaceInfo.getPlanetInfo(fleet.from.x, fleet.from.y);
    if (!from || !to) {
      throw new Error(`cannot get from or to`);
    }
    const distanceSquared =
      Math.pow(to.location.globalX - from.location.globalX, 2) +
      Math.pow(to.location.globalY - from.location.globalY, 2);
    const distance = Math.floor(Math.sqrt(distanceSquared));
    this.setPartial({step: 'WAITING_TX'});
    try {
      const tx = await wallet.contracts?.OuterSpace.resolveFleet(
        fleetId,
        xyToLocation(fleet.from.x, fleet.from.y),
        xyToLocation(fleet.to.x, fleet.to.y),
        distance,
        secretHash
      );
      privateAccount.recordFleetResolvingTxhash(fleetId, tx.hash, tx.nonce, false);
      this.setPartial({step: 'SUCCESS'}); // TODO IDLE ?
    } catch (e) {
      console.error(e);
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
