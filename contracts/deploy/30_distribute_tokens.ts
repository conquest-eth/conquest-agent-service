import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {parseEther} from '@ethersproject/units';
import {BigNumber} from '@ethersproject/bignumber';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer, stableTokenBeneficiary} = await hre.getNamedAccounts();
  const {execute} = hre.deployments;
  const {ethers, getUnnamedAccounts} = hre;

  const playToken = await ethers.getContract('PlayToken');

  // mint stable tokens
  await execute(
    'StableToken',
    {from: deployer, log: true, autoMine: true},
    'mint',
    stableTokenBeneficiary,
    parseEther('1000000000')
  );

  // mint Play tokens
  await execute(
    'StableToken',
    {from: stableTokenBeneficiary, log: true, autoMine: true},
    'approve',
    playToken.address,
    BigNumber.from(
      '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
    )
  );
  await execute(
    'PlayToken',
    {from: stableTokenBeneficiary, log: true, autoMine: true},
    'mint',
    parseEther('1000000000')
  );

  const accounts = await getUnnamedAccounts();
  const distribution = [1000, 500, 3000, 100];
  for (let i = 0; i < distribution.length; i++) {
    const account = accounts[i];
    const amount = distribution[i];
    await execute(
      'PlayToken',
      {from: stableTokenBeneficiary, log: true, autoMine: true},
      'transfer',
      account,
      parseEther(amount.toString())
    );
  }

  // TODO giftKeys
};
export default func;
func.tags = ['StableToken', 'PlayToken'];
