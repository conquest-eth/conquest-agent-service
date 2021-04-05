import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();
  const {deploy} = hre.deployments;

  const owner = deployer; // TODO

  const stableToken = await hre.deployments.get('StableToken');
  const CDai = await hre.deployments.get('CDai');

  await deploy('PlayToken', {
    from: deployer,
    contract: 'Play',
    args: [stableToken.address, CDai.address, owner],
    proxy: hre.network.name !== 'mainnet' ? 'postUpgrade' : undefined,
    log: true,
    autoMine: true,
  });
};
export default func;
func.dependencies = ['StableToken_deploy', 'CDai_deploy'];
func.tags = ['PlayToken', 'PlayToken_deploy'];
