import {HardhatRuntimeEnvironment} from 'hardhat/types';
import hre from 'hardhat';
import {parseEther} from '@ethersproject/units';
import {BigNumber} from '@ethersproject/bignumber';
import {Wallet} from '@ethersproject/wallet';
import fs from 'fs';
import qrcode from 'qrcode';

const append = true;

const args = process.argv.slice(2);

if (args.length === 0) {
  throw new Error(`need to pass the number of claim keys to generate`);
}
const numClaimKey = parseInt(args[0]);
if (isNaN(numClaimKey) || numClaimKey === 0 || numClaimKey > 100) {
  throw new Error(`invalid number of claims`);
}
const offset = 0;

let mainURL = 'https://conquest-rinkeby.on.fleek.co';
if (!mainURL.endsWith('/')) {
  mainURL = mainURL + '/';
}

async function func(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {claimKeyDistributor} = await hre.getNamedAccounts();
  const {network, getChainId, ethers} = hre;
  const {execute, read} = hre.deployments;

  let mnemonic = 'curious erupt response napkin sick ketchup hard estate comic club female sudden';
  if (network.live) {
    mnemonic = Wallet.createRandom().mnemonic.phrase;
    const pastMnemonicsPath = `.${network.name}.claimKeys.mnemonics`;
    let pastMnemonics = [];
    try {
      pastMnemonics = JSON.parse(fs.readFileSync(pastMnemonicsPath).toString());
    } catch (e) {}
    pastMnemonics.push(mnemonic);
    fs.writeFileSync(pastMnemonicsPath, JSON.stringify(pastMnemonics));
  }

  const claimKeyETHAmount = parseEther('0.2');
  const claimKeyTokenAmount = parseEther('200');

  const claimKeys: {key: string; amount: number}[] = [];
  const addresses = [];
  let totalETHAmount = BigNumber.from(0);
  let totalTokenAmount = BigNumber.from(0);
  const amounts: BigNumber[] = [];
  for (let i = offset; i < numClaimKey + offset; i++) {
    const path = "m/44'/60'/" + i + "'/0/0";
    const wallet = Wallet.fromMnemonic(mnemonic, path);
    // TODO claimKeyTokenAmount +-
    claimKeys.push({key: wallet.privateKey, amount: claimKeyTokenAmount.div('1000000000000000000').toNumber()});
    addresses.push(wallet.address);
    amounts.push(claimKeyTokenAmount);
    totalETHAmount = totalETHAmount.add(claimKeyETHAmount);
    totalTokenAmount = totalTokenAmount.add(claimKeyTokenAmount);
  }

  const claimKeyDistributorETHBalance = await ethers.provider.getBalance(claimKeyDistributor);
  const claimKeyDistributorTokenBalance = await read('PlayToken_L2', 'balanceOf', claimKeyDistributor);

  console.log({
    claimKeyDistributor,
    claimKeyDistributorETHBalance: claimKeyDistributorETHBalance.toString(),
    claimKeyDistributorTokenBalance: claimKeyDistributorTokenBalance.toString(),
    totalETHAmount: totalETHAmount.toString(),
    addresses,
    totalTokenAmount: totalTokenAmount.toString(),
  });
  await execute(
    'PlayToken_L2',
    {from: claimKeyDistributor, value: totalETHAmount.toString(), log: true},
    'distributeVariousAmountsAlongWithETH',
    addresses,
    amounts
  );

  let explorerLink = '';
  let etherscanNetworkPrefix: string | undefined;
  const chainId = await getChainId();
  if (chainId === '1') {
    etherscanNetworkPrefix = '';
  } else if (chainId === '4') {
    etherscanNetworkPrefix = 'rinkeby.';
  } else if (chainId === '42') {
    etherscanNetworkPrefix = 'kovan.';
  } else if (chainId === '5') {
    etherscanNetworkPrefix = 'goerli.';
  } // TODO more
  if (etherscanNetworkPrefix !== undefined) {
    explorerLink = `https://${etherscanNetworkPrefix}etherscan.io/address/`;
  }

  const filename = `.${network.name}.claimKeys`;
  if (append) {
    let previous: {key: string; amount: number}[] = [];
    try {
      previous = JSON.parse(fs.readFileSync(filename).toString());
    } catch (e) {}
    fs.writeFileSync(filename, JSON.stringify(previous.concat(claimKeys), null, 2));
  } else {
    fs.writeFileSync(filename, JSON.stringify(claimKeys, null, 2));
  }

  let csv = 'used,address,key,amount,url,qrURL\n';
  for (const claimKey of claimKeys) {
    const url = `${mainURL}#tokenClaim=${claimKey.key}`;
    const qrURL = await qrcode.toDataURL(url);
    const address = new Wallet(claimKey.key).address;
    csv += `false,${explorerLink}${address},${claimKey.key},${claimKey.amount},${url},"${qrURL}"\n`;
  }
  fs.writeFileSync(`.${network.name}.claimKeys.csv`, csv);
}
if (require.main === module) {
  func(hre);
}
