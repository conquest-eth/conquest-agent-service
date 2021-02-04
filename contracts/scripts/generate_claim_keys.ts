import {HardhatRuntimeEnvironment} from 'hardhat/types';
import hre from 'hardhat';
import {parseEther} from '@ethersproject/units';
import {BigNumber} from '@ethersproject/bignumber';
import {Wallet} from '@ethersproject/wallet';
import fs from 'fs';
import qrcode from 'qrcode';

const args = process.argv.slice(2);

if (args.length === 0) {
  throw new Error(`need to pass the number of claim keys to generate`);
}
const numClaimKey = parseInt(args[0]);
if (isNaN(numClaimKey) || numClaimKey === 0 || numClaimKey > 100) {
  throw new Error(`invalid number of claims`);
}
const offset = 0;

async function func(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {claimKeyDistributor} = await hre.getNamedAccounts();
  const {network} = hre;
  const {execute} = hre.deployments;

  let mnemonic =
    'curious erupt response napkin sick ketchup hard estate comic club female sudden';
  if (network.live) {
    mnemonic = Wallet.createRandom().mnemonic.phrase;
    const pastMnemonicsPath = '.claimKeys.mnemonics';
    let pastMnemonics = [];
    try {
      pastMnemonics = JSON.parse(fs.readFileSync(pastMnemonicsPath).toString());
    } catch (e) {}
    pastMnemonics.push(mnemonic);
    fs.writeFileSync(pastMnemonicsPath, JSON.stringify(pastMnemonics));
  }

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
