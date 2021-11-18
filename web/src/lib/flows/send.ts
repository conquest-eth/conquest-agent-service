import {wallet} from '$lib/blockchain/wallet';
import {privateWallet} from '$lib/account/privateWallet';
import {account} from '$lib/account/account';
import {xyToLocation} from 'conquest-eth-common';
import {spaceInfo} from '$lib/space/spaceInfo';
import {BaseStoreWithData} from '$lib/utils/stores/base';
import {correctTime, isCorrected} from '$lib/time';
import {TutorialSteps} from '$lib/account/constants';
import {agentService} from '$lib/account/agentService';
import {playersQuery} from '$lib/space/playersQuery';
import {planets} from '$lib/space/planets';
import {get} from 'svelte/store';

type Data = {
  txHash?: string;
  to: {x: number; y: number};
  gift: boolean;
  from: {x: number; y: number};
  fleetAmount: number;
  useAgentService: boolean;
};

export type SendFlow = {
  type: 'SEND';
  step:
    | 'IDLE'
    | 'CONNECTING'
    | 'INACTIVE_PLANET'
    | 'PICK_DESTINATION'
    | 'PICK_ORIGIN'
    | 'TUTORIAL_PRE_FLEET_AMOUNT'
    | 'TUTORIAL_PRE_TRANSACTION'
    | 'CHOOSE_FLEET_AMOUNT'
    | 'CREATING_TX'
    | 'WAITING_TX'
    | 'SUCCESS';
  data?: Data;
  error?: {message?: string};
};

function findCommonAlliances(arr1: string[], arr2: string[]): string[] {
  const result = [];
  for (const item1 of arr1) {
    if (arr2.indexOf(item1) !== -1) {
      result.push(item1);
    }
  }
  return result;
}

class SendFlowStore extends BaseStoreWithData<SendFlow, Data> {
  constructor() {
    super({
      type: 'SEND',
      step: 'IDLE',
    });
  }

  isGift(): boolean {
    return this.$store.data?.gift || false;
  }

  async sendFrom(from: {x: number; y: number}): Promise<void> {
    if (this.$store.step == 'PICK_ORIGIN') {
      this.pickOrigin(from);
    } else {
      await privateWallet.login();
      this.setData({from}, {step: 'PICK_DESTINATION'});
    }
  }

  async sendToInactivePlanet(to: {x: number; y: number}): Promise<void> {
    this.setData({to}, {step: 'INACTIVE_PLANET'});
  }

  async sendTo(to: {x: number; y: number}): Promise<void> {
    if (this.$store.step == 'PICK_DESTINATION') {
      this.pickDestination(to);
    } else {
      await privateWallet.login();
      this.setData({to}, {step: 'PICK_ORIGIN'});
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

  async _chooseFleetAmount() {
    const flow = this.setPartial({step: 'CREATING_TX'});
    if (flow.data) {
      const to = flow.data.to;
      const toPlanetInfo = spaceInfo.getPlanetInfo(to.x, to.y);
      const destinationPlanetState = get(planets.planetStateFor(toPlanetInfo));
      if (destinationPlanetState.owner) {
        if (destinationPlanetState.owner === wallet.address.toLowerCase()) {
          this.setData({gift: true});
        } else {
          await playersQuery.triggerUpdate();
          const me = playersQuery.getPlayer(wallet.address.toLowerCase());
          const destinationOwner = playersQuery.getPlayer(destinationPlanetState.owner);
          if (me && me.alliances.length > 0 && destinationOwner && destinationOwner.alliances.length > 0) {
            const potentialAlliances = findCommonAlliances(
              me.alliances.map((v) => v.address),
              destinationOwner.alliances.map((v) => v.address)
            );
            if (potentialAlliances.length > 0) {
              this.setData({gift: true});
            }
          }
        }
      }
    }

    if (!account.isWelcomingStepCompleted(TutorialSteps.TUTORIAL_FLEET_AMOUNT)) {
      this.setPartial({step: 'TUTORIAL_PRE_FLEET_AMOUNT'});
    } else {
      this.setPartial({step: 'CHOOSE_FLEET_AMOUNT'});
    }
  }

  async acknowledgeWelcomingStep1() {
    account.recordWelcomingStep(TutorialSteps.TUTORIAL_FLEET_AMOUNT);
    this._chooseFleetAmount();
  }

  confirm(fleetAmount: number, gift: boolean, useAgentService: boolean) {
    this.setData({fleetAmount, gift, useAgentService});
    if (!account.isWelcomingStepCompleted(TutorialSteps.TUTORIAL_FLEET_PRE_TRANSACTION)) {
      this.setPartial({step: 'TUTORIAL_PRE_TRANSACTION'});
    } else {
      this._confirm(fleetAmount, gift, useAgentService);
    }
  }

  async acknowledgeWelcomingStep2() {
    if (!this.$store.data?.fleetAmount) {
      throw new Error(`not fleetAmount recorded`);
    }
    if (this.$store.data?.gift === undefined) {
      throw new Error(`not gift recorded`);
    }
    account.recordWelcomingStep(TutorialSteps.TUTORIAL_FLEET_PRE_TRANSACTION);
    this.confirm(this.$store.data?.fleetAmount, this.$store.data?.gift, this.$store.data?.useAgentService);
  }

  async _confirm(fleetAmount: number, gift: boolean, useAgentService: boolean): Promise<void> {
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

    const playerAddress = wallet.address.toLowerCase();

    const latestBlock = await wallet.provider.getBlock('latest');
    if (!isCorrected) {
      // TODO extreact or remove (assume time will be corrected by then)
      correctTime(latestBlock.timestamp);
    }

    const nonce = await wallet.provider.getTransactionCount(playerAddress);

    const distance = spaceInfo.distance(fromPlanetInfo, toPlanetInfo);
    const duration = spaceInfo.timeToArrive(fromPlanetInfo, toPlanetInfo);
    const {toHash, fleetId, secretHash} = await account.hashFleet(from, to, gift, nonce, playerAddress);

    const gasPrice = (await wallet.provider.getGasPrice()).mul(2);

    let potentialAlliances: string[] | undefined;

    if (gift) {
      const destinationPlanetState = get(planets.planetStateFor(toPlanetInfo));
      if (destinationPlanetState.owner) {
        await playersQuery.triggerUpdate();
        const me = playersQuery.getPlayer(wallet.address.toLowerCase());
        const destinationOwner = playersQuery.getPlayer(destinationPlanetState.owner);
        console.log({me, destinationOwner});
        if (me && me.alliances.length > 0 && destinationOwner && destinationOwner.alliances.length > 0) {
          potentialAlliances = findCommonAlliances(
            me.alliances.map((v) => v.address),
            destinationOwner.alliances.map((v) => v.address)
          );
        }
      }
    }

    console.log({potentialAlliances});

    this.setPartial({step: 'WAITING_TX'});

    // TODO type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tx: any;
    try {
      tx = await wallet.contracts?.OuterSpace.send(xyToLocation(from.x, from.y), fleetAmount, toHash, {
        nonce,
        gasPrice,
      });
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

    // const gToX = toPlanetInfo.location.globalX;
    // const gToY = toPlanetInfo.location.globalY;
    // const gFromX = fromPlanetInfo.location.globalX;
    // const gFromY = fromPlanetInfo.location.globalY;
    // const speed = fromPlanetInfo.stats.speed;
    // const fullDistance = Math.floor(Math.sqrt(Math.pow(gToX - gFromX, 2) + Math.pow(gToY - gFromY, 2)));
    // const fleetDuration = fullDistance * ((spaceInfo.timePerDistance * 10000) / speed);

    account.recordFleet(
      {
        id: fleetId,
        to, // TODO handle it better
        from,
        fleetAmount,
        gift,
        potentialAlliances,
        owner: playerAddress,
      },
      tx.hash,
      latestBlock.timestamp,
      nonce // tx.nounce can be different it seems, metamask can change it, or maybe be even user
    );

    if (useAgentService) {
      const {queueID} = await agentService.submitReveal(
        fleetId,
        secretHash,
        from,
        to,
        distance,
        gift,
        potentialAlliances,
        latestBlock.timestamp,
        duration
      );
      account.recordQueueID(tx.hash, queueID);
    }

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

const store = new SendFlowStore();
export default store;

// TODO remove
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if ('undefined' !== typeof window) (window as any).sendFlow = store;
