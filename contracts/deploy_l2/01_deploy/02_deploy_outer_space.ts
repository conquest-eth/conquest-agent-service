import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers, network} from 'hardhat';

function hours(num: number): number {
  return num * 3600;
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();
  const {deploy} = hre.deployments;

  const chainId = await hre.getChainId();
  const localTesting = chainId === '1337' || chainId === '31337'; // TODO use network tags ?

  const playToken_l2 = await hre.deployments.get('PlayToken_L2');

  let chainGenesisHash = '';
  if (localTesting) {
    const earliestBlock = await ethers.provider.getBlock('earliest');
    chainGenesisHash = earliestBlock.hash;
  }
  let genesisHash =
    '0xcce77b122615b6093c0df0c7392bec6f537eb7a0595c337a573ee6d96d1107c8';
  const resolveWindow = hours(12);
  let timePerDistance = hours(2);
  let exitDuration = hours(3 * 24);
  const acquireNumSpaceships = 100000;
  let productionSpeedUp = 1;

  // use a command to increase time in 1337
  if (localTesting) {
    timePerDistance /= 180;
    exitDuration /= 180;
    productionSpeedUp = 1; // give more time to attack
  }

  if (network.name === 'quick') {
    // TODO remove when updating quick to a new contract
    genesisHash =
      '0xe0c3fa9ae97fc9b60baae605896b5e3e7cecb6baaaa4708162d1ec51e8d65111';
    timePerDistance /= 40;
    exitDuration /= 40;
    productionSpeedUp = 40;
  }

  // TODO remove when updating staging to a new contract
  if (network.name === 'staging') {
    genesisHash =
      '0xe0c3fa9ae97fc9b60baae605896b5e3e7cecb6baaaa4708162d1ec51e8d65a68';
  }

  await deploy('OuterSpace', {
    from: deployer,
    linkedData: {
      genesisHash,
      resolveWindow,
      timePerDistance,
      exitDuration,
      acquireNumSpaceships,
      productionSpeedUp,
      chainGenesisHash,
    },
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
