// import {expect} from '../chai-setup';
import {expectRevert, waitFor} from '../test-utils';
import {sendInSecret, setupOuterSpace, fetchPlanetState} from './utils';
// import {BigNumber} from '@ethersproject/bignumber';
// import {expect} from '../chai-setup';
import {ethers} from 'hardhat';
import {BigNumber} from '@ethersproject/bignumber';

// const stableTokenUnit = BigNumber.from('1000000000000000000');
describe('OuterSpace', function () {
  it('user can acquire virgin planet', async function () {
    const {players, spaceInfo, outerSpaceContract} = await setupOuterSpace();
    const pointer = spaceInfo.findNextPlanet();
    // console.log({
    //   location: pointer.data.location.id,
    //   stake: pointer.data.stats.stake,
    //   stakeMultiplier: spaceInfo.stakeMultiplier.toString(),
    // });
    const amount = BigNumber.from(pointer.data.stats.stake).mul(
      spaceInfo.stakeMultiplier
    );
    await waitFor(
      players[0].PlayToken.transferAndCall(
        outerSpaceContract.address,
        amount,
        pointer.data.location.id
      )
    );
  });

  it('user cannot acquire planet already onwed by another player', async function () {
    const {players, spaceInfo, outerSpaceContract} = await setupOuterSpace();
    const pointer = spaceInfo.findNextPlanet();
    const amount = BigNumber.from(pointer.data.stats.stake).mul(
      spaceInfo.stakeMultiplier
    );
    await waitFor(
      players[0].PlayToken.transferAndCall(
        outerSpaceContract.address,
        amount,
        pointer.data.location.id
      )
    );
    await expectRevert(
      players[1].PlayToken.transferAndCall(
        outerSpaceContract.address,
        amount,
        pointer.data.location.id
      ),
      'STILL_ACTIVE'
    );
  });

  it("user can attack other player's planet", async function () {
    const {
      players,
      spaceInfo,
      outerSpaceContract,
      increaseTime,
      provider,
    } = await setupOuterSpace();
    const p0 = spaceInfo.findNextPlanet();
    let planet0 = await fetchPlanetState(outerSpaceContract, p0.data);
    let planet1 = await fetchPlanetState(
      outerSpaceContract,
      spaceInfo.findNextPlanet(p0).data
    );
    const amount0 = BigNumber.from(planet0.stats.stake).mul(
      spaceInfo.stakeMultiplier
    );
    await waitFor(
      players[0].PlayToken.transferAndCall(
        outerSpaceContract.address,
        amount0,
        planet0.location.id
      )
    );
    const amount1 = BigNumber.from(planet1.stats.stake).mul(
      spaceInfo.stakeMultiplier
    );
    await waitFor(
      players[1].PlayToken.transferAndCall(
        outerSpaceContract.address,
        amount1,
        planet1.location.id
      )
    );
    planet0 = await fetchPlanetState(outerSpaceContract, planet0);
    planet1 = await fetchPlanetState(outerSpaceContract, planet1);

    const block = await provider.getBlock('latest');
    const quantity = planet1.getNumSpaceships(block.timestamp);
    console.log({quantity, blockTime: block.timestamp});
    const sent = await sendInSecret(spaceInfo, players[1], {
      from: planet1,
      quantity,
      to: planet0,
    });
    if (!sent) {
      throw new Error('no fleet found');
    }
    const {fleetId, secret, from, to, distance, timeRequired} = sent;
    await increaseTime(timeRequired);
    await waitFor(
      players[1].OuterSpace.resolveFleet(fleetId, from, to, distance, secret)
    );
  });

  it('planet production matches estimates', async function () {
    const {
      players,
      spaceInfo,
      outerSpaceContract,
      increaseTime,
    } = await setupOuterSpace();
    let planet = await fetchPlanetState(
      outerSpaceContract,
      spaceInfo.findNextPlanet().data
    );
    const amount = BigNumber.from(planet.stats.stake).mul(
      spaceInfo.stakeMultiplier
    );
    await waitFor(
      players[0].PlayToken.transferAndCall(
        outerSpaceContract.address,
        amount,
        planet.location.id
      )
    );
    planet = await fetchPlanetState(outerSpaceContract, planet);
    const fistTime = (await ethers.provider.getBlock('latest')).timestamp;
    console.log({fistTime});
    await sendInSecret(spaceInfo, players[0], {
      from: planet,
      quantity: planet.getNumSpaceships(fistTime),
      to: planet,
    });
    await increaseTime(1000);
    const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
    const new_planet = await fetchPlanetState(outerSpaceContract, planet);
    const quantity = new_planet.getNumSpaceships(currentTime);
    console.log({quantity, currentTime});
    await sendInSecret(spaceInfo, players[0], {
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
      sendInSecret(spaceInfo, players[0], {
        from: planet,
        quantity: quantityAgain + 2,
        to: planet,
      })
    );
  });
});
