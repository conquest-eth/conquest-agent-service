import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

function minutes(num: number): number {
  return num * 60;
}

function hours(num: number): number {
  return num * 3600;
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();
  const {deploy} = hre.deployments;

  const chainId = await hre.getChainId();

  const playToken = await hre.deployments.get('PlayToken');

  const genesisHash =
    '0xe0c3fa9ae97fc9b60baae605896b5e3e7cecb6baaaa4708162d1ec51e8d65a68';
  const resolveWindow = hours(2);
  const timePerDistance = minutes(20);
  const exitDuration = hours(2*24);

  // use a command to increase time in 1337
  // if (chainId === '1337') {
  //   genesisHash =
  //     '0xe0c3fa9ae97fc9b60baae605896b5e3e7cecb6baaaa4708162d1ec51e8d65a69';
  //   resolveWindow = hours(2);
  //   timePerDistance = 20;
  //   exitDuration = minutes(24);
  // }

  await deploy('OuterSpace', {
    from: deployer,
    linkedData: {genesisHash, resolveWindow, timePerDistance, exitDuration},
    args: [
      playToken.address,
      genesisHash,
      resolveWindow,
      timePerDistance,
      exitDuration,
    ],
    proxy: hre.network.name !== 'mainnet' ? 'postUpgrade' : undefined,
    log: true,
    autoMine: true,
  });
};
export default func;
func.dependencies = ['PlayToken_deploy'];
func.tags = ['OuterSpace', 'OuterSpace_deploy'];
