import {wallet} from './wallet';
import privateAccount from './privateAccount';
import {BaseStoreWithData} from '../lib/utils/stores';
import {spaceInfo} from '../app/mapState';
import {locationToXY} from '../common/src';
import {BigNumber} from '@ethersproject/bignumber';
import {defaultAbiCoder} from '@ethersproject/abi';

type Data = {txHash?: string; location: string};
export type ClaimFlow = {
  type: 'CLAIM';
  step:
    | 'IDLE'
    | 'CONNECTING'
    | 'CHOOSE_STAKE'
    | 'CREATING_TX'
    | 'WAITING_TX'
    | 'SUCCESS';
  data?: Data;
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

  async claim(location: string): Promise<void> {
    this.setPartial({data: {location}, step: 'CONNECTING'});
    await privateAccount.login();
    this.setPartial({step: 'CHOOSE_STAKE'});
  }

  async confirm(): Promise<void> {
    const flow = this.setPartial({step: 'WAITING_TX'});
    if (!flow.data) {
      throw new Error(`no flow data`);
    }
    const latestBlock = await wallet.provider?.getBlock('latest');
    if (!latestBlock) {
      throw new Error(`can't fetch latest block`);
    }
    // console.log('HELLO');
    const location = flow.data?.location;
    const {x, y} = locationToXY(location);
    const planetInfo = spaceInfo.getPlanetInfo(x, y);
    if (!planetInfo) {
      throw new Error(`no planet at ${location}`);
    }
    const tx = await wallet.contracts?.PlayToken.transferAndCall(
      wallet.contracts?.OuterSpace.address,
      BigNumber.from(planetInfo.stats.stake).mul('1000000000000000000'),
      defaultAbiCoder.encode(['address', 'uint256'], [wallet.address, location])
    );

    privateAccount.recordCapture(
      flow.data.location,
      tx.hash,
      latestBlock.timestamp,
      tx.nonce
    ); // TODO check
    this.setData({txHash: tx.hash}, {step: 'SUCCESS'});
  }

  private _reset() {
    this.setPartial({step: 'IDLE', data: undefined});
  }
}

export default new ClaimFlowStore();
