import {expect} from '../chai-setup';
import {objMap} from '../test-utils';
import {setupOuterSpace, convertPlanetCallData} from './utils';

describe('JS <-> Solidity equivalence', function () {
  it('planet stats computed from js equal stats from the contract', async function () {
    const {players, spaceInfo} = await setupOuterSpace();
    const pointer = spaceInfo.findNextPlanet();
    const {location, stats} = pointer.data;
    const planet = await players[0].OuterSpace.callStatic.getPlanet(
      location.id
    );
    const statsFromContract = objMap(planet.stats, convertPlanetCallData);
    console.log({stats});
    console.log({statsFromContract});
    expect(statsFromContract).to.eql(stats);
  });
});
