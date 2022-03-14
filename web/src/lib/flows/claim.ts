import {wallet} from '$lib/blockchain/wallet';
import {BaseStoreWithData} from '$lib/utils/stores/base';
import {spaceInfo} from '$lib/space/spaceInfo';
import {BigNumber} from '@ethersproject/bignumber';
import {defaultAbiCoder} from '@ethersproject/abi';
import {TutorialSteps} from '$lib/account/constants';
import {account} from '$lib/account/account';
import {privateWallet} from '$lib/account/privateWallet';
import {xyToLocation} from 'conquest-eth-common';

type Data = {txHash?: string; coords: {x: number; y: number}};
export type ClaimFlow = {
  type: 'CLAIM';
  step: 'IDLE' | 'CONNECTING' | 'CHOOSE_STAKE' | 'CREATING_TX' | 'WAITING_TX' | 'PROFILE_INFO' | 'SUCCESS';
  cancelingConfirmation?: boolean;
  data?: Data;
  error?: {message?: string}; // TODO other places: add message as optional field
};

class ClaimFlowStore extends BaseStoreWithData<ClaimFlow, Data> {
  public constructor() {
    super({
      type: 'CLAIM',
      step: 'IDLE',
    });
  }

  async cancelCancelation(): Promise<void> {
    this.setPartial({cancelingConfirmation: false});
  }

  async cancel(cancelingConfirmation = false): Promise<void> {
    if (cancelingConfirmation) {
      this.setPartial({cancelingConfirmation: true});
    } else {
      this._reset();
    }
  }

  async acknownledgeSuccess(): Promise<void> {
    // TODO automatic ?
    this._reset();
  }

  async acknownledgeError(): Promise<void> {
    this.setPartial({error: undefined});
  }

  async claim(coords: {x: number; y: number}): Promise<void> {
    this.setPartial({data: {coords}, step: 'CONNECTING'});
    await privateWallet.login();
    this.setPartial({step: 'CHOOSE_STAKE'});
  }

  async confirm(): Promise<void> {
    // await privateWallet.execute(async () => {
    await privateWallet.login();
    const flow = this.setPartial({step: 'CREATING_TX'});
    if (!flow.data) {
      this.setPartial({
        step: 'CHOOSE_STAKE',
        error: new Error(`no flow data`),
      });
      return;
    }
    if (!wallet.provider) {
      this.setPartial({
        step: 'CHOOSE_STAKE',
        error: new Error(`no provider`),
      });
      return;
    }
    let latestBlock;
    try {
      latestBlock = await wallet.provider.getBlock('latest');
    } catch (e) {
      this.setPartial({
        step: 'CHOOSE_STAKE',
        error: e,
      });
      return;
    }

    // console.log('HELLO');
    const planetInfo = spaceInfo.getPlanetInfo(flow.data.coords.x, flow.data.coords.y);
    if (!planetInfo) {
      this.setPartial({
        step: 'CHOOSE_STAKE',
        error: new Error(`no planet at ${flow.data.coords.x}, ${flow.data.coords.y}`),
      });
      return;
    }

    if (!account.isReady()) {
      this.setPartial({
        step: 'CHOOSE_STAKE',
        error: new Error(`account not ready`),
      });
      return;
    }

    let gasEstimation: BigNumber;
    try {
      gasEstimation = await wallet.contracts?.ConquestToken.estimateGas.transferAndCall(
        wallet.contracts?.OuterSpace.address,
        BigNumber.from(planetInfo.stats.stake).mul('1000000000000000000'),
        defaultAbiCoder.encode(
          ['address', 'uint256'],
          [wallet.address, xyToLocation(flow.data.coords.x, flow.data.coords.y)]
        )
      );
    } catch (e) {
      this.setPartial({
        step: 'CHOOSE_STAKE',
        error: e,
      });
      return;
    }
    // TODO gasEstimation for Acquire Planet
    const gasLimit = gasEstimation.add(100000);

    this.setPartial({step: 'WAITING_TX'});
    let tx: {hash: string; nonce: number};
    try {
      tx = await wallet.contracts?.ConquestToken.transferAndCall(
        wallet.contracts?.OuterSpace.address,
        BigNumber.from(planetInfo.stats.stake).mul('1000000000000000000'),
        defaultAbiCoder.encode(
          ['address', 'uint256'],
          [wallet.address, xyToLocation(flow.data.coords.x, flow.data.coords.y)]
        ),
        {gasLimit}
      );
    } catch (e) {
      console.error(e);
      if (this.$store.step === 'WAITING_TX') {
        if (e.message && e.message.indexOf('User denied') >= 0) {
          this.setPartial({
            step: 'IDLE',
            error: undefined,
          });
        } else {
          this.setPartial({error: e, step: 'CHOOSE_STAKE'});
        }
      }
      return;
    }

    // TODO check ? check what ? (need to give better comments :D)
    account.recordCapture(flow.data.coords, tx.hash, latestBlock.timestamp, tx.nonce);

    if (!account.isWelcomingStepCompleted(TutorialSteps.SUGGESTION_PROFILE)) {
      this.setData({txHash: tx.hash}, {step: 'PROFILE_INFO'});
    } else {
      this.setData({txHash: tx.hash}, {step: 'SUCCESS'});
    }
    // });
  }

  async acknowledgeProfileSuggestion() {
    account.recordWelcomingStep(TutorialSteps.SUGGESTION_PROFILE);
    if (this.$store.step === 'PROFILE_INFO') {
      this.setPartial({step: 'SUCCESS'});
    }
  }

  private _reset() {
    this.setPartial({step: 'IDLE', data: undefined});
  }
}
const store = new ClaimFlowStore();
export default store;

// TODO remove
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if ('undefined' !== typeof window) (window as any).claimFlow = store;
