import {BigNumber} from '@ethersproject/bignumber';
import {BaseStore} from '$lib/utils/stores';
import privateAccount from './privateAccount';
import {wallet} from './wallet';
import type {Wallet} from '@ethersproject/wallet';
import {space, spaceInfo} from '$lib/app/mapState';
import {xyToLocation} from 'conquest-eth-common';
import {now} from './time';
import type {Event} from '@ethersproject/contracts';

type FleetArrivedEvent = Event & {
  args: {
    fleet: BigNumber;
    fleetOwner: string;
    destinationOwner: string;
    destination: BigNumber;
    fleetLoss: number;
    planetLoss: number;
    inFlightFleetLoss: number;
    inFlightPlanetLoss: number;
    won: boolean;
    newNumspaceships: number;
  };
};

type Agent = {
  state: 'Idle' | 'Loading' | 'Ready';
  nextFleets?: {fleetId: string; time: number}[];
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

  getNextFleets(): {fleetId: string; time: number}[] | undefined {
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
        if (fleet.arrivalTime + spaceInfo.resolveWindow <= now()) {
          // too late
          return false;
        }
        return true;
      })
      .sort((a, b) => a.arrivalTime - b.arrivalTime);

    return fleets.map((v) => {
      return {time: v.arrivalTime, fleetId: v.id};
    });
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
          nextFleets: undefined,
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
      const nextFleets = this.getNextFleets();

      if (ownerAddress === wallet.address) {
        this.setPartial({
          state: 'Ready',
          balance,
          nextFleets,
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
        nextFleets: undefined,
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
    if (this.$store.nextFleets && this.$store.nextFleets.length > 0) {
      await this.attemptResolution(this.$store.nextFleets);
    } else {
      if (!this.$store.lowETH) {
        await privateAccount.agentIsAlive();
      }
    }
  }

  async attemptResolution(fleetsToResolve: {fleetId: string; time: number}[], i = 0) {
    try {
      await this.resolveFleet(fleetsToResolve[i]);
    } catch (e) {
      console.error('ERROR while attempting to resolve');
      console.error(e);
      i++;
      if (fleetsToResolve.length > i) {
        console.log('checking next fleet...');
        await this.attemptResolution(fleetsToResolve, i);
      }
    }
  }

  async resolveFleet(fleetToResolve: {fleetId: string; time: number}) {
    if (now() < fleetToResolve.time) {
      const fleetId = fleetToResolve.fleetId;
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

      const contract = wallet.contracts.OuterSpace.connect(this.$store.wallet);
      this.lastTxTime = now();
      let gas: BigNumber;
      try {
        gas = await contract.estimateGas.resolveFleet(
          BigNumber.from(fleetId).add(1),
          xyToLocation(fleet.from.x, fleet.from.y),
          xyToLocation(fleet.to.x, fleet.to.y),
          distance,
          secretHash
        );
      } catch (e) {
        console.error('error with the fleet, checking if it has already been resolved....');
        const filter = contract.filters.FleetArrived(fleetId);
        const logs = ((await contract.queryFilter(filter)) as unknown) as FleetArrivedEvent[];
        if (logs && logs.length > 0) {
          console.log('resolution event found...');
          const transaction = await logs[0].getTransaction();
          privateAccount.recordFleetResolvingTxhash(fleetId, logs[0].transactionHash, transaction.nonce, true);
          console.log('recorded...');
          return;
        }
        throw e;
      }
      const gasToUse = gas.add(40000);
      const tx = await contract.resolveFleet(
        fleetId,
        xyToLocation(fleet.from.x, fleet.from.y),
        xyToLocation(fleet.to.x, fleet.to.y),
        distance,
        secretHash,
        {gasLimit: gasToUse}
      );
      privateAccount.recordFleetResolvingTxhash(fleetId, tx.hash, tx.nonce, true);
    }
  }
}

export const agent = new AgentStore();
