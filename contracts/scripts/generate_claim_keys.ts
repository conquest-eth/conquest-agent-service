import {HardhatRuntimeEnvironment} from 'hardhat/types';
import hre from 'hardhat';
import {parseEther} from '@ethersproject/units';
import {BigNumber} from '@ethersproject/bignumber';
import {Wallet} from '@ethersproject/wallet';
import fs from 'fs';
import qrcode from 'qrcode';

async function func(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {claimKeyDistributor} = await hre.getNamedAccounts();
  const {execute} = hre.deployments;

  const numClaimKey = 5; // TODO
  const offset = 0;

  // TODO keep it secret
  const mnemonic =
    'curious erupt response napkin sick ketchup hard estate comic club female sudden';

  const claimKeyETHAmount = parseEther('0.1');
  const claimKeyTokenAmount = parseEther('100');

  const claimKeys = [];
  const addresses = [];
  let totalETHAmount = BigNumber.from(0);
  let totalTokenAmount = BigNumber.from(0);
  for (let i = offset; i < numClaimKey + offset; i++) {
    const path = "m/44'/60'/" + i + "'/0/0";
    const wallet = Wallet.fromMnemonic(mnemonic, path);
    claimKeys.push(wallet.privateKey);
    addresses.push(wallet.address);
    totalETHAmount = totalETHAmount.add(claimKeyETHAmount);
    totalTokenAmount = totalTokenAmount.add(claimKeyTokenAmount);
  }

  await execute(
    'PlayToken',
    {from: claimKeyDistributor, value: totalETHAmount.toString(), log: true},
    'distributeAlongWithETH',
    addresses,
    totalTokenAmount
  );

  fs.writeFileSync('.claimKeys', JSON.stringify(claimKeys, null, 2));
  let csv = 'key,qrURL,url,used\n';
  for (const claimKey of claimKeys) {
    const url = 'https://conquest.eth/#tokenClaim=' + claimKey;
    const qrURL = await qrcode.toDataURL(url);
    csv += claimKey + ',"' + qrURL + '",' + url + ',false ' + '\n';
  }
  fs.writeFileSync('.claimKeys.csv', csv);
}
if (require.main === module) {
  func(hre);
}
