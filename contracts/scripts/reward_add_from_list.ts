import {HardhatRuntimeEnvironment} from 'hardhat/types';
import hre from 'hardhat';
import fs from 'fs';

const planets = JSON.parse(fs.readFileSync('planets-chosen.json').toString());

async function func(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployer} = await hre.getNamedAccounts();
  const {execute} = hre.deployments;
  for (const planet of planets) {
    console.log(planet.location);
    const receipt = await execute(
      'OuterSpace',
      {from: deployer, log: true},
      'addReward',
      planet.location,
      '0xdddddddddddddddddddddddddddddddddddddddd'
    );
    console.log(receipt.transactionHash);
  }
}
if (require.main === module) {
  func(hre);
}
