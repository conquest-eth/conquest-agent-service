import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();
  const {deploy} = hre.deployments;

  await deploy('PlayToken_L2', {
    from: deployer,
    contract: 'PlayL2',
    proxy: hre.network.name !== 'mainnet', // TODO l2 network mainnet
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['PlayToken', 'PlayToken_deploy'];
