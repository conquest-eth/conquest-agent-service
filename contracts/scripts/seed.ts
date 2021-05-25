import {BigNumber} from '@ethersproject/bignumber';
import {parseEther} from '@ethersproject/units';
import {defaultAbiCoder} from '@ethersproject/abi';
import {getUnnamedAccounts, deployments, getNamedAccounts} from 'hardhat';
import {SpaceInfo} from 'conquest-eth-common';

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
      'PlayToken_L2',
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
    const outerSpaceContract = await deployments.get('OuterSpace');
    planetPointer = spaceInfo.findNextPlanet(planetPointer);
    await deployments.execute(
      'PlayToken_L2',
      {from: players[i], log: true, autoMine: true},
      'transferAndCall',
      outerSpaceContract.address,
      BigNumber.from(planetPointer.data.stats.stake).mul('1000000000000000000'),
      defaultAbiCoder.encode(
        ['address', 'uint256'],
        [players[i], planetPointer.data.location.id]
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
