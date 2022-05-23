import {HardhatRuntimeEnvironment} from 'hardhat/types';
import hre from 'hardhat';
import { HashZero } from '@ethersproject/constants';

const args = process.argv.slice(2);

if (args.length === 0) {
  throw new Error(`need to pass account to perform the hijack`);
}
const account = args[0];
const value = args[1] || 0;

async function func(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {execute} = hre.deployments;

  await execute('OuterSpace', {from: account, log: true, autoMine: true}, 'send', 0, value, HashZero);
}
if (require.main === module) {
  func(hre);
}
