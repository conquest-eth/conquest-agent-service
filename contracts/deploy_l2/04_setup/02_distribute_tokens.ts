import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {parseEther} from '@ethersproject/units';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer, claimKeyDistributor} = await hre.getNamedAccounts();
  const {read, execute} = hre.deployments;

  const claimKeyDistributorBalance = await read('ConquestToken', 'balanceOf', claimKeyDistributor);
  if (claimKeyDistributorBalance.eq(0)) {
    await execute(
      'ConquestToken',
      {from: deployer, log: true, autoMine: true},
      'inflate',
      claimKeyDistributor,
      parseEther('1000000000')
    );
  } else {
    console.log('claim key distributor already funded');
  }
};
export default func;
func.tags = ['ConquestToken'];
