import {HardhatRuntimeEnvironment} from 'hardhat/types';
import hre, {deployments} from 'hardhat';
import {formatEther, parseEther} from '@ethersproject/units';
import {Wallet} from '@ethersproject/wallet';
import qrcode from 'qrcode';

const append = true;

// const args = process.argv.slice(2);

// if (args.length === 0) {
//   throw new Error(`need to pass the number of claim keys to generate`);
// }
// const numClaimKey = parseInt(args[0]);
// if (isNaN(numClaimKey) || numClaimKey === 0 || numClaimKey > 100) {
//   throw new Error(`invalid number of claims`);
// }
const offset = 0;

let mainURL = `https://${hre.network.name}.conquest.etherplay.io/`;

if (!mainURL.endsWith('/')) {
  mainURL = mainURL + '/';
}

async function func(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployer} = await hre.getNamedAccounts();
  const {network, getChainId, ethers} = hre;

  let mnemonic = 'curious erupt response napkin sick ketchup hard estate comic club female sudden';
  // TODO check hardhat-deploy: if (network.live) {
  if (network.name !== 'hardhat' && network.name !== 'localhost') {
    mnemonic = Wallet.createRandom().mnemonic.phrase;
    const pastMnemonicsFilename = `.claimKeys.mnemonics`;
    let pastMnemonics = [];
    try {
      const mnemonicSrc = await deployments.readDotFile(pastMnemonicsFilename);
      pastMnemonics = JSON.parse(mnemonicSrc);
    } catch (e) {}
    pastMnemonics.push(mnemonic);
    await deployments.saveDotFile(pastMnemonicsFilename, JSON.stringify(pastMnemonics));
  }

  const PlayTokenDeployment = await deployments.get('PlayToken');

  const claimKeyETHAmount = parseEther('1'); // TODO 3 ?
  const tokenAmount = parseEther('25');

  const amountOfNativeToken = tokenAmount
    .mul(parseEther('1'))
    .div(PlayTokenDeployment.linkedData.numTokensPerNativeTokenAt18Decimals);

  console.log({
    amountOfNativeToken: formatEther(amountOfNativeToken),
    tokenAmount: formatEther(tokenAmount),
    claimKeyETHAmount: formatEther(claimKeyETHAmount),
  });
  const path = "m/44'/60'/" + 0 + "'/0/0";
  const wallet = Wallet.fromMnemonic(mnemonic, path);

  await deployments.execute(
    'FreePlayToken',
    {
      from: deployer,
      log: true,
      autoMine: true,
      value: amountOfNativeToken.add(claimKeyETHAmount),
      gasLimit: 300000,
    },
    'mintViaNativeTokenPlusSendExtraNativeTokens',
    wallet.address,
    tokenAmount
  );

  let mainURL = `https://${hre.network.name}.conquest.etherplay.io/`;

  if (!mainURL.endsWith('/')) {
    mainURL = mainURL + '/';
  }
  const url = `${mainURL}#tokenClaim=${wallet.privateKey}`;
  console.log();
  console.log(wallet.privateKey);
  const qrURL = await qrcode.toDataURL(url);
  console.log(qrURL);
}

// function wait(time: number): Promise<void> {
//   return new Promise<void>((resolve) => {
//     setTimeout(resolve, time * 1000);
//   });
// }

async function main() {
  // for (let i = 0; i < 107; i++) {
  //   console.log(`executing ${i} ... in 3s`);
  // await wait(3);
  await func(hre);
  // }
}

if (require.main === module) {
  main();
}
