import {HardhatRuntimeEnvironment} from 'hardhat/types';
import hre from 'hardhat';
import 'dotenv/config';
import {TheGraph} from '../utils/thegraph';
import {BigNumber} from 'ethers';

async function func(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments} = hre;
  const theGraph = new TheGraph(`https://api.thegraph.com/subgraphs/name/${process.env.SUBGRAPH_NAME}`);
  // query($blockNumber: Int! $first: Int! $lastId: ID! $id: ID!) {
  const queryString = `
query($first: Int! $lastId: ID!) {
    owners(first: $first where: {
      #totalStaked_gt: 0
      id_gt: $lastId
      totalStaked_gt: 0
      id_not: "0x0000000000000000000000000000000000000000"
      tokenGiven_gt: "0"
      tokenGiven_lte: "300000000000000000000"

    }) {
      id
      introducer { id }
      tokenGiven
    }
}
`;

  const players: {
    id: string;
    introducer: {id: string};
    tokenGiven: string;
  }[] = await theGraph.query(queryString, {field: 'owners'});

  const airdrop: {address: string; tokenUnitGivenSoFar: number}[] = [];
  for (const player of players) {
    const tokenUnitGivenSoFar = BigNumber.from(player.tokenGiven).div('1000000000000000000').toNumber();
    airdrop.push({address: player.id, tokenUnitGivenSoFar});
  }

  await deployments.saveDotFile('.airdrop.json', JSON.stringify(airdrop, null, 2));
}

async function main() {
  await func(hre);
}

if (require.main === module) {
  main();
}
