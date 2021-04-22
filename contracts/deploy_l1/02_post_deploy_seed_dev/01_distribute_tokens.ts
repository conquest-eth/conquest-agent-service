import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {parseEther} from '@ethersproject/units';
import {BigNumber} from '@ethersproject/bignumber';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer, stableTokenBeneficiary, claimKeyDistributor} = await hre.getNamedAccounts();
  const {read, execute} = hre.deployments;
  const {ethers} = hre;

  const playToken = await ethers.getContract('PlayToken');

  const claimKeyDistributorBalance = await read('PlayToken', 'balanceOf', claimKeyDistributor);
  if (claimKeyDistributorBalance.eq(0)) {
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
      BigNumber.from('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')
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
  } else {
    console.log('claim key distributor already funded on l1');
  }
};
export default func;
func.tags = ['StableToken', 'PlayToken'];
