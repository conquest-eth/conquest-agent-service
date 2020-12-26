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

  const stakingToken = await hre.deployments.get('StakingToken');

  let genesisHash =
    '0xe0c3fa9ae97fc9b60baae605896b5e3e7cecb6baaaa4708162d1ec51e8d65a68';
  let resolveWindow = hours(1);
  let timePerDistance = minutes(20);
  let exitDuration = hours(24);

  if (chainId !== '1') {
    genesisHash =
      '0xe0c3fa9ae97fc9b60baae605896b5e3e7cecb6baaaa4708162d1ec51e8d65a69';
    resolveWindow = hours(1);
    timePerDistance = 20;
    exitDuration = minutes(24);
  }

  await deploy('OuterSpace', {
    from: deployer,
    linkedData: {genesisHash, resolveWindow, timePerDistance, exitDuration},
    args: [
      stakingToken.address,
      genesisHash,
      resolveWindow,
      timePerDistance,
      exitDuration,
    ],
    proxy: true, // TODO remove // dev only // rinkeby
    log: true,
  });
};
export default func;
