import {getDefaultProvider, Provider} from '@ethersproject/providers';
import {contractsInfos} from './blockchain/contractsInfos';
import {nameForChainId} from './utils/networks';
import {getParamsFromLocation, getHashParamsFromLocation} from './utils/web';

export const hashParams = getHashParamsFromLocation();
export const {params} = getParamsFromLocation();
// export const VERSION = '1';

const chainId = import.meta.env.VITE_CHAIN_ID as string;
let fallbackProviderOrUrl: string | Provider | undefined;
let finality = 12;
let blockTime = 15;
let nativeTokenSymbol = 'ETH';
if (chainId !== '1') {
  finality = 5; // TODO
  blockTime = 10;
  nativeTokenSymbol = 'ETH'; // TODO
}

if (chainId === '1337' || chainId === '31337') {
  fallbackProviderOrUrl = import.meta.env.VITE_ETH_NODE_URI_LOCALHOST as string;
  // const localEthNode = import.meta.env.VITE_ETH_NODE_URI_LOCALHOST as string;
  // if (localEthNode && localEthNode !== '') {
  //   fallbackProviderOrUrl = localEthNode;
  // } else {
  //   fallbackProviderOrUrl = 'http://localhost:8545';
  // }
  finality = 2;
  blockTime = 5;
}

const chainName = nameForChainId(chainId);

if (!fallbackProviderOrUrl) {
  const url = import.meta.env.VITE_ETH_NODE_URI as string; // TODO use query string to specify it // TODO settings
  if (url && url !== '') {
    fallbackProviderOrUrl = url;
  }
}

if (fallbackProviderOrUrl && typeof fallbackProviderOrUrl === 'string') {
  if (!fallbackProviderOrUrl.startsWith('http') && !fallbackProviderOrUrl.startsWith('ws')) {
    // if no http nor ws protocol, assume fallbackProviderOrUrl is the network name
    // use ethers fallback provider
    fallbackProviderOrUrl = getDefaultProvider(fallbackProviderOrUrl, {
      alchemy: import.meta.env.VITE_ALCHEMY_API_KEY || undefined,
      etherscan: import.meta.env.VITE_ETHERSCAN_API_KEY || undefined,
      infura: import.meta.env.VITE_INFURA_PROJECT_ID || undefined,
      pocket: import.meta.env.VITE_POCKET_APP_ID || undefined,
      quorum: 2,
    });
  } else {
    fallbackProviderOrUrl = getDefaultProvider(fallbackProviderOrUrl); // still use fallback provider but use the url as is
  }
}

const graphNodeURL = import.meta.env.VITE_THE_GRAPH_HTTP as string;

const logPeriod = 7 * 24 * 60 * 60;
const deletionDelay = 7 * 24 * 60 * 60;

const lowFrequencyFetch = blockTime * 8;
const mediumFrequencyFetch = blockTime * 4;
const highFrequencyFetch = blockTime * 2;

const globalQueryParams = ['debug', 'log', 'subgraph', 'ethnode', '_d_eruda', 'sync', 'agent-service'];

const SYNC_URI = params.sync || (import.meta.env.VITE_SYNC_URI as string); //  'http://invalid.io'; // to emulate connection loss :)
const SYNC_DB_NAME =
  'conquest-' +
  contractsInfos.contracts.OuterSpace.address +
  (contractsInfos.contracts.OuterSpace.linkedData.chainGenesisHash
    ? ':' + contractsInfos.contracts.OuterSpace.linkedData.chainGenesisHash
    : '');

const AGENT_SERVICE_URL = params['agent-service'] || (import.meta.env.VITE_AGENT_SERVICE_URL as string); //  'http://invalid.io'; // to emulate connection loss :)

let _dropTransactions = false;
function dropTransactions(yes: boolean): void {
  _dropTransactions = yes;
}

function shouldDropTransactions(): boolean {
  return _dropTransactions;
}

export {
  finality,
  fallbackProviderOrUrl,
  chainId,
  blockTime,
  chainName,
  nativeTokenSymbol,
  graphNodeURL,
  logPeriod,
  lowFrequencyFetch,
  mediumFrequencyFetch,
  highFrequencyFetch,
  globalQueryParams,
  SYNC_URI,
  SYNC_DB_NAME,
  AGENT_SERVICE_URL,
  deletionDelay,
  shouldDropTransactions,
  dropTransactions,
};
