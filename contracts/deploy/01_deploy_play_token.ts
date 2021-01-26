import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();
  const {deploy} = hre.deployments;

  const tokenManager = deployer; // TODO tokenManager

  const stableToken = await hre.deployments.get('StableToken');

  await deploy('PlayToken', {
    from: deployer,
    contract: 'Play',
    args: [stableToken.address, tokenManager],
    log: true,
    autoMine: true,
  });
};
export default func;
func.dependencies = ['StableToken_deploy'];
func.tags = ['PlayToken', 'PlayToken_deploy'];
