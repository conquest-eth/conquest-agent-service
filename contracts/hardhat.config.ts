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

const l1_pre_deploy_missing_contracts =
  'deploy_l1/00_pre_deploy_missing_contracts';
const l1_deploy = 'deploy_l1/01_deploy';
const l1_dev_seed = 'deploy_l1/02_post_deploy_seed_dev';

const l2_deploy = 'deploy_l2/01_deploy';
const l2_dev_seed = 'deploy_l2/02_post_deploy_seed_dev';

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
    stableTokenBeneficiary: {
      hardhat: 9,
      1337: 9,
      31337: 9,
      4: 1,
      5: 1,
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
      deploy: [
        l1_pre_deploy_missing_contracts,
        l1_deploy,
        l1_dev_seed,
        l2_deploy,
        l2_dev_seed,
      ],
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
      deploy: [
        l1_pre_deploy_missing_contracts,
        l1_deploy,
        l1_dev_seed,
        l2_deploy,
        l2_dev_seed,
      ],
    },
    dev: {
      url: node_url('goerli'),
      accounts: accounts('goerli'),
      deploy: [
        l1_pre_deploy_missing_contracts,
        l1_deploy,
        l1_dev_seed,
        l2_deploy,
        l2_dev_seed,
      ], // testing inclues both
    },
    quick: {
      url: node_url('goerli'),
      accounts: accounts('goerli'),
      deploy: [
        l1_pre_deploy_missing_contracts,
        l1_deploy,
        l1_dev_seed,
        l2_deploy,
        l2_dev_seed,
      ], // quick inclues both
    },
    alpha: {
      url: node_url('goerli'),
      accounts: accounts('goerli'),
      deploy: [
        l1_pre_deploy_missing_contracts,
        l1_deploy,
        l1_dev_seed,
        l2_deploy,
        l2_dev_seed,
      ], // alpha inclues both
    },
    forfun: {
      url: node_url('goerli'),
      accounts: accounts('goerli'),
      deploy: [
        l1_pre_deploy_missing_contracts,
        l1_deploy,
        l1_dev_seed,
        l2_deploy,
        l2_dev_seed,
      ], // forfun inclues both
    },
    production: {
      url: node_url('mainnet'),
      accounts: accounts('mainnet'),
      deploy: [l1_deploy],
    },
  },
  paths: {
    sources: 'src',
    deploy: [l1_deploy],
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
    project: 'conquest-eth',
    username: process.env.TENDERLY_USERNAME as string,
  },
};

export default config;
