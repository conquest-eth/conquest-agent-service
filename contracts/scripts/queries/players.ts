import {HardhatRuntimeEnvironment} from 'hardhat/types';
import hre from 'hardhat';
import 'dotenv/config';
import {TheGraph} from '../utils/thegraph';

async function func(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments} = hre;
  const theGraph = new TheGraph(`https://api.thegraph.com/subgraphs/name/${process.env.SUBGRAPH_NAME}`);

  const queryString = `
query($blockNumber: Int! $first: Int! $lastId: ID!) {
    owners(first: $first block: {number: $blockNumber} where: {
      totalStaked_gt: 0
      id_gt: $lastId
    }) {
      id
      introducer { id }
      tokenGiven
    }
}
`;

  const players: {
    id: string;
  }[] = await theGraph.query(queryString, {
    field: 'owners',
    variables: {
      blockNumber: 21538868,
    },
  });

  await deployments.saveDotFile('.players.json', JSON.stringify(players, null, 2));
  console.log({numPlayers: players.length});
}

async function main() {
  await func(hre);
}

if (require.main === module) {
  main();
}
