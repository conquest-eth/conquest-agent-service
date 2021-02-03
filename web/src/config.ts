const chainId = import.meta.env.SNOWPACK_PUBLIC_CHAIN_ID;
let nodeUrl: string | undefined;
let finality = 12;
if (chainId === '1337' || chainId === '31337') {
  const localEthNode = import.meta.env.SNOWPACK_PUBLIC_ETH_NODE_URI_LOCALHOST;
  if (localEthNode && localEthNode !== '') {
    nodeUrl = localEthNode;
  } else {
    nodeUrl = 'http://localhost:8545';
  }
  finality = 2;
}

if (chainId !== '1') {
  finality = 3; // TODO
}

export {finality, nodeUrl, chainId};
