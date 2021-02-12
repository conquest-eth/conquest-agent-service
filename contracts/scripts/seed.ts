import {BigNumber} from '@ethersproject/bignumber';
import {parseEther} from '@ethersproject/units';
import {
  getUnnamedAccounts,
  ethers,
  deployments,
  getNamedAccounts,
} from 'hardhat';
import {SpaceInfo} from 'planet-wars-common';

// TODO move to util
const waitFor = <T>(p: Promise<{wait: () => Promise<T>}>) =>
  p.then((tx) => tx.wait());

async function main() {
  const {stableTokenBeneficiary} = await getNamedAccounts();
  const players = await getUnnamedAccounts();

  const distribution = [1000, 500, 3000, 100];
  for (let i = 0; i < distribution.length; i++) {
    const account = players[i];
    const amount = distribution[i];
    await deployments.execute(
      'PlayToken',
      {from: stableTokenBeneficiary, log: true, autoMine: true},
      'transfer',
      account,
      parseEther(amount.toString())
    );
  }

  const OuterSpaceDeployment = await deployments.get('OuterSpace');
  const spaceInfo = new SpaceInfo(OuterSpaceDeployment.linkedData);

  let planetPointer;
  for (let i = 0; i < 4; i++) {
    const outerSpaceContract = await ethers.getContract(
      'OuterSpace',
      players[i]
    );
    const playTokenContract = await ethers.getContract('PlayToken', players[i]);
    planetPointer = spaceInfo.findNextPlanet(planetPointer);

    await waitFor(
      playTokenContract.transferAndCall(
        outerSpaceContract.address,
        BigNumber.from(planetPointer.data.stats.stake).mul(
          spaceInfo.stakeMultiplier
        ),
        planetPointer.data.location.id
      )
    );
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
