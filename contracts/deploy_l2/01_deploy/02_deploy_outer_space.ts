import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {network} from 'hardhat';

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

  const playToken_l2 = await hre.deployments.get('PlayToken_L2');

  let genesisHash = '0xe0c3fa9ae97fc9b60baae605896b5e3e7cecb6baaaa4708162d1ec51e8d65a68';
  const resolveWindow = hours(2);
  let timePerDistance = hours(2);
  let exitDuration = hours(3 * 24);
  const acquireNumSpaceships = 100000;
  let productionSpeedUp = 1;

  // use a command to increase time in 1337
  if (chainId === '1337') {
    genesisHash = '0xe0c3fa9ae97fc9b60baae605896b5e3e7cecb6baaaa4708162d1ec51e8d65a69';
    timePerDistance /= 180;
    exitDuration /= 180;
    productionSpeedUp = 1; // give more time to attack
  }

  if (network.name === 'quick') {
    genesisHash = '0xe0c3fa9ae97fc9b60baae605896b5e3e7cecb6baaaa4708162d1ec51e8d65111';
    timePerDistance /= 40;
    exitDuration /= 40;
    productionSpeedUp = 40;
  }

  await deploy('OuterSpace', {
    from: deployer,
    linkedData: {genesisHash, resolveWindow, timePerDistance, exitDuration, acquireNumSpaceships, productionSpeedUp},
    args: [
      playToken_l2.address,
      genesisHash,
      resolveWindow,
      timePerDistance,
      exitDuration,
      acquireNumSpaceships,
      productionSpeedUp,
    ],
    proxy: hre.network.name !== 'mainnet' ? 'postUpgrade' : undefined,
    log: true,
    autoMine: true,
  });
};
export default func;
func.dependencies = ['PlayToken_deploy'];
func.tags = ['OuterSpace', 'OuterSpace_deploy'];
