import {HardhatRuntimeEnvironment} from 'hardhat/types';
import hre from 'hardhat';
import 'dotenv/config';
import {TheGraph} from '../utils/thegraph';

async function func(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments} = hre;
  const theGraph = new TheGraph(
    `https://api.thegraph.com/subgraphs/name/${process.env.SUBGRAPH_NAME}`
  );

  // query($blockNumber: Int! $first: Int! $lastId: ID! $id: ID!) {
  const queryString = `
query($first: Int! $lastId: ID!) {
    planets(first: $first where: {
      id_gt: $lastId
    }) {
      id
    }
}
`;

  const planets: {
    id: string;
  }[] = await theGraph.query(queryString, {field: 'planets'});

  await deployments.saveDotFile(
    '.planets.json',
    JSON.stringify(planets, null, 2)
  );
  console.log({numPlanets: planets.length});
}

async function main() {
  await func(hre);
}

if (require.main === module) {
  main();
}
