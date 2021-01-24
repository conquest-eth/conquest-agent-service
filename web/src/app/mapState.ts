import {PrivateSpace, SpaceInfo, PlanetData} from 'planet-wars-common';
import contractsInfo from '../contracts.json';
import privateAccount from '../stores/privateAccount';
import {fallback, chain} from '../stores/wallet';

const timeKeeper = {
  setTimeout(fn: () => void, sec: number) {
    return (setTimeout(fn, sec * 1000) as unknown) as number;
  },
  clearTimeout(t: number) {
    return clearTimeout(t);
  },
  getTime() {
    return Math.floor(Date.now() / 1000);
  },
};

async function fetch(
  planetIds: string[]
): Promise<{
  planetStates: PlanetData[];
  discovered: {minX: number; minY: number; maxX: number; maxY: number};
}> {
  const contracts = chain.contracts || fallback.contracts;
  if (contracts) {
    return contracts.OuterSpace.getPlanetStates(planetIds);
    // const result = await contracts.OuterSpace.functions.getPlanetStates(planetIds);
    // return result[0];
  } else if (fallback.state === 'Ready') {
    // TODO should indicate fallback is being connected to on the UI ()
    throw new Error('no contracts to fetch with');
  } else {
    console.log('not ready');
  }
  return {planetStates: [], discovered: {minX: 1, minY: 1, maxX: 1, maxY: 1}};
}

export const spaceInfo = new SpaceInfo(
  contractsInfo.contracts.OuterSpace.linkedData
);
export const space = new PrivateSpace(
  spaceInfo,
  fetch,
  timeKeeper,
  privateAccount
);
