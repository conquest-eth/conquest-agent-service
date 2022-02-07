import 'dotenv/config';
import {TheGraph} from './utils/thegraph';
import {BigNumber} from '@ethersproject/bignumber';
import fs from 'fs';

const theGraph = new TheGraph(`https://api.thegraph.com/subgraphs/name/${process.env.SUBGRAPH_NAME}`);

// query($blockNumber: Int! $first: Int! $lastId: ID! $id: ID!) {
const queryString = `
query($first: Int! $lastId: ID!) {
  owners(first: $first block: {number:4830319} where: {
    totalStaked_gt: 0
    id_gt: $lastId
  }) {
    id
    currentStake
    playTokenToWithdraw
    playTokenBalance
    playTokenGiven
  }
}
`;

const DECIMALS_18 = BigNumber.from('1000000000000000000');

async function main() {
  const players: {
    id: string;
    currentStake: string;
    playTokenToWithdraw: string;
    playTokenBalance: string;
    playTokenGiven: string;
  }[] = await theGraph.query(queryString, {field: 'owners'});
  const winners = players
    .map((p) => {
      const currentStake = BigNumber.from(p.currentStake);
      const playTokenToWithdraw = BigNumber.from(p.playTokenToWithdraw);
      const playTokenBalance = BigNumber.from(p.playTokenBalance);
      const playTokenGiven = BigNumber.from(p.playTokenGiven);
      const total = currentStake.add(playTokenToWithdraw).add(playTokenBalance);
      return {
        id: p.id,
        total: total.div(DECIMALS_18).toNumber(),
        score: total.sub(playTokenGiven).mul(1000000).div(playTokenGiven).toNumber(),
        currentStake: currentStake.div(DECIMALS_18).toNumber(),
        playTokenToWithdraw: playTokenToWithdraw.div(DECIMALS_18).toNumber(),
        playTokenBalance: playTokenBalance.div(DECIMALS_18).toNumber(),
        playTokenGiven: playTokenGiven.div(DECIMALS_18).toNumber(),
      };
    })
    .sort((a, b) => b.score - a.score);

  const top18 = winners.slice(0, 18);
  console.log(top18);

  console.log(top18.map((v) => v.id));

  const winnersWithReward: {[id: string]: number} = {};
  const tokenDistribution = [500, 200, 100, 50, 25, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 5];
  for (let i = 0; i < top18.length; i++) {
    winnersWithReward[top18[i].id] = tokenDistribution[i];
  }
  console.log(winnersWithReward);

  let winnersArray: {
    address: string;
    signedMessage?: string;
    signature?: string;
    numTokens: number;
    numWCHI?: number;
  }[] = [];
  try {
    winnersArray = JSON.parse(fs.readFileSync('winners.json').toString());
  } catch (e) {}
  for (const winner of Object.keys(winnersWithReward)) {
    const found = winnersArray.findIndex((v) => v.address.toLowerCase() === winner);
    if (found !== -1) {
      winnersArray[found].numTokens = winnersWithReward[winner];
    } else {
      winnersArray.push({
        address: winner,
        numTokens: winnersWithReward[winner],
      });
    }
  }
  fs.writeFileSync('winners.json', JSON.stringify(winnersArray, null, 2));
}

main();
