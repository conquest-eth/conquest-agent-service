import {PrivateSpaceImpl, SpaceInfoImpl, SpaceImpl} from 'planet-wars-common';
import {StateAdapterFromPlanetCache} from './StateAdapterFromPlanetCache';
import contractsInfo from '../contracts.json';
import privateAccount from '../stores/privateAccount';

export const spaceInfo = new SpaceInfoImpl(
  contractsInfo.contracts.OuterSpace.linkedData
);
export const space = new SpaceImpl(spaceInfo, new StateAdapterFromPlanetCache());
export const privateSpace = new PrivateSpaceImpl(space, privateAccount);
