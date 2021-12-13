import {HardhatRuntimeEnvironment} from 'hardhat/types';
import hre from 'hardhat';
import {parseEther} from '@ethersproject/units';
import {BigNumber} from '@ethersproject/bignumber';
import fs from 'fs';

async function func(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {claimKeyDistributor} = await hre.getNamedAccounts();
  const {execute} = hre.deployments;

  const recipients: {address: string; amount: number}[] = JSON.parse(
    await hre.deployments.readDotFile('.airdrop.json')
  );

  const amounts: BigNumber[] = [];
  const addresses: string[] = [];

  for (const recipient of recipients) {
    // amounts.push(BigNumber.from(recipient.amount).mul('1000000000000000000'));
    // give 200
    // amounts.push(BigNumber.from(200).mul('1000000000000000000'));
    amounts.push(BigNumber.from(100).mul('1000000000000000000'));
    addresses.push(recipient.address);
  }
  const etherAmount = BigNumber.from(addresses.length).mul(parseEther('0.5'));

  // console.log({amounts: amounts.map((v) => v.toString()), addresses, etherAmount: etherAmount.toString()});
  await execute(
    'PlayToken_L2',
    {from: claimKeyDistributor, value: etherAmount, log: true, autoMine: true},
    'distributeVariousAmountsAlongWithETH',
    addresses,
    amounts
  );
}
if (require.main === module) {
  func(hre);
}
