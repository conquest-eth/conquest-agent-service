/* eslint-disable @typescript-eslint/no-explicit-any */ // TODO remove
import {increaseTime, waitFor, objMap} from '../test-utils';
import {ethers, getUnnamedAccounts, deployments} from 'hardhat';
import {BigNumber} from '@ethersproject/bignumber';
import {Wallet} from '@ethersproject/wallet';
import {keccak256} from '@ethersproject/solidity';
import {OuterSpace, Planet} from 'planet-wars-common';
import {ContractReceipt} from 'ethers';

type AnyContract = any; // TODO ?
type User = {address: string; [contractName: string]: AnyContract};

async function createPlayerAsContracts(
  player: string,
  contractNames: string[]
): Promise<User> {
  const obj: User = {address: player};
  for (const contractName of contractNames) {
    obj[contractName] = await ethers.getContract(contractName, player);
  }
  return obj;
}

export async function setupOuterSpace(): Promise<{
  getTime: () => number;
  increaseTime(t: number): Promise<void>;
  outerSpaceContract: AnyContract;
  outerSpace: OuterSpace;
  players: User[];
}> {
  const players = await getUnnamedAccounts();
  await deployments.fixture();
  const playersAsContracts = [];
  for (const player of players) {
    const playerObj = await createPlayerAsContracts(player, ['OuterSpace']);
    playersAsContracts.push(playerObj);
  }
  const OuterSpaceDeployment = await deployments.get('OuterSpace');
  let deltaTime = 0;
  return {
    getTime() {
      return Math.floor(Date.now() / 1000) + deltaTime;
    },
    async increaseTime(t) {
      await increaseTime(t);
      deltaTime += t;
    },
    outerSpaceContract: (await ethers.getContract('OuterSpace')) as AnyContract,
    outerSpace: new OuterSpace(OuterSpaceDeployment.linkedData),
    players: playersAsContracts,
  };
}

export async function sendInSecret(
  player: User,
  {from, quantity, to}: {from: Planet; quantity: number; to: Planet}
): Promise<{
  timeRequired: number;
  distance: number;
  fleetId: string;
  to: string;
  secret: string;
} | null> {
  const secret = Wallet.createRandom().privateKey;
  const toHash = keccak256(['bytes32', 'uint256'], [secret, to.location.id]);
  const receipt = await waitFor<ContractReceipt>(
    player.OuterSpace.send(from.location.id, quantity, toHash)
  );
  const event = receipt.events?.find((e: any) => e.event === 'FleetSent'); // TODO any
  if (!event || !event.args || !event.args[2]) {
    return null;
  }
  const distanceSquared =
    Math.pow(to.location.globalX - from.location.globalX, 2) +
    Math.pow(to.location.globalY - from.location.globalY, 2);
  const distance = Math.floor(Math.sqrt(distanceSquared));
  const timeRequired = BigNumber.from(distance)
    .mul(1 * 3600 * 10000)
    .div(from.stats.speed)
    .toNumber();
  return {
    timeRequired,
    distance,
    fleetId: event.args[2],
    to: to.location.id,
    secret,
  };
}

// TODO get benefit from typescript
export function convertPlanetCallData(
  o: string | number | BigNumber
): string | number {
  if (typeof o === 'number') {
    return o;
  }
  if (typeof o === 'string') {
    return o;
  }
  if (o._isBigNumber && o.lte(2147483647) && o.gte(-2147483647)) {
    return o.toNumber();
  }
  return o.toString();
}

type PlanetState = Planet & {
  state: any; // TODO
  getNumSpaceships: (time: number) => number;
};

export async function fetchPlanetState(
  contract: AnyContract,
  planet: Planet
): Promise<PlanetState> {
  const planetData = await contract.callStatic.getPlanet(planet.location.id);
  const statsFromContract = objMap(planet.stats, convertPlanetCallData);
  // check as validty assetion:
  for (const key of Object.keys(statsFromContract)) {
    const value = statsFromContract[key];
    if (value !== (planet as any).stats[key]) {
      throw new Error(
        `${key}: ${
          (planet as any).stats[key]
        } not equal to contract stats : ${value} `
      );
    }
  }
  const state = objMap(planetData.state, convertPlanetCallData);
  return {
    ...planet,
    state,
    getNumSpaceships(time: number) {
      return (
        state.numSpaceships +
        Math.floor(((time - state.lastUpdated) * state.productionRate) / 3600)
      );
    },
  };
}
