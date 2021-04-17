import {BigNumber} from '@ethersproject/bignumber';
import {locationToXY} from 'conquest-eth-common';
import {spaceInfo} from '$lib/app/mapState';
import {BaseStore} from '$lib/utils/stores';
import privateAccount from './privateAccount';
import {wallet} from './wallet';
import {now} from './time';
import {finality} from '$lib/config';

type Withdrawals = {
  state: 'Idle' | 'Loading' | 'Ready';
  balance: BigNumber;
};

class WithdrawalsStore extends BaseStore<Withdrawals> {
  private timeout: NodeJS.Timeout | undefined;
  constructor() {
    super({state: 'Idle', balance: BigNumber.from(0)});
  }

  loadWithrawableBalance(): void {
    this.setPartial({state: 'Loading'});
    this.timeout = setInterval(this.check.bind(this), 1000);
  }

  getExits(): {location: string; stake: BigNumber}[] {
    return privateAccount.getSuccessfulExits().map((v) => {
      const xy = locationToXY(v);
      const planetInfo = spaceInfo.getPlanetInfo(xy.x, xy.y);
      return {
        location: v,
        stake: BigNumber.from(planetInfo?.stats.stake).mul('1000000000000000000'),
      };
    });
  }

  async check() {
    if (wallet.provider && wallet.address && wallet.contracts) {
      const latestBlock = await wallet.provider.getBlock('latest');
      const latestBlockNumber = latestBlock.number;
      const withdrawal = privateAccount.getWithdrawalTx();
      if (withdrawal) {
        const receipt = await wallet.provider.getTransactionReceipt(withdrawal.txHash);
        if (receipt) {
          if (receipt.status !== undefined && receipt.status === 0) {
            // show error
            return;
          } else {
            privateAccount.deleteWithdrawalTx(); // optimistic
          }
        } else {
          const finalNonce = await wallet.provider.getTransactionCount(wallet.address, latestBlockNumber - finality);
          if (finalNonce > withdrawal.nonce) {
            // TODO check for failure ? or success through contract call ?
            privateAccount.deleteWithdrawalTx();
          }
        }
      }

      // get withdrawal // wait for privateAccount to be ready
      let balanceToWithdraw = await wallet.contracts.OuterSpace.callStatic.balanceToWithdraw(wallet.address);
      const exits = this.getExits();
      const locations = exits.map((v) => v.location);
      const planetsData = await wallet.contracts.OuterSpace.callStatic.getPlanetStates(locations);
      const planets = planetsData.planetStates;
      const exitsToDelete = [];
      const exitsToConsider = [];
      for (let i = 0; i < exits.length; i++) {
        const planet = planets[i];
        const exit = exits[i];
        if (planet.owner.toLowerCase() !== wallet.address.toLowerCase() || planet.exitTime === 0) {
          exitsToDelete.push(exit.location);
        } else if (now() > planet.exitTime + spaceInfo.exitDuration) {
          exitsToConsider.push(exit);
        }
      }

      privateAccount.deleteExits(exitsToDelete);

      for (const exit of exitsToConsider) {
        balanceToWithdraw = balanceToWithdraw.add(exit.stake);
      }

      this.setPartial({state: 'Ready', balance: balanceToWithdraw});
    } else {
      this.setPartial({state: 'Loading', balance: BigNumber.from(0)});
    }
  }

  async withdraw() {
    if (wallet.address && wallet.contracts) {
      const locations = this.getExits().map((v) => v.location);
      const tx = await wallet.contracts.OuterSpace.fetchAndWithdrawFor(wallet.address, locations);
      privateAccount.recordWithdrawal(tx.hash, tx.nonce);
    } else {
      throw new Error(` not wallet or contracts`);
    }
  }

  stop() {
    if (this.timeout) {
      clearInterval(this.timeout);
      this.timeout = undefined;
    }
  }
}

export const withdrawals = new WithdrawalsStore();
