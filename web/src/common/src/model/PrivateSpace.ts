import type {OwnFleet, TxStatus} from '../types';
import {PlanetFetch, Space, TimeKeeper} from './Space';
import type {SpaceInfo} from './SpaceInfo';

export class PrivateSpace extends Space {
  constructor(
    spaceInfo: SpaceInfo,
    fetch: PlanetFetch,
    timeKeeper: TimeKeeper,
    private privateAccount: {
      walletAddress?: string;
      getFleets(): OwnFleet[];
      txStatus(txHash: string): TxStatus | null | 'Loading';
      capturingStatus(location: string): TxStatus | null | 'Loading';
    }
  ) {
    super(spaceInfo, fetch, timeKeeper);
  }
  get player(): string | undefined {
    return this.privateAccount.walletAddress;
  }
  getOwnFleets(): OwnFleet[] {
    return this.privateAccount.getFleets();
  }

  txStatus(txHash: string): TxStatus | null | 'Loading' {
    return this.privateAccount.txStatus(txHash);
  }

  capturingStatus(planetId: string): TxStatus | null | 'Loading' {
    return this.privateAccount.capturingStatus(planetId);
  }
  // getFleetsFrom(x: number, y: number): Fleet[] {
  //   return []; // TODO filter getFleets()
  // }
  // getFleetsTo(x: number, y: number): Fleet[] {
  //   return []; // TODO filter getFleets()
  // }
}
