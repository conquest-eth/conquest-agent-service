import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {parseEther} from '@ethersproject/units';
import {BigNumber} from '@ethersproject/bignumber';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployer,
    stableTokenBeneficiary,
    claimKeyDistributor,
  } = await hre.getNamedAccounts();
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

  await execute(
    'PlayToken',
    {from: stableTokenBeneficiary, log: true, autoMine: true},
    'transfer',
    claimKeyDistributor,
    parseEther('1000000')
  );
};
export default func;
func.tags = ['StableToken', 'PlayToken'];
