import {getUnnamedAccounts, ethers, deployments} from 'hardhat';
import {BigNumber} from '@ethersproject/bignumber';
import {SpaceInfoImpl} from 'planet-wars-common';

// TODO move to util
const waitFor = <T>(p: Promise<{wait: () => Promise<T>}>) =>
  p.then((tx) => tx.wait());

async function main() {
  const players = await getUnnamedAccounts();

  const OuterSpaceDeployment = await deployments.get('OuterSpace');
  const spaceInfo = new SpaceInfoImpl(OuterSpaceDeployment.linkedData);

  let planetPointer;
  for (let i = 0; i < 4; i++) {
    const outerSpaceContract = await ethers.getContract(
      'OuterSpace',
      players[i]
    );
    planetPointer = spaceInfo.findNextPlanet(planetPointer);

    // TODO approve // (TODO using permit)
    await waitFor(outerSpaceContract.acquire(planetPointer.data.location.id));
    console.log(
      `staked: ${planetPointer.data.location.id}, (${planetPointer.data.location.x},${planetPointer.data.location.y})`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
