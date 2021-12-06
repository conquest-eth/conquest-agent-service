import {wallet} from '../blockchain/wallet';
import {BigNumber} from '@ethersproject/bignumber';
import type {WalletStore} from 'web3w';
import {BaseStore} from '$lib/utils/stores/base';
import {highFrequencyFetch} from '$lib/config';
import type {SpaceQueryWithPendingState} from '$lib/space/optimisticSpace';
import {spaceQueryWithPendingActions} from '$lib/space/optimisticSpace';
import {spaceInfo} from '$lib/space/spaceInfo';

type TokenAccount = {
  status: 'Ready' | 'Fetching' | 'WaitingContracts' | 'Idle';
  account?: string;
  contractBalance?: BigNumber;
  balance?: BigNumber;
  allowanceForOuterSpace?: BigNumber;
  error?: unknown;
};

class PlayTokenAccount extends BaseStore<TokenAccount> {
  protected lastWalletStatus: string;
  protected tokenPending: BigNumber = BigNumber.from(0);
  constructor(private wallet: WalletStore) {
    super({
      status: 'Idle',
    });
    this.wallet.subscribe(($wallet) => {
      if ($wallet.address !== this.$store.account || $wallet.state !== this.lastWalletStatus) {
        this.lastWalletStatus = $wallet.state;
        if ($wallet.address !== this.$store.account) {
          this.set({
            account: $wallet.address,
            status: 'Idle',
          });
        }
        this.triggerUpdates();
      }
    });
    spaceQueryWithPendingActions.subscribe(this.onSpaceUpdate.bind(this));
  }

  private onSpaceUpdate(update: SpaceQueryWithPendingState): void {
    const pendingActions = update.pendingActions;

    for (const pendingAction of pendingActions) {
      if (pendingAction.counted) {
        continue;
      }
      if (pendingAction.action.type === 'CAPTURE') {
        const captureAction = pendingAction.action;
        // TODO
        if (pendingAction.status === 'FAILURE') {
        } else if (pendingAction.status === 'CANCELED') {
        } else if (pendingAction.status === 'TIMEOUT') {
        } else {
          if (captureAction.planetCoords) {
            const planetInfo = spaceInfo.getPlanetInfo(captureAction.planetCoords.x, captureAction.planetCoords.y);
            this.tokenPending = BigNumber.from(planetInfo.stats.stake).mul('1000000000000000000');
            if (this.$store.contractBalance) {
              this.setPartial({
                balance: this.$store.contractBalance.sub(this.tokenPending),
              });
            }
          }
        }
      }
    }
  }

  acknowledgeError() {
    this.setPartial({error: undefined});
  }

  protected async fetchFor<T, P>(address: string, func: (address: string) => Promise<P>): Promise<P> {
    const partial = await func(address);
    if (this.$store.account === address) {
      this.setPartial(partial);
    }
    return partial;
  }

  private triggerUpdates() {
    this.update();
  }

  private async update() {
    if (this.wallet.contracts) {
      if (status === 'Idle') {
        this.setPartial({
          status: 'Fetching',
        });
      }

      try {
        if (this.$store.account) {
          await this.fetchFor(this.$store.account, async (address) => {
            const contractBalance = await this.wallet.contracts?.PlayToken_L2.balanceOf(address).then(
              (b: BigNumber) => ({
                contractBalance: b,
                balance: b.sub(this.tokenPending),
              })
            );
            // TODO handle pendingActions (captures)
            return contractBalance;
          });
        }
      } catch (e) {
        this.setPartial({
          error: e,
        });
      }
      try {
        if (this.$store.account) {
          await this.fetchFor(this.$store.account, (address) =>
            this.wallet.contracts?.PlayToken_L2.allowance(address, this.wallet.contracts.OuterSpace.address).then(
              (v: BigNumber) => ({allowanceForOuterSpace: v})
            )
          );
        }
      } catch (e) {
        this.setPartial({
          error: e,
        });
      }
      this.setPartial({
        status: 'Ready',
      });
      setTimeout(this.update.bind(this), highFrequencyFetch * 1000);
    } else {
      this.setPartial({
        status: 'WaitingContracts',
      });
      setTimeout(this.update.bind(this), 1000); // faster update until contracts are available
    }
  }
}

export const playTokenAccount = new PlayTokenAccount(wallet);

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).playTokenAccount = playTokenAccount;
}
