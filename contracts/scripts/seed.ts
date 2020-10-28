import {getUnnamedAccounts, ethers, deployments} from 'hardhat';
import {BigNumber} from '@ethersproject/bignumber';
import {OuterSpace} from 'planet-wars-common';

// TODO move to util
const waitFor = <T>(p: Promise<{wait: () => Promise<T>}>) =>
  p.then((tx) => tx.wait());

async function main() {
  const players = await getUnnamedAccounts();

  const OuterSpaceDeployment = await deployments.get('OuterSpace');
  const outerSpace = new OuterSpace(OuterSpaceDeployment.linkedData);

  let planet;
  const stableTokenUnit = BigNumber.from('1000000000000000000');
  for (let i = 0; i < 4; i++) {
    const outerSpaceContract = await ethers.getContract(
      'OuterSpace',
      players[i]
    );
    planet = outerSpace.findNextPlanet(planet ? planet.pointer : undefined);
    await waitFor(
      outerSpaceContract.stake(players[i], planet.location.id, stableTokenUnit)
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
