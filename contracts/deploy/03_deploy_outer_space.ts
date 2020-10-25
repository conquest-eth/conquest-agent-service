import {HardhatRuntimeEnvironment, DeployFunction} from 'hardhat/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();
  const {deploy} = hre.deployments;

  const stakingToken = await hre.deployments.get('StakingToken');

  const genesisHash = '0xe0c3fa9ae97fc9b60baae605896b5e3e7cecb6baaaa4708162d1ec51e8d65a69'; // Wallet.createRandom().privateKey; // "0x65be7a7bf414b6901742efbc6b946d730511e460cc16812c1c0aacc6f1bd9980"; // Wallet.createRandom().privateKey;
  console.log({genesisHash});
  await deploy('OuterSpace', {
    from: deployer,
    linkedData: genesisHash,
    args: [stakingToken.address, genesisHash],
    log: true,
  });
};
export default func;
