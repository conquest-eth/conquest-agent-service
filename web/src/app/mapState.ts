import {PrivateSpace, SpaceInfo, PlanetData} from 'planet-wars-common';
import contractsInfo from '../contracts.json';
import privateAccount from '../stores/privateAccount';
import {fallback, chain} from '../stores/wallet';

const timeKeeper = {setTimeout(fn, sec) {
  return setTimeout(fn, sec * 1000)
}, getTime() {
  return Math.floor(Date.now() / 1000)
}}

async function fetch(planetIds: string[]): Promise<PlanetData[]> {
  const contracts = chain.contracts || fallback.contracts;
  if (contracts) {
    return contracts.OuterSpace.getPlanetStates(planetIds);
    // const result = await contracts.OuterSpace.functions.getPlanetStates(planetIds);
    // return result[0];
  } else if (fallback.state === 'Ready') { // TODO should indicate fallback is being connected to on the UI ()
    throw new Error('no contracts to fetch with');
  } else {
    console.log('not ready');
  }
  return [];
}


export const spaceInfo = new SpaceInfo(
  contractsInfo.contracts.OuterSpace.linkedData
);
export const space = new PrivateSpace(spaceInfo, fetch, timeKeeper, privateAccount);
space.focus(0,0);
