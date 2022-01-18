import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {deployments} from 'hardhat';
import {AddressZero} from '@ethersproject/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();
  const {deploy} = hre.deployments;

  const networkName = await deployments.getNetworkName();

  if (networkName === 'mainnet') {
    throw new Error('mainnet not ready');
  }

  // TODO supported networks
  for (const network of ['goerli']) {
    await deploy(`ConquestToken_L1_${network}`, {
      from: deployer,
      contract: 'GenericL1Token',
      args: [AddressZero, AddressZero], // TODO
      deterministicDeployment: true, // TODO clone
      log: true,
      autoMine: true,
    });
  }
};
export default func;
func.tags = ['ConquestToken_L1', 'ConquestToken_L1_deploy'];
