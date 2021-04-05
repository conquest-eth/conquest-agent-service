import {getDefaultProvider, Provider} from '@ethersproject/providers';

const chainId = import.meta.env.SNOWPACK_PUBLIC_CHAIN_ID;
let fallbackProviderOrUrl: string | Provider | undefined;
let finality = 12;
let blockTime = 15;
let nativeTokenSymbol = 'ETH';
if (chainId !== '1') {
  finality = 5; // TODO
  nativeTokenSymbol = 'ETH'; // TODO
}

if (chainId === '1337' || chainId === '31337') {
  const localEthNode = import.meta.env.SNOWPACK_PUBLIC_ETH_NODE_URI_LOCALHOST;
  if (localEthNode && localEthNode !== '') {
    fallbackProviderOrUrl = localEthNode;
  } else {
    fallbackProviderOrUrl = 'http://localhost:8545';
  }
  finality = 2;
  blockTime = 5;
}

const chainNames: {[chainId: string]: string} = {
  '1': 'mainnet',
  '3': 'ropsten',
  '4': 'rinkeby',
  '5': 'goerli',
  '42': 'kovan',
  '1337': 'localhost chain',
  '31337': 'localhost chain',
};

const chainName = (() => {
  const name = chainNames[chainId];
  if (name) {
    return name;
  }
  return `chain with id ${chainId}`;
})();

if (!fallbackProviderOrUrl) {
  const url = import.meta.env.SNOWPACK_PUBLIC_ETH_NODE_URI; // TODO use query string to specify it // TODO settings
  if (url && url !== '') {
    fallbackProviderOrUrl = url;
  }
}

if (typeof fallbackProviderOrUrl === 'string') {
  if (
    !fallbackProviderOrUrl.startsWith('http') &&
    !fallbackProviderOrUrl.startsWith('ws')
  ) {
    // if no http nor ws protocol, assume fallbackProviderOrUrl is the network name
    // use ethers fallback provider
    fallbackProviderOrUrl = getDefaultProvider(fallbackProviderOrUrl, {
      alchemy: import.meta.env.SNOWPACK_PUBLIC_ALCHEMY_API_KEY || undefined,
      etherscan: import.meta.env.SNOWPACK_PUBLIC_ETHERSCAN_API_KEY || undefined,
      infura: import.meta.env.SNOWPACK_PUBLIC_INFURA_PROJECT_ID || undefined,
      pocket: import.meta.env.SNOWPACK_PUBLIC_POCKET_APP_ID || undefined,
      quorum: 2,
    });
  } else {
    fallbackProviderOrUrl = getDefaultProvider(fallbackProviderOrUrl); // still use fallback provider but use the url as is
  }
}

export {
  finality,
  fallbackProviderOrUrl,
  chainId,
  blockTime,
  chainName,
  nativeTokenSymbol,
};
