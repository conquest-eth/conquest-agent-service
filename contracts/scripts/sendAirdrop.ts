import {HardhatRuntimeEnvironment} from 'hardhat/types';
import hre from 'hardhat';
import {parseEther} from '@ethersproject/units';
import {BigNumber} from '@ethersproject/bignumber';
import fs from 'fs';

const recipients: {address: string; amount: number}[] = JSON.parse(fs.readFileSync('../airdrop.json').toString());

async function func(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {claimKeyDistributor} = await hre.getNamedAccounts();
  const {execute} = hre.deployments;
  const amounts: BigNumber[] = [];
  const addresses: string[] = [];

  for (const recipient of recipients) {
    amounts.push(BigNumber.from(recipient.amount).mul('1000000000000000000'));
    addresses.push(recipient.address);
  }
  const etherAmount = BigNumber.from(addresses.length).mul(parseEther('0.1'));

  // console.log({amounts: amounts.map((v) => v.toString()), addresses, etherAmount: etherAmount.toString()});
  await execute(
    'PlayToken_L2',
    {from: claimKeyDistributor, value: etherAmount, log: true},
    'distributeVariousAmountsAlongWithETH',
    addresses,
    amounts
  );
}
if (require.main === module) {
  func(hre);
}
