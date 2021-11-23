import {HardhatRuntimeEnvironment} from 'hardhat/types';
import hre from 'hardhat';
import {xyToLocation} from 'conquest-eth-common';

const args = process.argv.slice(2);

if (args.length === 0) {
  throw new Error(`need to pass the addresses to send to`);
}
let location = args[0];

if (args.length === 1) {
  throw new Error(`need to pass sponsor name`);
}
const sponsor = args[1];
let giverAddress: string | undefined;
if (sponsor === 'xaya') {
  giverAddress = '0xdddddddddddddddddddddddddddddddddddddddd';
} else if (sponsor === 'pokt') {
  giverAddress = '0x1111111111111111111111111111111111111111';
} else if (sponsor === 'da') {
  giverAddress = '0x2222222222222222222222222222222222222222';
}

if (!giverAddress) {
  throw new Error(`unknown sponsor: ${sponsor}`);
}

if (location.indexOf(',') !== -1) {
  const [x, y] = location.split(',').map((v) => parseInt(v));
  location = xyToLocation(x, y);
}

async function func(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployer} = await hre.getNamedAccounts();
  const {execute} = hre.deployments;
  await execute(
    'OuterSpace',
    {from: deployer, log: true},
    'addReward',
    location,
    giverAddress
  );
}
if (require.main === module) {
  func(hre);
}
