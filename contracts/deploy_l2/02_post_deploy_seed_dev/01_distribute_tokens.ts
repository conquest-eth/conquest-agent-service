import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {parseEther} from '@ethersproject/units';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    stableTokenBeneficiary,
    claimKeyDistributor,
  } = await hre.getNamedAccounts();
  const {execute} = hre.deployments;

  // FOR now mint as you wish
  await execute(
    'PlayToken_L2',
    {from: stableTokenBeneficiary, log: true, autoMine: true},
    'mint',
    parseEther('1000000000')
  );

  await execute(
    'PlayToken_L2',
    {from: stableTokenBeneficiary, log: true, autoMine: true},
    'transfer',
    claimKeyDistributor,
    parseEther('1000000')
  );
};
export default func;
func.tags = ['StableToken', 'PlayToken'];
