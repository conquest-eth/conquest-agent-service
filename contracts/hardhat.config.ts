import 'dotenv/config';
import {HardhatUserConfig} from 'hardhat/types';
import 'hardhat-deploy';
import '@nomiclabs/hardhat-ethers';
import 'hardhat-gas-reporter';
import '@typechain/hardhat';
import 'solidity-coverage';
import 'hardhat-contract-sizer';
import 'hardhat-deploy-tenderly';
import {node_url, accounts} from './utils/network';
/* import './utils/tx-handler'; */
import './utils/metadata';

// While waiting for hardhat PR: https://github.com/nomiclabs/hardhat/pull/1542
if (process.env.HARDHAT_FORK) {
  process.env['HARDHAT_DEPLOY_FORK'] = process.env.HARDHAT_FORK;
}

const l1_deployments: string[] = ['deploy_l1/01_conquest_tokens'];
const l1_deployments_dev: string[] = [];
const l2_deployments: string[] = [
  'deploy_l2/01_conquest_token',
  'deploy_l2/02_alliance_registry',
  'deploy_l2/03_outerspace',
];
const l2_deployments_dev: string[] = [
  'deploy_l2/04_setup',
  'deploy_l2/10_agent_service',
  'deploy_l2/20_basic_alliances',
  'deploy_l2/30_spaceship_markets',
];

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.9',
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          },
        },
      },
      {
        version: '0.5.12', // For Dai.sol
        settings: {
          optimizer: {
            enabled: false,
            runs: 2000,
          },
        },
      },
    ],
  },
  namedAccounts: {
    deployer: 0,
    agentService: {
      1337: '0x3bfa2f0888E7d87f9bb044EAE82CEb62290337B4', // see ../agent-service/.env(.default)
      31337: '0x3bfa2f0888E7d87f9bb044EAE82CEb62290337B4',
    },
    claimKeyDistributor: {
      hardhat: 0,
      1337: 0,
      31337: 0,
      4: 2,
      5: 2,
    },
  },
  networks: {
    hardhat: {
      // process.env.HARDHAT_FORK will specify the network that the fork is made from.
      // this line ensure the use of the corresponding accounts
      accounts: accounts(process.env.HARDHAT_FORK),
      forking: process.env.HARDHAT_FORK
        ? {
            url: node_url(process.env.HARDHAT_FORK),
            blockNumber: process.env.HARDHAT_FORK_NUMBER
              ? parseInt(process.env.HARDHAT_FORK_NUMBER)
              : undefined,
          }
        : undefined,
      deploy: l1_deployments.concat(
        l1_deployments_dev,
        l2_deployments,
        l2_deployments_dev
      ),
      mining: process.env.MINING_INTERVAL
        ? {
            auto: false,
            interval: process.env.MINING_INTERVAL.split(',').map((v) =>
              parseInt(v)
            ) as [number, number],
          }
        : undefined,
    },
    localhost: {
      url: node_url('localhost'),
      accounts: accounts(),
      deploy: l1_deployments.concat(
        l1_deployments_dev,
        l2_deployments,
        l2_deployments_dev
      ),
    },
    dev: {
      url: node_url('goerli'),
      accounts: accounts('goerli'),
      deploy: l1_deployments.concat(
        l1_deployments_dev,
        l2_deployments,
        l2_deployments_dev
      ),
    },
    quick: {
      url: node_url('goerli'),
      accounts: accounts('goerli'),
      deploy: l1_deployments.concat(
        l1_deployments_dev,
        l2_deployments,
        l2_deployments_dev
      ),
    },
    alpha: {
      url: node_url('goerli'),
      accounts: accounts('goerli'),
      deploy: l1_deployments.concat(
        l1_deployments_dev,
        l2_deployments,
        l2_deployments_dev
      ),
    },
    forfun: {
      url: node_url('goerli'),
      accounts: accounts('goerli'),
      deploy: l1_deployments.concat(
        l1_deployments_dev,
        l2_deployments,
        l2_deployments_dev
      ),
    },
    production: {
      url: node_url('mainnet'),
      accounts: accounts('mainnet'),
      deploy: l1_deployments.concat(l1_deployments_dev),
    },
  },
  paths: {
    sources: 'src',
    deploy: ['deploy_l1'],
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 100,
    enabled: process.env.REPORT_GAS ? true : false,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    maxMethodDiff: 10,
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
  mocha: {
    timeout: 0,
  },
  external: {
    deployments: process.env.HARDHAT_FORK
      ? {
          // process.env.HARDHAT_FORK will specify the network that the fork is made from.
          // these lines allow it to fetch the deployments from the network being forked from both for node and deploy task
          hardhat: ['deployments/' + process.env.HARDHAT_FORK],
          localhost: ['deployments/' + process.env.HARDHAT_FORK],
        }
      : undefined,
    contracts: [
      {
        artifacts: 'node_modules/ethereum-transfer-gateway/export/artifacts',
        deploy: 'node_modules/ethereum-transfer-gateway/export/deploy',
      },
    ],
  },

  tenderly: {
    project: 'conquest-eth', // TODO parameterize with network name
    username: process.env.TENDERLY_USERNAME as string,
  },
};

export default config;
