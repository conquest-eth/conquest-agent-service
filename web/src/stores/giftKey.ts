// import {wallet, chain} from './wallet';
// import type {BigNumber} from '@ethersproject/bignumber';
// import type {WalletStore} from 'web3w';
// import {BaseStore} from '../lib/utils/stores';

type Gift = {
  status: 'Ready' | 'WaitingContracts' | 'Idle' | 'Pendig' | 'Done';
  error?: unknown;
};

// class GiftKey extends BaseStore<Gift> {
//   constructor(private wallet: WalletStore) {
//     super({
//       status: 'Idle',
//     });

//     this.wallet.subscribe(($wallet) => {
//       if ($wallet.address !== null) {
//       }
//     });
//   }

//   acknowledgeError() {
//     this.setPartial({error: undefined});
//   }

//   protected async fetchFor<T, P>(
//     address: string,
//     func: (address: string) => Promise<P>
//   ): Promise<P> {
//     const partial = await func(address);
//     if (this.$store.account === address) {
//       this.setPartial(partial);
//     }
//     return partial;
//   }

//   private triggerUpdates() {
//     this.update();
//   }

//   private async update() {
//     if (this.wallet.contracts) {
//       this.setPartial({
//         status: 'Ready', // Fetching?
//       });
//       try {
//         await this.fetchFor(this.$store.account, (address) =>
//           this.wallet.contracts.PlayToken.balanceOf(address).then((b) => ({
//             balance: b,
//           }))
//         );
//       } catch (e) {
//         this.setPartial({
//           error: e,
//         });
//       }
//       try {
//         await this.fetchFor(this.$store.account, (address) =>
//           this.wallet.contracts.PlayToken.allowance(
//             address,
//             this.wallet.contracts.OuterSpace.address
//           ).then((v) => ({allowanceForOuterSpace: v}))
//         );
//       } catch (e) {
//         this.setPartial({
//           error: e,
//         });
//       }
//     } else {
//       this.setPartial({
//         status: 'WaitingContracts',
//       });
//     }
//     setTimeout(this.update.bind(this), 1000); // TODO config delay;
//   }
// }

// export const playTokenAccount = new PlayTokenAccount(wallet);

/* eslint-disable @typescript-eslint/no-explicit-any */
// if (typeof window !== 'undefined') {
//   (window as any).playTokenAccount = playTokenAccount;
// }
/* eslint-enable @typescript-eslint/no-explicit-any */
