import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();
  const {deploy} = hre.deployments;

  const allianceRegistry = await hre.deployments.get('AllianceRegistry');

  await deploy('BasicAllianceFactory', {
    contract: 'BasicAlliance',
    from: deployer,
    args: [allianceRegistry.address],
    log: true,
    autoMine: true,
    skipIfAlreadyDeployed: true,
  });
};
export default func;
func.dependencies = ['AllianceRegistry_deploy'];
func.tags = ['BasicAllianceFactory', 'BasicAllianceFactory_deploy'];
