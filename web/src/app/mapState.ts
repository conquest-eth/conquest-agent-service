import {PrivateSpaceImpl, SpaceInfoImpl, SpaceImpl} from 'planet-wars-common';
import {StateAdapterFromTheGraph} from './StateAdapterFromTheGraph';
import contractsInfo from '../contracts.json';
import privateAccount from '../stores/privateAccount';

export const spaceInfo = new SpaceInfoImpl(
  contractsInfo.contracts.OuterSpace.linkedData
);
export const space = new SpaceImpl(spaceInfo, new StateAdapterFromTheGraph());
export const privateSpace = new PrivateSpaceImpl(space, privateAccount);
