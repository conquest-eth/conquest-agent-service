import {BigNumber} from '@ethersproject/bignumber';
import {BaseStore} from '$lib/utils/stores';
import privateAccount from './privateAccount';
import {wallet} from './wallet';
import type {Wallet} from '@ethersproject/wallet';
import {space, spaceInfo} from '$lib/app/mapState';
import {xyToLocation} from '$lib/common/src';
import {now} from './time';

type Agent = {
  state: 'Idle' | 'Loading' | 'Ready';
  nextFleet?: {fleetId: string; time: number};
  balance: BigNumber;
  wallet?: Wallet;
  ownerAddress?: string;
  lowETH?: boolean;
  cost?: BigNumber;
};

class AgentStore extends BaseStore<Agent> {
  private timeout: NodeJS.Timeout | undefined;
  private lastTxTime = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private oldBeforeUnload: any;
  constructor() {
    super({state: 'Idle', balance: BigNumber.from(0)});
  }

  start(): void {
    this.setPartial({state: 'Loading'});
    this.timeout = setInterval(this.check.bind(this), 5 * 1000);
    if (typeof window !== 'undefined') {
      this.oldBeforeUnload = window.onbeforeunload;
      window.onbeforeunload = () => {
        privateAccount.agentIsAlive(false);
        if (this.oldBeforeUnload) {
          this.oldBeforeUnload();
        }
      };
    }
  }

  getNextFleet(): {fleetId: string; time: number} | undefined {
    const fleets = privateAccount
      .getFleetsWithId()
      .map((fleet) => {
        const arrivalTime =
          (fleet.actualLaunchTime || fleet.launchTime) +
          space.timeToArrive({location: fleet.from}, {location: fleet.to});
        return {...fleet, arrivalTime};
      })
      .filter((fleet) => {
        if (fleet.resolveTx) {
          return false;
        }
        if (fleet.arrivalTime <= now()) {
          // too late
          return false;
        }
        return true;
      })
      .sort((a, b) => a.arrivalTime - b.arrivalTime);

    return fleets.length > 0 ? {time: fleets[0].arrivalTime, fleetId: fleets[0].id} : undefined;
  }

  async topup() {
    if (!wallet.provider) {
      throw new Error(`wallet provider missing`);
    }
    if (!this.$store.cost) {
      throw new Error(`no cost`);
    }
    wallet.provider?.getSigner().sendTransaction({
      to: this.$store.wallet?.address,
      value: this.$store.cost.mul(10),
    });
  }

  async check() {
    if (privateAccount.ready && wallet.provider && wallet.address && wallet.contracts) {
      if (this.$store.ownerAddress && wallet.address !== this.$store.ownerAddress) {
        stop();
        this.setPartial({
          state: 'Idle',
          nextFleet: undefined,
          balance: BigNumber.from(0),
          ownerAddress: undefined,
          wallet: undefined,
        });
        return;
      }
      const gasPrice = await wallet.provider.getGasPrice();
      const cost = gasPrice.mul(100000); // TODO config
      const ownerAddress = wallet.address;
      const agentWallet = await privateAccount.getAgentWallet();
      const balance = await wallet.provider.getBalance(agentWallet.address);
      const nextFleet = this.getNextFleet();

      if (ownerAddress === wallet.address) {
        this.setPartial({
          state: 'Ready',
          balance,
          nextFleet,
          wallet: agentWallet,
          ownerAddress: wallet.address,
          lowETH: balance.lt(cost),
          cost,
        });

        this.resolveFleetsIfAny();
      }
    } else {
      this.setPartial({
        state: 'Loading',
        nextFleet: undefined,
        balance: BigNumber.from(0),
        wallet: undefined,
      });
    }
  }

  stop() {
    if (this.timeout) {
      clearInterval(this.timeout);
      this.timeout = undefined;
    }
    if (typeof window !== 'undefined') {
      window.onbeforeunload = this.oldBeforeUnload;
    }
  }

  async resolveFleetsIfAny() {
    if (now() - this.lastTxTime < 60) {
      return;
    }
    if (this.$store.nextFleet && now() > this.$store.nextFleet.time) {
      const fleetId = this.$store.nextFleet.fleetId;
      const fleet = privateAccount.getFleet(fleetId);
      if (!fleet) {
        throw new Error(`no fleet with id ${fleetId}`);
      }
      if (!this.$store.wallet) {
        throw new Error(`no agent wallet setup`);
      }
      if (!wallet.contracts) {
        throw new Error(`no contracts setup`);
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
      try {
        const contract = wallet.contracts.OuterSpace.connect(this.$store.wallet);
        this.lastTxTime = now();
        const tx = await contract.resolveFleet(
          fleetId,
          xyToLocation(fleet.from.x, fleet.from.y),
          xyToLocation(fleet.to.x, fleet.to.y),
          distance,
          secretHash
        );
        privateAccount.recordFleetResolvingTxhash(fleetId, tx.hash, tx.nonce, true);
      } catch (e) {
        console.error(e);
      }
    } else {
      if (!this.$store.lowETH) {
        await privateAccount.agentIsAlive();
      }
    }
  }
}

export const agent = new AgentStore();
