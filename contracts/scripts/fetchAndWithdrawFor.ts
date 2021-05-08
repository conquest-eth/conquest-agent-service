import {HardhatRuntimeEnvironment} from 'hardhat/types';
import hre from 'hardhat';
import {formatEther} from '@ethersproject/units';

async function func(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {read, execute, catchUnknownSigner} = hre.deployments;
  const {deployer} = await hre.getNamedAccounts();

  const owner = '0x1e61cf58e9f9b273a3e13ddec1a4b4c34bae5a8b';

  console.log({balance: formatEther(await read('PlayToken_L2', 'balanceOf', owner))});

  await catchUnknownSigner(
    execute('OuterSpace', {from: deployer, log: true}, 'fetchAndWithdrawFor', owner, [
      '0xfffffffffffffffffffffffffffffff500000000000000000000000000000010',
    ])
  );

  console.log({balance: formatEther(await read('PlayToken_L2', 'balanceOf', owner))});
}
if (require.main === module) {
  func(hre);
}
