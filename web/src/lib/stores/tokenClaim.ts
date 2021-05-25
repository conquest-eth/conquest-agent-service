import {wallet, chain, flow} from './wallet';
// import type {BigNumber} from '@ethersproject/bignumber';
import type {ChainStore, WalletStore} from 'web3w';
import {BaseStore} from '$lib/utils/stores/base';
import {Wallet} from '@ethersproject/wallet';
import {rebuildLocationHash} from '$lib/utils/web';
import {hashParams} from '$lib/config';

type TokenClaim = {
  inUrl: boolean;
  state: 'Loading' | 'Available' | 'Claiming' | 'Claimed' | 'AlreadyClaimed' | 'AlreadyClaimedAnother';
  error?: unknown;
};

class TokenClaimStore extends BaseStore<TokenClaim> {
  constructor(private wallet: WalletStore, private chain: ChainStore) {
    super({
      inUrl: !!hashParams.tokenClaim,
      state: 'Loading',
    });

    this.wallet.subscribe(() => {
      this.onConnection();
    });

    this.chain.subscribe(() => {
      this.onConnection();
    });
  }

  onConnection() {
    if (wallet.chain && wallet.chain.state === 'Ready') {
      this.check();
    }
  }

  acknowledgeError() {
    this.setPartial({error: undefined});
  }

  getClaimtWallet(): Wallet {
    return new Wallet(hashParams.tokenClaim);
  }

  clearURL(): void {
    delete hashParams.tokenClaim;
    rebuildLocationHash(hashParams);
    this.setPartial({inUrl: false});
  }

  async check() {
    if (!this.$store.inUrl) {
      return;
    }
    if (!wallet.provider) {
      throw new Error(`no wallet.provider`);
    }
    if (!wallet.chain.contracts) {
      throw new Error(`no wallet.chain.contracts`);
    }
    const claimWallet = this.getClaimtWallet();
    const playToken_l2 = wallet.chain.contracts.PlayToken_L2;
    const balance = await playToken_l2.balanceOf(claimWallet.address);

    if (wallet.address) {
      const touched = await playToken_l2.touched(wallet.address);
      if (touched) {
        this.setPartial({state: 'AlreadyClaimedAnother'});
        return;
      }
    }

    if (balance.eq(0)) {
      this.setPartial({state: 'AlreadyClaimed'});
    } else {
      this.setPartial({state: 'Available'});
    }
  }

  async claim() {
    if (!wallet.provider) {
      throw new Error(`no wallet.provider`);
    }
    if (!wallet.chain.contracts) {
      throw new Error(`no wallet.chain.contracts`);
    }
    const claimWallet = this.getClaimtWallet().connect(wallet.provider);
    const playToken_l2 = wallet.chain.contracts.PlayToken_L2.connect(claimWallet);
    const ethBalance = await wallet.provider.getBalance(claimWallet.address);
    const tokenBalance = await playToken_l2.balanceOf(claimWallet.address);
    if (tokenBalance.eq(0)) {
      // TODO
    }

    const nonce = wallet.provider.getTransactionCount(claimWallet.address, 'latest');

    const estimate = await playToken_l2.estimateGas.transferAlongWithETH(wallet.address, tokenBalance, {
      value: 1,
      nonce,
    });
    const gasPrice = await wallet.provider.getGasPrice();

    const ethLeft = ethBalance.sub(estimate.mul(gasPrice));
    const tx = await playToken_l2.transferAlongWithETH(wallet.address, tokenBalance, {
      value: ethLeft,
      nonce,
    });
    this.setPartial({state: 'Claiming'});
    await tx.wait();
    this.setPartial({state: 'Claimed'});
  }

  // protected async fetchFor<T, P>(
  //   address: string,
  //   func: (address: string) => Promise<P>
  // ): Promise<P> {
  //   const partial = await func(address);
  //   if (this.$store.account === address) {
  //     this.setPartial(partial);
  //   }
  //   return partial;
  // }

  // private triggerUpdates() {
  //   this.update();
  // }

  // private async update() {
  //   if (this.wallet.contracts) {
  //     this.setPartial({
  //       status: 'Ready', // Fetching?
  //     });
  //     try {
  //       await this.fetchFor(this.$store.account, (address) =>
  //         this.wallet.contracts.PlayToken_L2.balanceOf(address).then((b) => ({
  //           balance: b,
  //         }))
  //       );
  //     } catch (e) {
  //       this.setPartial({
  //         error: e,
  //       });
  //     }
  //     try {
  //       await this.fetchFor(this.$store.account, (address) =>
  //         this.wallet.contracts.PlayToken_L2.allowance(
  //           address,
  //           this.wallet.contracts.OuterSpace.address
  //         ).then((v) => ({allowanceForOuterSpace: v}))
  //       );
  //     } catch (e) {
  //       this.setPartial({
  //         error: e,
  //       });
  //     }
  //   } else {
  //     this.setPartial({
  //       status: 'WaitingContracts',
  //     });
  //   }
  //   setTimeout(this.update.bind(this), 1000); // TODO config delay;
  // }
}

export default new TokenClaimStore(wallet, chain);
