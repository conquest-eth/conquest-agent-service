// import {expect} from '../chai-setup';
import {expectRevert, waitFor} from '../test-utils';
import {sendInSecret, setupOuterSpace, fetchPlanetState} from './utils';
import {BigNumber} from '@ethersproject/bignumber';
// import {expect} from '../chai-setup';
import {ethers} from 'hardhat';

const stableTokenUnit = BigNumber.from('1000000000000000000');
describe('OuterSpace', function () {
  it('user can acquire virgin planet', async function () {
    const {players, spaceInfo} = await setupOuterSpace();
    const pointer = spaceInfo.findNextPlanet();
    await waitFor(
      players[0].OuterSpace.stake(
        players[0].address,
        pointer.data.location.id,
        stableTokenUnit
      )
    );
  });

  it('user cannot acquire planet already onwed by another player', async function () {
    const {players, spaceInfo} = await setupOuterSpace();
    const pointer = spaceInfo.findNextPlanet();
    await waitFor(
      players[0].OuterSpace.stake(
        players[0].address,
        pointer.data.location.id,
        stableTokenUnit
      )
    );
    await expectRevert(
      players[1].OuterSpace.stake(
        players[1].address,
        pointer.data.location.id,
        stableTokenUnit
      )
    );
  });

  it("user can attack other player's planet", async function () {
    const {
      players,
      spaceInfo,
      outerSpaceContract,
      increaseTime,
      getTime,
    } = await setupOuterSpace();
    const p0 = spaceInfo.findNextPlanet();
    let planet0 = await fetchPlanetState(outerSpaceContract, p0.data);
    let planet1 = await fetchPlanetState(
      outerSpaceContract,
      spaceInfo.findNextPlanet(p0).data
    );
    await waitFor(
      players[0].OuterSpace.stake(
        players[0].address,
        planet0.location.id,
        stableTokenUnit
      )
    );
    await waitFor(
      players[1].OuterSpace.stake(
        players[1].address,
        planet1.location.id,
        stableTokenUnit
      )
    );
    planet0 = await fetchPlanetState(outerSpaceContract, planet0);
    planet1 = await fetchPlanetState(outerSpaceContract, planet1);

    const sent = await sendInSecret(players[1], {
      from: planet1,
      quantity: planet1.getNumSpaceships(getTime()),
      to: planet0,
    });
    if (!sent) {
      throw new Error('no fleet found');
    }
    const {fleetId, secret, to, distance, timeRequired} = sent;
    await increaseTime(timeRequired);
    await waitFor(
      players[1].OuterSpace.resolveFleet(fleetId, to, distance, secret)
    );
  });

  it('planet production maches estimate', async function () {
    const {
      players,
      spaceInfo,
      outerSpaceContract,
      increaseTime,
      getTime,
    } = await setupOuterSpace();
    let planet = await fetchPlanetState(
      outerSpaceContract,
      spaceInfo.findNextPlanet().data
    );
    await waitFor(
      players[0].OuterSpace.stake(
        players[0].address,
        planet.location.id,
        stableTokenUnit
      )
    );
    planet = await fetchPlanetState(outerSpaceContract, planet);
    const fistTime = (await ethers.provider.getBlock('latest')).timestamp;
    console.log({fistTime});
    await sendInSecret(players[0], {
      from: planet,
      quantity: planet.getNumSpaceships(getTime()),
      to: planet,
    });
    await increaseTime(1000);
    const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
    const new_planet = await fetchPlanetState(outerSpaceContract, planet);
    const quantity = new_planet.getNumSpaceships(currentTime);
    console.log({quantity, currentTime});
    await sendInSecret(players[0], {
      from: planet,
      quantity,
      to: planet,
    });
    const currentTimeAgain = (await ethers.provider.getBlock('latest'))
      .timestamp;
    const new_planet_again = await fetchPlanetState(outerSpaceContract, planet);
    const quantityAgain = new_planet_again.getNumSpaceships(currentTimeAgain);
    console.log({quantityAgain, currentTimeAgain});
    await expectRevert(
      sendInSecret(players[0], {
        from: planet,
        quantity: quantityAgain + 1,
        to: planet,
      })
    );
  });
});
