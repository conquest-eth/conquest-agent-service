import {getUnnamedAccounts, ethers} from 'hardhat';

const messages = ['Hello', '你好', 'سلام', 'здравствуйте', 'Habari', 'Bonjour', 'नमस्ते'];

function waitFor<T>(p: Promise<{wait: () => Promise<T>}>): Promise<T> {
  return p.then((tx) => tx.wait());
}

async function main() {
  const others = await getUnnamedAccounts();
  for (let i = 0; i < messages.length; i++) {
    const sender = others[i];
    if (sender) {
      const outerSpaceContract = await ethers.getContract('OuterSpace', sender);
      await waitFor(outerSpaceContract.setMessage(messages[i]));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
