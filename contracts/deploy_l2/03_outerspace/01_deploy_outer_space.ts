import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers, network} from 'hardhat';

function hours(num: number): number {
  return num * 3600;
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();
  const {diamond} = hre.deployments;

  // const chainId = await hre.getChainId();
  const networkName = await hre.deployments.getNetworkName();
  // TODO use network tags ?
  const localTesting = networkName === 'hardhat' || networkName === 'localhost'; // chainId === '1337' || chainId === '31337';

  // console.log({networkName, localTesting});

  const ConquestToken = await hre.deployments.get('ConquestToken');

  const allianceRegistry = await hre.deployments.get('AllianceRegistry');

  let chainGenesisHash = '';
  if (localTesting) {
    const earliestBlock = await ethers.provider.getBlock('earliest');
    chainGenesisHash = earliestBlock.hash;
  }
  let genesisHash = '0xcce77b122615b6093c0df0c7392bec6f537eb7a0595c337a573ee6d96d1107c8';
  let resolveWindow = hours(12);
  let timePerDistance = hours(2);
  let exitDuration = hours(3 * 24);
  const acquireNumSpaceships = 100000;
  let productionSpeedUp = 1;
  let frontrunningDelay = 30 * 60;
  const productionCapAsDuration = 3 * 24 * 3600; // 3 days
  const upkeepProductionDecreaseRatePer10000th = 5000;
  const fleetSizeFactor6 = 500000;
  const initialSpaceExpansion = 12;
  const expansionDelta = 4;
  const giftTaxPer10000 = 2000;

  // use a command to increase time in 1337
  if (localTesting) {
    timePerDistance /= 180;
    exitDuration /= 180;
    productionSpeedUp = 180;
    frontrunningDelay /= 180;
    resolveWindow /= 30; // 180;
  }

  if (networkName === 'quick') {
    // TODO remove when updating quick to a new contract
    genesisHash = '0xe0c3fa9ae97fc9b60baae605896b5e3e7cecb6baaaa4708162d1ec51e8d65111';
    timePerDistance /= 180;
    exitDuration /= 180;
    productionSpeedUp = 180;
    frontrunningDelay /= 180;
    resolveWindow /= 180;
    // productionCapAsDuration /= 180;
  }

  // if (networkName === 'coinfest') {
  //   genesisHash =
  //     '0xe0c3fa9ae97fc9b60baae605896b5e3e7cecb6baaaa4708162d1ec51e8d65111';
  //   timePerDistance /= 5;
  //   exitDuration /= 5;
  //   productionSpeedUp = 5;
  //   productionCapAsDuration /= 5;
  //   frontrunningDelay /= 5;
  // }

  if (networkName === 'dev') {
    timePerDistance /= 100;
    exitDuration /= 100;
    productionSpeedUp = 100;
    frontrunningDelay /= 100;
    resolveWindow /= 25;
    // productionCapAsDuration /= 180;
    genesisHash = '0xee563ebbe85edccc120c5082a5066539b0e9b7958b5fbac114523a95a8162671';
  }

  if (networkName === 'alpha') {
    genesisHash = '0x015e3b02f1bb647546a9856205a64f1c2263856de7acb3fe65aa303c9c8ce7fc';
  }

  if (networkName === 'beta1') {
    genesisHash = '0x54cfc698a2dc6796e9cf1ab3cdbcc07c54b649287b791b14c040997bdc379b35';
  }

  console.log({
    ConquestToken: ConquestToken.address,
    allianceRegistry: allianceRegistry.address,
    genesisHash,
    resolveWindow,
    timePerDistance,
    exitDuration,
    acquireNumSpaceships,
    productionSpeedUp,
    frontrunningDelay,
    productionCapAsDuration,
    upkeepProductionDecreaseRatePer10000th,
    fleetSizeFactor6,
    initialSpaceExpansion,
    expansionDelta,
    giftTaxPer10000,
  });

  await diamond.deploy('OuterSpace', {
    from: deployer,
    linkedData: {
      genesisHash,
      resolveWindow,
      timePerDistance,
      exitDuration,
      acquireNumSpaceships,
      productionSpeedUp,
      chainGenesisHash,
      frontrunningDelay,
      productionCapAsDuration,
      upkeepProductionDecreaseRatePer10000th,
      fleetSizeFactor6,
      initialSpaceExpansion,
      expansionDelta,
      giftTaxPer10000,
    },
    facets: [
      'OuterSpaceInitializationFacet',
      'OuterSpaceAdminFacet',
      'OuterSpaceFleetsFacet',
      'OuterSpacePlanetsFacet',
      'OuterSpaceInformationFacet',
      'OuterSpaceStakingFacet',
    ],
    facetsArgs: [
      {
        stakingToken: ConquestToken.address,
        allianceRegistry: allianceRegistry.address,
        genesis: genesisHash,
        resolveWindow,
        timePerDistance,
        exitDuration,
        acquireNumSpaceships,
        productionSpeedUp,
        frontrunningDelay,
        productionCapAsDuration,
        upkeepProductionDecreaseRatePer10000th,
        fleetSizeFactor6,
        initialSpaceExpansion,
        expansionDelta,
        giftTaxPer10000,
      },
    ],
    execute: {
      methodName: 'init',
      args: [],
    },
    log: true,
    autoMine: true,
  });
};
export default func;
func.dependencies = ['ConquestToken_deploy', 'AllianceRegistry_deploy'];
func.tags = ['OuterSpace', 'OuterSpace_deploy'];
