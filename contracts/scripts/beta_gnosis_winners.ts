import {locationToXY, xyToLocation} from 'conquest-eth-common';
import 'dotenv/config';
import {TheGraph} from './utils/thegraph';
const theGraph = new TheGraph(`https://api.thegraph.com/subgraphs/name/${process.env.SUBGRAPH_NAME}`);

const planetsStrings = ['-49,-43', '-9,80', '-120,-11', '-2,67', '-46,51', '-21,74', '-6,-27'];

const planets = planetsStrings.map((v) => {
  const splitted = v.split(',');
  return xyToLocation(parseInt(splitted[0]), parseInt(splitted[1]));
});

console.log({planets});

const queryString = `
query($planets: [ID!]! $blockNumber: Int!) {
  planetExitEvents(orderBy: timestamp orderDirection: asc block: {number: $blockNumber} where: {planet_in: $planets}) {
    planet {id x y}
    owner { id}
    exitTime
    interupted
    complete
    success
  }
  # exitCompleteEvents(orderBy: timestamp orderDirection: asc block: {number: $blockNumber} where: {planet_in: $planets}) {
  #   planet {id x y}
  #   owner { id}
  # }
  planets(block: {number: $blockNumber} where: {id_in: $planets}) {
    id
    owner { id }
  }
}
`;

async function main() {
  const result = await theGraph.query(queryString, {
    variables: {planets: planets, blockNumber: 21367725}, // TODO blockNumber
  });
  const data = result[0] as {
    planetExitEvents: {
      exitTime: string;
      owner: {id: string};
      planet: {id: string; x: number; y: number};
      interupted: boolean;
      complete: boolean;
      success: boolean;
    }[];
    // exitCompleteEvents: {owner: {id: string}; planet: {id: string}}[];
    planets: {owner: {id: string}; id: string}[];
  };
  // const exited = data.exitCompleteEvents;
  const held = data.planets;
  const now = Date.now() / 1000;
  const exitingDone = data.planetExitEvents.filter(
    (v) => !v.interupted && !v.complete && now - parseInt(v.exitTime) > 3 * 24 * 3600
  );
  const exittedComplete = data.planetExitEvents.filter((v) => v.success);

  const exited = exittedComplete.concat(exitingDone);

  const winners: {[id: string]: number} = {};
  const planetsCounted: {[id: string]: boolean} = {};
  for (const planetExited of exited) {
    if (!planetsCounted[planetExited.planet.id]) {
      winners[planetExited.owner.id] = winners[planetExited.owner.id] || 0;
      winners[planetExited.owner.id] += 100;
      planetsCounted[planetExited.planet.id] = true;
    }
  }

  for (const planetHeld of held) {
    // if (!planetsCounted[planetHeld.id]) {
    //   winners[planetHeld.owner.id] = winners[planetHeld.owner.id] || 0;
    //   winners[planetHeld.owner.id] += 100;
    //   planetsCounted[planetHeld.id] = true;
    // }
  }

  console.log({
    // winners,
    // planetsCounted,
    exited: JSON.stringify(
      exited.map((v) => {
        return {owner: v.owner.id, x: v.planet.x, y: v.planet.y};
      })
    ),

    // held,
  });

  console.log(winners);

  for (const loc of planets) {
    if (!planetsCounted[loc]) {
      console.log(`not counted: ${locationToXY(loc)}`);
    }
  }
}

main();
