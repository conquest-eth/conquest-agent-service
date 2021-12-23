import {HardhatRuntimeEnvironment} from 'hardhat/types';
import hre from 'hardhat';
import 'dotenv/config';
import {BigNumber} from 'ethers';
import {PlayerData, BlockData, PlayerStats} from './types';
import fs from 'fs';
import {SpaceInfo} from 'conquest-eth-common';

const DECIMALS_18 = BigNumber.from('1000000000000000000');

async function func(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments} = hre;
  const stats: BlockData<PlayerData>[] = JSON.parse(
    await deployments.readDotFile('.stats.json')
  );

  const OuterSpace = await deployments.get('OuterSpace');
  const spaceInfo = new SpaceInfo(OuterSpace.linkedData);

  const allPayersDict: {[id: string]: boolean} = {};
  const playerIds: string[] = [];

  // transform
  const playerStats = stats.map((s) => {
    return {
      blockNumber: s.blockNumber,
      players: s.players.map((p) => {
        if (!allPayersDict[p.id]) {
          allPayersDict[p.id] = true;
          playerIds.push(p.id);
        }

        const currentStake = BigNumber.from(p.currentStake);
        const playTokenToWithdraw = BigNumber.from(p.playTokenToWithdraw);
        const playTokenBalance = BigNumber.from(p.playTokenBalance);
        const playTokenGiven = BigNumber.from(p.playTokenGiven);
        const total = currentStake
          .add(playTokenToWithdraw)
          .add(playTokenBalance);

        const totalStaked = BigNumber.from(p.totalStaked);
        const totalCollected = BigNumber.from(p.totalCollected);

        return {
          id: p.id,
          total: total.div(DECIMALS_18).toNumber(),
          score: Math.floor(
            total
              .sub(playTokenGiven)
              .mul(1000000)
              .div(playTokenGiven)
              .add(1000000)
              .toNumber() / 100
          ),

          planets: p.planets,
          // planets: p.planets.map(p => {
          //   numSpaceships: spaceInfo
          // })
          totalStaked: totalStaked.div(DECIMALS_18).toNumber(),
          currentStake: currentStake.div(DECIMALS_18).toNumber(),
          totalCollected: totalCollected.div(DECIMALS_18).toNumber(),
          playTokenToWithdraw: playTokenToWithdraw.div(DECIMALS_18).toNumber(),
          playTokenBalance: playTokenBalance.div(DECIMALS_18).toNumber(),
          playTokenGiven: playTokenGiven.div(DECIMALS_18).toNumber(),
          introducer: p.introducer,
          stake_gas: BigNumber.from(p.stake_gas).toNumber(),
          stake_num: BigNumber.from(p.stake_num).toNumber(),
          sending_gas: BigNumber.from(p.sending_gas).toNumber(),
          sending_num: BigNumber.from(p.sending_num).toNumber(),
          resolving_gas: BigNumber.from(p.resolving_gas).toNumber(),
          resolving_num: BigNumber.from(p.resolving_num).toNumber(),
          exit_attempt_gas: BigNumber.from(p.exit_attempt_gas).toNumber(),
          exit_attempt_num: BigNumber.from(p.exit_attempt_num).toNumber(),
          spaceships_sent: BigNumber.from(p.spaceships_sent).toNumber(),
          spaceships_arrived: BigNumber.from(p.spaceships_arrived).toNumber(),
          spaceships_self_transfered: BigNumber.from(
            p.spaceships_self_transfered
          ).toNumber(),
          gift_spaceships_sent: BigNumber.from(
            p.gift_spaceships_sent
          ).toNumber(),
          gift_spaceships_receieved: BigNumber.from(
            p.gift_spaceships_receieved
          ).toNumber(),
          attack_own_spaceships_destroyed: BigNumber.from(
            p.attack_own_spaceships_destroyed
          ).toNumber(),
          attack_enemy_spaceships_destroyed: BigNumber.from(
            p.attack_enemy_spaceships_destroyed
          ).toNumber(),
          defense_own_spaceships_destroyed: BigNumber.from(
            p.defense_own_spaceships_destroyed
          ).toNumber(),
          defense_enemy_spaceships_destroyed: BigNumber.from(
            p.defense_enemy_spaceships_destroyed
          ).toNumber(),
          planets_conquered: BigNumber.from(p.planets_conquered).toNumber(),
          planets_lost: BigNumber.from(p.planets_lost).toNumber(),
        };
      }),
    };
  });

  // get the best player at the end
  const lastSet = playerStats[playerStats.length - 1].players;
  const lastSortedSet: PlayerStats[] = lastSet.sort(
    (a, b) => b.score - a.score
  );
  const dict: {[id: string]: PlayerStats} = {};
  for (let i = 0; i < lastSortedSet.length; i++) {
    const player = lastSortedSet[i];
    dict[player.id] = player;
  }

  // sort every set based on that order
  const sortedPlayerStats = playerStats.map((s) => {
    return {
      blockNumber: s.blockNumber,
      players: s.players.sort((a, b) => {
        return dict[b.id].score - dict[a.id].score;
      }),
    };
  });

  // fill all players in
  let finalStats = sortedPlayerStats.map((s) => {
    const list = [...s.players];
    for (const pId of playerIds) {
      if (!list.find((v) => v.id === pId)) {
        list.push({
          id: pId,
          score: 0,
          total: 0,
          planets: [],
          totalStaked: 0,
          currentStake: 0,
          totalCollected: 0,
          playTokenBalance: 0,
          playTokenGiven: 0,
          playTokenToWithdraw: 0,
          introducer: {id: '0x0000000000000000000000000000000000000000'},
          stake_gas: 0,
          stake_num: 0,
          sending_gas: 0,
          sending_num: 0,
          resolving_gas: 0,
          resolving_num: 0,
          exit_attempt_gas: 0,
          exit_attempt_num: 0,
          spaceships_sent: 0,
          spaceships_arrived: 0,
          spaceships_self_transfered: 0,
          gift_spaceships_sent: 0,
          gift_spaceships_receieved: 0,
          attack_own_spaceships_destroyed: 0,
          attack_enemy_spaceships_destroyed: 0,
          defense_own_spaceships_destroyed: 0,
          defense_enemy_spaceships_destroyed: 0,
          planets_conquered: 0,
          planets_lost: 0,
        });
      }
    }
    return {
      blockNumber: s.blockNumber,
      players: list,
    };
  });

  // TODO for now use only 18 first
  finalStats = finalStats.filter((v) => v.blockNumber > 5979867);
  // .filter(v => v.blockNumber < 6000000)
  // .map((s) => {
  //   return {
  //     blockNumber: s.blockNumber,
  //     players: s.players.slice(0, 18),
  //   };
  // });

  await deployments.saveDotFile(
    '.player_stats.json',
    JSON.stringify(finalStats, null, 2)
  );

  generateDataForPlotly(finalStats, 'score');

  generateCSV(finalStats, 'score');
  generateCSV(finalStats, 'sending_num');
}

function generateDataForPlotly(stats: BlockData<PlayerStats>[], field: string) {
  const chart: {
    blockNumbers: number[];
    players: {name: string; values: number[]}[];
  } = {
    blockNumbers: [],
    players: [],
  };

  for (
    let blockNumberIndex = 0;
    blockNumberIndex < stats.length;
    blockNumberIndex++
  ) {
    const blockData = stats[blockNumberIndex];
    chart.blockNumbers.push(blockData.blockNumber);
    for (let i = 0; i < blockData.players.length; i++) {
      const player = blockData.players[i];
      let chartPlayer = chart.players[i];
      if (!chartPlayer) {
        chartPlayer = {name: player.id, values: []};
        chart.players.push(chartPlayer);
      }
      chartPlayer.values.push((player as any)[field]);
    }
  }

  fs.writeFileSync(`../web/src/lib/data/${field}.json`, JSON.stringify(chart));
}

function generateCSV(stats: BlockData<PlayerStats>[], field: string) {
  let csv = 'blockNumber,';
  const players = stats[stats.length - 1].players;
  for (let i = 0; i < players.length; i++) {
    csv = csv + `${players[i].id},`;
  }
  csv = csv.slice(0, csv.length - 1);

  for (const blockData of stats) {
    csv = csv + `\n${blockData.blockNumber},`;
    for (let i = 0; i < blockData.players.length; i++) {
      csv = csv + `${(blockData.players[i] as any)[field]},`;
    }
    csv = csv.slice(0, csv.length - 1);
  }

  fs.writeFileSync(`/home/wighawag/dev/python-test/${field}.csv`, csv);
}

async function main() {
  await func(hre);
}

if (require.main === module) {
  main();
}
