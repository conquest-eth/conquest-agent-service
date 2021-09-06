import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {parseEther} from '@ethersproject/units';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer, claimKeyDistributor, stableTokenBeneficiary} =
    await hre.getNamedAccounts();
  const {read, execute} = hre.deployments;

  const claimKeyDistributorBalance = await read(
    'PlayToken_L2',
    'balanceOf',
    claimKeyDistributor
  );
  if (claimKeyDistributorBalance.eq(0)) {
    // -----------------------------------------------------------------------
    // FOR now mint as you wish, TODO l2 bridging
    // -----------------------------------------------------------------------
    await execute(
      'PlayToken_L2',
      {from: deployer, log: true, autoMine: true},
      'fromL1',
      deployer,
      parseEther('1000000000')
    );

    await execute(
      'PlayToken_L2',
      {from: deployer, log: true, autoMine: true},
      'fromL1',
      stableTokenBeneficiary,
      parseEther('1000000000')
    );
    // -----------------------------------------------------------------------

    await execute(
      'PlayToken_L2',
      {from: deployer, log: true, autoMine: true},
      'transfer',
      claimKeyDistributor,
      parseEther('10000000')
    );
  } else {
    console.log('claim key distributor already funded on l2');
  }
};
export default func;
func.tags = ['StableToken', 'PlayToken'];
