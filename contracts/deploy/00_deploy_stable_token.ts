import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {AddressZero} from '@ethersproject/constants';
import {parseEther} from '@ethersproject/units';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();
  const {deploy} = hre.deployments;

  await deploy('StableToken', {
    from: deployer,
    contract: 'ERC20WithInitialBalance',
    args: [parseEther('1000000000000'), parseEther('1000'), AddressZero],
    log: true,
    autoMine: true,
  });
};
export default func;
