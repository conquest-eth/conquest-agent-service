import {BigNumber} from '@ethersproject/bignumber';
import {parseEther} from '@ethersproject/units';
import {defaultAbiCoder} from '@ethersproject/abi';
import {
  getUnnamedAccounts,
  deployments,
  getNamedAccounts,
  ethers,
} from 'hardhat';
import {SpaceInfo} from 'conquest-eth-common';
import {OuterSpace, PlayL2} from '../typechain';
import {setupUsers} from '../utils';

async function main() {
  const {deployer} = await getNamedAccounts();
  const unNamedAccounts = await getUnnamedAccounts();

  const contracts = {
    OuterSpace: <OuterSpace>await ethers.getContract('OuterSpace'),
    PlayToken_L2: <PlayL2>await ethers.getContract('PlayToken_L2'),
  };
  const OuterSpaceDeployment = await deployments.get('OuterSpace');
  const players = await setupUsers(unNamedAccounts, contracts);

  const spaceInfo = new SpaceInfo(OuterSpaceDeployment.linkedData);

  let planetPointer;
  for (let i = 0; i < 1001; i++) {
    const outerSpaceContract = await deployments.get('OuterSpace');
    planetPointer = spaceInfo.findNextPlanet(planetPointer);
    const {state} = await deployments.read(
      'OuterSpace',
      'getPlanet',
      planetPointer.data.location.id
    );
    if (state.owner !== '0x0000000000000000000000000000000000000000') {
      i--;
      continue;
    }
    const player = deployer; // players[i % 4].address;
    await deployments.execute(
      'PlayToken_L2',
      {from: player, log: true, autoMine: true},
      'transferAndCall',
      outerSpaceContract.address,
      BigNumber.from(planetPointer.data.stats.stake).mul('1000000000000000000'),
      defaultAbiCoder.encode(
        ['address', 'uint256'],
        [player, planetPointer.data.location.id]
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