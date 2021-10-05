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
import {hexZeroPad} from '@ethersproject/bytes';

async function main() {
  const {stableTokenBeneficiary} = await getNamedAccounts();
  const unNamedAccounts = await getUnnamedAccounts();

  const contracts = {
    OuterSpace: <OuterSpace>await ethers.getContract('OuterSpace'),
    PlayToken_L2: <PlayL2>await ethers.getContract('PlayToken_L2'),
  };
  const OuterSpaceDeployment = await deployments.get('OuterSpace');
  const players = await setupUsers(unNamedAccounts, contracts);

  const distribution = [1000, 500, 3000, 100];
  for (let i = 0; i < distribution.length; i++) {
    const account = players[i].address;
    const amount = distribution[i];
    await deployments.execute(
      'PlayToken_L2',
      {from: stableTokenBeneficiary, log: true, autoMine: true},
      'transfer',
      account,
      parseEther(amount.toString())
    );
  }

  const spaceInfo = new SpaceInfo(OuterSpaceDeployment.linkedData);

  let planetPointer;
  for (let i = 0; i < 4; i++) {
    const outerSpaceContract = await deployments.get('OuterSpace');
    planetPointer = spaceInfo.findNextPlanet(planetPointer);
    await deployments.execute(
      'PlayToken_L2',
      {from: players[i].address, log: true, autoMine: true},
      'transferAndCall',
      outerSpaceContract.address,
      BigNumber.from(planetPointer.data.stats.stake).mul('1000000000000000000'),
      defaultAbiCoder.encode(
        ['address', 'uint256'],
        [players[i].address, planetPointer.data.location.id]
      )
    );
    console.log(
      `staked: ${planetPointer.data.location.id}, (${planetPointer.data.location.x},${planetPointer.data.location.y})`
    );
  }

  const allianceAddress = await deployments.read(
    'BasicAllianceFactory',
    {from: players[0].address},
    'getAddress',
    '0x0000000000000000000000000000000000000000000000000000000000000000'
  );

  const nonce0 = 0;
  const message0 = `Join Alliance ${hexZeroPad(
    allianceAddress.toLowerCase(),
    20
  )}${nonce0 === 0 ? '' : ` (nonce: ${('' + nonce0).padStart(10)})`}`;
  const player0Signature = players[0].signer.signMessage(message0);

  const nonce1 = 0;
  const message1 = `Join Alliance ${hexZeroPad(
    allianceAddress.toLowerCase(),
    20
  )}${nonce1 === 0 ? '' : ` (nonce: ${('' + nonce0).padStart(10)})`}`;
  const player1Signature = players[1].signer.signMessage(message1);

  console.log({message0, message1});
  await deployments.execute(
    'BasicAllianceFactory',
    {from: players[0].address},
    'instantiate',
    players[0].address,
    [
      {
        addr: players[0].address,
        nonce: nonce0,
        signature: player0Signature,
      },
      {
        addr: players[1].address,
        nonce: nonce1,
        signature: player1Signature,
      },
    ],
    '0x0000000000000000000000000000000000000000000000000000000000000000'
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
