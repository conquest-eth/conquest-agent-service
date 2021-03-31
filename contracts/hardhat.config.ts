import 'dotenv/config';
import {HardhatUserConfig} from 'hardhat/types';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import 'hardhat-contract-sizer';
import {node_url, accounts} from './utils/network';

const l1_pre_deploy_missing_contracts =
  'deploy_l1/00_pre_deploy_missing_contracts';
const l1_deploy = 'deploy_l1/01_deploy';
const l1_dev_seed = 'deploy_l1/02_post_deploy_seed_dev';

const l2_deploy = 'deploy_l2';

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.7.5',
        // settings: {
        //   optimizer: {
        //     enabled: true,
        //     runs: 2000,
        //   },
        // },
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
    stableTokenBeneficiary: {
      hardhat: 9,
      1337: 9,
      4: 1,
    },
    claimKeyDistributor: {
      hardhat: 0,
      1337: 0,
      4: 2,
    },
  },
  networks: {
    hardhat: {
      accounts: accounts(),
      deploy: [
        l1_pre_deploy_missing_contracts,
        l1_deploy,
        l1_dev_seed,
        l2_deploy,
      ],
    },
    localhost: {
      url: node_url('localhost'),
      accounts: accounts(),
      deploy: [
        l1_pre_deploy_missing_contracts,
        l1_deploy,
        l1_dev_seed,
        l2_deploy,
      ],
    },
    mainnet: {
      url: node_url('mainnet'),
      accounts: accounts('mainnet'),
      deploy: [l1_deploy],
    },
    rinkeby: {
      url: node_url('rinkeby'),
      accounts: accounts('rinkeby'),
      deploy: [l1_pre_deploy_missing_contracts, l1_deploy, l2_deploy], // rinkeby inclues both
    },
    kovan: {
      url: node_url('kovan'),
      accounts: accounts('kovan'),
      deploy: [l1_pre_deploy_missing_contracts, l1_deploy],
    },
    goerli: {
      url: node_url('goerli'),
      accounts: accounts('goerli'),
      deploy: [l1_pre_deploy_missing_contracts, l1_deploy],
    },
    staging: {
      url: node_url('rinkeby'),
      accounts: accounts('rinkeby'),
      deploy: [l1_pre_deploy_missing_contracts, l1_deploy, l2_deploy], // rinkeby inclues both
    },
  },
  paths: {
    sources: 'src',
    deploy: [l1_deploy],
  },
  mocha: {
    timeout: 0,
  },
  external: {
    contracts: [
      {
        artifacts: 'node_modules/ethereum-transfer-gateway/export/artifacts',
        deploy: 'node_modules/ethereum-transfer-gateway/export/deploy',
      },
    ],
  },
};

export default config;
