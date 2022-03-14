import {wallet} from '../blockchain/wallet';
import {BigNumber} from '@ethersproject/bignumber';
import type {WalletStore} from 'web3w';
import {AutoStartBaseStore} from '$lib/utils/stores/base';
import {highFrequencyFetch} from '$lib/config';
import type {SpaceQueryWithPendingState} from '$lib/space/optimisticSpace';
import {spaceQueryWithPendingActions} from '$lib/space/optimisticSpace';
import {spaceInfo} from '$lib/space/spaceInfo';

type TokenAccountData = {
  status: 'Ready' | 'Fetching' | 'WaitingContracts' | 'Idle';
  account?: string;
  contractBalance?: BigNumber;
  balance?: BigNumber;
  allowanceForOuterSpace?: BigNumber;
  error?: unknown;
};

class TokenAccount extends AutoStartBaseStore<TokenAccountData> {
  protected lastWalletStatus: string;
  protected tokenPending: BigNumber = BigNumber.from(0);

  private stopWalletSubscription: () => void;
  private stoOptimisticSpaceSubscription: () => void;

  constructor(private wallet: WalletStore) {
    super({
      status: 'Idle',
    });
  }

  _onStart(): () => void {
    this.stopWalletSubscription = this.wallet.subscribe(($wallet) => {
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
    this.stoOptimisticSpaceSubscription = spaceQueryWithPendingActions.subscribe(this.onSpaceUpdate.bind(this));
    return this.onStop.bind(this);
  }

  private onStop() {
    if (this.stopWalletSubscription) {
      this.stopWalletSubscription();
      this.stopWalletSubscription = undefined;
    }
    if (this.stoOptimisticSpaceSubscription) {
      this.stoOptimisticSpaceSubscription();
      this.stoOptimisticSpaceSubscription = undefined;
    }
  }

  private onSpaceUpdate(update: SpaceQueryWithPendingState): void {
    this.tokenPending = BigNumber.from(0);
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
        } else if (pendingAction.status === 'PENDING') {
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
            const contractBalance = await this.wallet.contracts?.ConquestToken.balanceOf(address).then(
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
        console.error(`failed to fetch token balance`, e);
        this.setPartial({
          error: e,
        });
      }
      try {
        if (this.$store.account) {
          await this.fetchFor(this.$store.account, (address) =>
            this.wallet.contracts?.ConquestToken.allowance(address, this.wallet.contracts.OuterSpace.address).then(
              (v: BigNumber) => ({allowanceForOuterSpace: v})
            )
          );
        }
      } catch (e) {
        console.error(`failed to fetch token allowance`, e);
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

export const tokenAccount = new TokenAccount(wallet);

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).tokenAccount = tokenAccount;
}
