import {wallet} from './wallet';
import privateAccount from './privateAccount';
import {xyToLocation} from '$lib/common/src';
import {spaceInfo} from '$lib/app/mapState';
import {BaseStoreWithData} from '$lib/utils/stores';
import {now, correctTime, isCorrected} from './time';

type Data = {
  txHash?: string;
  to: {x: number; y: number};
  from: {x: number; y: number};
  fleetAmount: number;
  error?: unknown;
};

export type SendFlow = {
  type: 'SEND';
  step:
    | 'IDLE'
    | 'CONNECTING'
    | 'PICK_DESTINATION'
    | 'PICK_ORIGIN'
    | 'TUTORIAL_PRE_FLEET_AMOUNT'
    | 'TUTORIAL_PRE_TRANSACTION'
    | 'CHOOSE_FLEET_AMOUNT'
    | 'CREATING_TX'
    | 'WAITING_TX'
    | 'SUCCESS';
  data?: Data;
  error?: unknown;
};

class SendFlowStore extends BaseStoreWithData<SendFlow, Data> {
  constructor() {
    super({
      type: 'SEND',
      step: 'IDLE',
    });
  }

  async sendFrom(from: {x: number; y: number}): Promise<void> {
    if (this.$store.step == 'PICK_ORIGIN') {
      this.pickOrigin(from);
    } else {
      this.setData({from}, {step: 'CONNECTING'});
      await privateAccount.login();
      this.setPartial({step: 'PICK_DESTINATION'});
    }
  }

  async sendTo(to: {x: number; y: number}): Promise<void> {
    if (this.$store.step == 'PICK_DESTINATION') {
      this.pickDestination(to);
    } else {
      this.setData({to}, {step: 'CONNECTING'});
      await privateAccount.login();
      this.setPartial({step: 'PICK_ORIGIN'});
    }
  }

  async pickDestination(to: {x: number; y: number}): Promise<void> {
    if (this.$store.step !== 'PICK_DESTINATION') {
      throw new Error(`Need to be in step PICK_DESTINATION`);
    }
    this.setData({to});
    this._chooseFleetAmount();
  }

  async pickOrigin(from: {x: number; y: number}): Promise<void> {
    if (this.$store.step !== 'PICK_ORIGIN') {
      throw new Error(`Need to be in step PICK_ORIGIN`);
    }
    this.setData({from});
    this._chooseFleetAmount();
  }

  _chooseFleetAmount() {
    if (!privateAccount.isWelcomingStepCompleted(1)) {
      this.setPartial({step: 'TUTORIAL_PRE_FLEET_AMOUNT'});
    } else {
      this.setPartial({step: 'CHOOSE_FLEET_AMOUNT'});
    }
  }

  async acknowledgeWelcomingStep1() {
    privateAccount.recordWelcomingStep(1);
    this._chooseFleetAmount();
  }

  confirm(fleetAmount: number) {
    this.setData({fleetAmount});
    if (!privateAccount.isWelcomingStepCompleted(2)) {
      this.setPartial({step: 'TUTORIAL_PRE_TRANSACTION'});
    } else {
      this._confirm(fleetAmount);
    }
  }

  async acknowledgeWelcomingStep2() {
    if (!this.$store.data?.fleetAmount) {
      throw new Error(`not fleetAmount recorded`);
    }
    privateAccount.recordWelcomingStep(2);
    this.confirm(this.$store.data?.fleetAmount);
  }

  async _confirm(fleetAmount: number): Promise<void> {
    const flow = this.setPartial({step: 'CREATING_TX'});
    if (!flow.data) {
      throw new Error(`no data for send flow`);
    }

    const from = flow.data.from;
    const to = flow.data.to;
    const fromPlanetInfo = spaceInfo.getPlanetInfo(from.x, from.y);
    const toPlanetInfo = spaceInfo.getPlanetInfo(to.x, to.y);
    if (!fromPlanetInfo || !toPlanetInfo) {
      throw new Error(`cannot get to or from planet info`);
    }
    if (!wallet.address) {
      throw new Error(`no wallet address`);
    }
    if (!wallet.provider) {
      throw new Error(`no provider`);
    }

    if (!isCorrected) {
      // TODO extreact or remove (assume time will be corrected by then)
      const latestBlock = await wallet.provider.getBlock('latest');
      correctTime(latestBlock.timestamp);
    }

    const nonce = await wallet.provider.getTransactionCount(wallet.address);

    const {toHash, fleetId} = await privateAccount.hashFleet(from, to, nonce);

    this.setPartial({step: 'WAITING_TX'});

    // TODO type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tx: any;
    try {
      tx = await wallet.contracts?.OuterSpace.send(xyToLocation(from.x, from.y), fleetAmount, toHash, {nonce});
    } catch (e) {
      console.error(e);
      if (e.message && e.message.indexOf('User denied') >= 0) {
        this.setPartial({
          step: 'IDLE',
          error: undefined,
        });
        return;
      }
      this.setPartial({error: e, step: 'CHOOSE_FLEET_AMOUNT'});
      return;
    }

    const gToX = toPlanetInfo.location.globalX;
    const gToY = toPlanetInfo.location.globalY;
    const gFromX = fromPlanetInfo.location.globalX;
    const gFromY = fromPlanetInfo.location.globalY;
    const speed = fromPlanetInfo.stats.speed;
    const fullDistance = Math.floor(Math.sqrt(Math.pow(gToX - gFromX, 2) + Math.pow(gToY - gFromY, 2)));
    const fleetDuration = fullDistance * ((spaceInfo.timePerDistance * 10000) / speed);

    privateAccount.recordFleet(fleetId, {
      to: {...to}, // TODO handle it better
      from: {...from},
      fleetAmount,
      duration: fleetDuration, // TODO stricly speaking not necessary but allow us to not need to refetch the stats from spaceInfo
      launchTime: now(),
      owner: wallet.address,
      sendTx: {hash: tx.hash, nonce},
      updatedAt: now(),
    });

    this.setData({txHash: tx.hash}, {step: 'SUCCESS'});

    // TODO REMOVE DEBUG :
    // await tx.wait();
    // // TODO distance
    // // const distanceSquared =
    // //   Math.pow(to.location.globalX - from.location.globalX, 2) +
    // //   Math.pow(to.location.globalY - from.location.globalY, 2);
    // const distance = 1; // TODO Math.floor(Math.sqrt(distanceSquared));
    // await wallet.contracts.OuterSpace.resolveFleet(
    //   fleetId,
    //   xyToLocation(to.x, to.y),
    //   distance,
    //   secretHash
    // );
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

export default new SendFlowStore();
