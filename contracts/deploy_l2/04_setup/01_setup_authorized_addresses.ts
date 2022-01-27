import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const namedAccounts = await hre.getNamedAccounts();
  const {deployer} = namedAccounts;
  const {read, execute} = hre.deployments;

  const OuterSpace = await hre.deployments.get('OuterSpace');
  const addressesToAuthorize = Object.values(namedAccounts).concat([
    OuterSpace.address,
  ]);

  // ensure user cannot amass tokens on one address
  const anyNotAuthorized = await read(
    'ConquestToken',
    'anyNotAuthorized',
    addressesToAuthorize
  );
  if (anyNotAuthorized) {
    await execute(
      'ConquestToken',
      {from: deployer, log: true, autoMine: true},
      'enableRequireAuthorization',
      addressesToAuthorize
    );
  }
};
export default func;
func.tags = ['ConquestToken', 'ConquestToken_setup'];
func.dependencies = ['ConquestToken_deploy', 'OuterSpace_deploy'];