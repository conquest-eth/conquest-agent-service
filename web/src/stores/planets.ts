import {BigNumber} from '@ethersproject/bignumber';
import {locationToXY} from 'planet-wars-common';
// import {derived, Readable} from 'svelte/store';
// import {QueryState, queryStore} from '../_graphql';
// import {transactions} from './wallet';
import {queryStore} from '../_graphql';

type AcquiredPlanet = {
  id: string;
  owner: string;
  lastOwnershipTime: BigNumber;
  numSpaceships: BigNumber;
  lastUpdated: BigNumber;
};
type QueryRawData = {acquiredPlanets: AcquiredPlanet[]};
type AcquiredPlanets = Record<string, AcquiredPlanet>;

const query = queryStore<AcquiredPlanets>(
  `
  query {
    acquiredPlanets {
      id
      owner
      lastOwnershipTime
      numSpaceships
      lastUpdated
    }
  }
`,
  {
    transform: (v: QueryRawData) => {
      const planets = {};
      for (const planet of v.acquiredPlanets) {
        const {x, y} = locationToXY(planet.id);
        planets[`${x},${y}`] = {
          id: planet.id,
          owner: planet.owner,
          lastOwnershipTime: BigNumber.from(planet.lastOwnershipTime),
          numSpaceships: BigNumber.from(planet.numSpaceships),
          lastUpdated: BigNumber.from(planet.lastUpdated),
        };
      }
      return planets;
    },
  }
);

export const planets = query;

// export const messages: Readable<QueryState<Messages>> & {
//   fetch: typeof query.fetch;
//   cancel: typeof query.cancel;
//   acknowledgeError: typeof query.acknowledgeError;
// } = derived([query, transactions], ([$query, $transactions]) => {
//   if (!$query.data) {
//     return $query;
//   } else {
//     let newData = $query.data.concat();
//     for (const tx of $transactions) {
//       if (!tx.finalized && tx.args) {
//         // based on args : so need to ensure args are available
//         if (tx.status !== 'failure') {
//           const foundIndex = newData.findIndex((v) => v.id.toLowerCase() === tx.from.toLowerCase());
//           if (foundIndex >= 0) {
//             newData[foundIndex].message = tx.args[0] as string;
//             newData[foundIndex].pending = tx.confirmations < 1;
//             newData[foundIndex].timestamp = Math.floor(Date.now() / 1000).toString();
//           } else {
//             newData.unshift({
//               id: tx.from.toLowerCase(),
//               message: tx.args[0] as string,
//               timestamp: Math.floor(Date.now() / 1000).toString(),
//               pending: tx.confirmations < 1,
//             });
//           }
//         }
//       }
//     }
//     newData = newData.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
//     return {
//       state: $query.state,
//       error: $query.error,
//       polling: $query.polling,
//       stale: $query.stale,
//       data: newData,
//     };
//   }
// }) as typeof query;
// messages.fetch = query.fetch.bind(query);
// messages.cancel = query.cancel.bind(query);
// messages.acknowledgeError = query.acknowledgeError.bind(query);
