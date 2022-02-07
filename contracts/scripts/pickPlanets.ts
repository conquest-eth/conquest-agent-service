import {HardhatRuntimeEnvironment} from 'hardhat/types';
import hre from 'hardhat';
import {SpaceInfo, xyToLocation} from 'conquest-eth-common';
import fs from 'fs';

async function func(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {ethers, deployments} = hre;
  const OuterSpace = await ethers.getContract('OuterSpace');
  const OuterSpaceDeployment = await deployments.get('OuterSpace');
  const spaceInfo = new SpaceInfo(OuterSpaceDeployment.linkedData);

  const discovered = await OuterSpace.callStatic.getDiscovered();

  console.log(discovered);

  const planetsInBound: {x: number; y: number; location: string}[] = [];
  // const emptyPlanets: {x: number; y: number; location: string}[] = [];
  // const usedPlanets: {x: number; y: number; location: string}[] = [];
  for (let x = -discovered.minX; x <= discovered.maxX; x++) {
    for (let y = -discovered.minY; y <= discovered.maxY; y++) {
      const location = xyToLocation(x, y);
      const planet = spaceInfo.getPlanetInfo(x, y);
      if (planet) {
        planetsInBound.push({x, y, location});
        // console.log(`checking planet at ${x}, ${y}...`);
        // const state = await OuterSpace.callStatic.getPlanet(location);
        // if (state.state.lastUpdated == 0) {
        //   // console.log({state: state.state});
        //   emptyPlanets.push({
        //     x,
        //     y,
        //     location,
        //   });
        // } else {
        //   usedPlanets.push({
        //     x,
        //     y,
        //     location,
        //   });
        //   console.log(`used planet at ${x}, ${y}`);
        // }
      }
    }
  }
  // const data = JSON.stringify({emptyPlanets, usedPlanets}, null, 2);
  // console.log(data);
  // fs.writeFileSync('../planets.json', data);

  const planetsChosen = [];
  while (planetsChosen.length < 6) {
    const num = planetsInBound.length;
    const index = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) % num;
    const chosenPlanet = planetsInBound[index];
    planetsInBound.splice(index, 1);

    const state = await OuterSpace.callStatic.getPlanet(chosenPlanet.location);

    if (state.state.reward.eq(0) && state.state.lastUpdated == 0) {
      console.log(`${chosenPlanet.x},${chosenPlanet.y}`, JSON.stringify(chosenPlanet, null, 2));
      planetsChosen.push(chosenPlanet);
    }
  }

  await deployments.saveDotFile('.planets-chosen.json', JSON.stringify(planetsChosen, null, 2));

  for (const planet of planetsChosen) {
    console.log(`- (${planet.x},${planet.y})`);
  }
}
if (require.main === module) {
  func(hre);
}
