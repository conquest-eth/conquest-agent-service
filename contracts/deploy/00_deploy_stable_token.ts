import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();
  const {deploy} = hre.deployments;

  await deploy('StakingToken', {
    from: deployer,
    contract: 'SimpleERC20TokenWithInitialBalance',
    args: [
      '1000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
    ],
    log: true,
  });
};
export default func;
