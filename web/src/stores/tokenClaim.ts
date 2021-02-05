import {wallet, chain, flow} from './wallet';
// import type {BigNumber} from '@ethersproject/bignumber';
import type {ChainStore, WalletStore} from 'web3w';
import {BaseStore} from '../lib/utils/stores';
import {Wallet} from '@ethersproject/wallet';
import {rebuildLocationHash} from '../lib/utils/web';

type TokenClaim = {
  inUrl: boolean;
  state: 'Loading' | 'Available' | 'Claiming' | 'Claimed';
  error?: unknown;
};

class TokenClaimStore extends BaseStore<TokenClaim> {
  constructor(private wallet: WalletStore, private chain: ChainStore) {
    super({
      inUrl: !!window.hashParams.tokenClaim,
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
    return new Wallet(window.hashParams.tokenClaim);
  }

  clearURL(): void {
    delete window.hashParams.tokenClaim;
    rebuildLocationHash(window.hashParams);
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
    const playToken = wallet.chain.contracts.PlayToken;
    const balance = await playToken.balanceOf(claimWallet.address);
    if (balance.eq(0)) {
      this.setPartial({state: 'Claimed'});
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
    const playToken = wallet.chain.contracts.PlayToken.connect(claimWallet);
    const ethBalance = await wallet.provider.getBalance(claimWallet.address);
    const tokenBalance = await playToken.balanceOf(claimWallet.address);
    if (tokenBalance.eq(0)) {
      // TODO
    }

    const nonce = wallet.provider.getTransactionCount(
      claimWallet.address,
      'latest'
    );

    const estimate = await playToken.estimateGas.transferAlongWithETH(
      wallet.address,
      tokenBalance,
      {value: 1, nonce}
    );
    const gasPrice = await wallet.provider.getGasPrice();

    const ethLeft = ethBalance.sub(estimate.mul(gasPrice));
    const tx = await playToken.transferAlongWithETH(
      wallet.address,
      tokenBalance,
      {
        value: ethLeft,
        nonce,
      }
    );
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
  //         this.wallet.contracts.PlayToken.balanceOf(address).then((b) => ({
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
  //         this.wallet.contracts.PlayToken.allowance(
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
