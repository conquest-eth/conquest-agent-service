const chainId = import.meta.env.VITE_CHAIN_ID;
let nodeUrl: string | undefined;
let finality = 12;
if (chainId === '1337' || chainId === '31337') {
  const localEthNode = import.meta.env.VITE_ETH_NODE_URI_LOCAL;
  if (localEthNode && localEthNode !== "") {
    nodeUrl = localEthNode;
  } else {
    nodeUrl = 'http://localhost:8545';
  }
  finality = 2;
}

export {
  finality,
  nodeUrl,
  chainId
}
