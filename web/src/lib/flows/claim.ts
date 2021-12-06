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

  async cancel(): Promise<void> {
    this._reset();
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
    await privateWallet.execute(async () => {
      const flow = this.setPartial({step: 'WAITING_TX'});
      if (!flow.data) {
        throw new Error(`no flow data`);
      }
      const latestBlock = await wallet.provider?.getBlock('latest');
      if (!latestBlock) {
        throw new Error(`can't fetch latest block`);
      }
      // console.log('HELLO');
      const planetInfo = spaceInfo.getPlanetInfo(flow.data.coords.x, flow.data.coords.y);
      if (!planetInfo) {
        throw new Error(`no planet at ${flow.data.coords.x}, ${flow.data.coords.y}`);
      }

      if (!account.isReady()) {
        throw new Error(`account not ready`);
      }

      let tx;
      try {
        tx = await wallet.contracts?.PlayToken_L2.transferAndCall(
          wallet.contracts?.OuterSpace.address,
          BigNumber.from(planetInfo.stats.stake).mul('1000000000000000000'),
          defaultAbiCoder.encode(
            ['address', 'uint256'],
            [wallet.address, xyToLocation(flow.data.coords.x, flow.data.coords.y)]
          )
        );
      } catch (e) {
        console.error(e);
        if (e.message && e.message.indexOf('User denied') >= 0) {
          this.setPartial({
            step: 'IDLE',
            error: undefined,
          });
          return;
        }
        this.setPartial({error: e, step: 'CHOOSE_STAKE'});
        return;
      }

      account.recordCapture(flow.data.coords, tx.hash, latestBlock.timestamp, tx.nonce); // TODO check

      if (!account.isWelcomingStepCompleted(TutorialSteps.SUGGESTION_PROFILE)) {
        this.setData({txHash: tx.hash}, {step: 'PROFILE_INFO'});
      } else {
        this.setData({txHash: tx.hash}, {step: 'SUCCESS'});
      }
    });
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

export default new ClaimFlowStore();
