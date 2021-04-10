import type {PlanetInfo} from '../types';
import {keccak256} from '@ethersproject/solidity';
import {
  LocationPointer,
  nextInSpiral,
  areasArroundLocation,
  StrictLocationPointer,
  xyToLocation,
  topleftLocationFromArea,
} from '../util/location';
import {normal16, normal8, value8Mod} from '../util/extraction';
import {uniqueName} from '$lib/random/uniqueName'; // TODO in common

function skip(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 1);
  });
}

export class SpaceInfo {
  private genesis: string;
  private cache: {[id: string]: PlanetInfo | null} = {};
  private planetIdsInArea: {[zoneId: string]: string[]} = {};

  public resolveWindow: number;
  public timePerDistance: number;
  public exitDuration: number;

  constructor(config: {genesisHash: string; resolveWindow: number; timePerDistance: number; exitDuration: number}) {
    this.resolveWindow = config.resolveWindow;
    this.timePerDistance = Math.floor(config.timePerDistance / 4); // Same as in OuterSpace.sol: the coordinates space is 4 times bigger
    this.exitDuration = config.exitDuration;
    this.genesis = config.genesisHash;
  }

  computeArea(areaId: string): void {
    if (this.planetIdsInArea[areaId]) {
      return;
    }
    const {x: tlx, y: tly} = topleftLocationFromArea(areaId);
    const idList = [];
    // TODO x,y = zone top left corner
    for (let x = tlx; x < tlx + 24; x++) {
      for (let y = tly; y < tly + 24; y++) {
        const planet = this.getPlanetInfo(x, y);
        if (planet) {
          idList.push(xyToLocation(x, y));
        }
      }
    }
    this.planetIdsInArea[areaId] = idList;
  }

  planetIdsFromArea(area: string): string[] {
    this.computeArea(area);
    return this.planetIdsInArea[area];
  }

  planetIdsArroundLocation(locationX: number, locationY: number): string[] {
    const areas = areasArroundLocation(locationX, locationY);
    const ids = [];
    for (const area of areas) {
      ids.push(...this.planetIdsFromArea(area));
    }
    return ids;
  }

  *yieldPlanetIdsFromArea(areaId: string): Generator<string, void> {
    const {x: tlx, y: tly} = topleftLocationFromArea(areaId);

    // TODO x,y = zone top left corner
    for (let x = tlx; x < tlx + 24; x++) {
      for (let y = tly; y < tly + 24; y++) {
        const planet = this.getPlanetInfo(x, y);
        if (planet) {
          yield xyToLocation(x, y);
        }
      }
    }
  }

  async asyncComputeArea(areaId: string): Promise<void> {
    if (this.planetIdsInArea[areaId]) {
      return;
    }
    const idList = [];
    let i = 0;
    for (const id of this.yieldPlanetIdsFromArea(areaId)) {
      idList.push(id);
      i++;
      if (i % 3 == 0) {
        await skip(); // TODO use worker instead
      }
    }

    this.planetIdsInArea[areaId] = idList;
  }

  async asyncPlanetIdsFromArea(area: string): Promise<string[]> {
    if (!this.planetIdsInArea[area]) {
      await this.asyncComputeArea(area);
    }
    return this.planetIdsInArea[area];
  }

  syncFromRect(x0: number, y0: number, x1: number, y1: number): string[] {
    const ids = [];
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const planet = this.getPlanetInfo(x, y);
        if (planet) {
          ids.push(xyToLocation(x, y));
        }
      }
    }
    return ids;
  }

  *yieldPlanetIdsFromRect(x0: number, y0: number, x1: number, y1: number): Generator<string, void> {
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const planet = this.getPlanetInfo(x, y);
        if (planet) {
          yield xyToLocation(x, y);
        }
      }
    }
  }

  async asyncPlanetIdsFromRect(x0: number, y0: number, x1: number, y1: number): Promise<string[]> {
    const idList = [];
    let i = 0;
    for (const id of this.yieldPlanetIdsFromRect(x0, y0, x1, y1)) {
      idList.push(id);
      i++;
      if (i % 6 == 0) {
        await skip(); // TODO use worker instead
      }
    }
    return idList;
  }

  getPlanetInfo(x: number, y: number): PlanetInfo | undefined {
    const id = '' + x + ',' + y;
    const inCache = this.cache[id];
    if (typeof inCache !== 'undefined') {
      if (inCache === null) {
        return undefined;
      }
      return inCache;
    }

    const location = xyToLocation(x, y);

    const data = keccak256(['bytes32', 'uint256'], [this.genesis, location]);

    const hasPlanet = value8Mod(data, 52, 16) == 1;
    if (!hasPlanet) {
      this.cache[id] = null;
      return undefined;
    }

    const subX = 1 - value8Mod(data, 0, 3);
    const subY = 1 - value8Mod(data, 2, 3);

    const stakeRange = [4, 5, 5, 10, 10, 15, 15, 20, 20, 30, 30, 40, 40, 80, 80, 100];
    const productionIndex = normal8(data, 12);
    const offset = normal16(data, 4, '0x0000000100010002000200030003000400040005000500060006000700070008');
    let stakeIndex = productionIndex + offset;
    if (stakeIndex < 4) {
      stakeIndex = 0;
    } else if (stakeIndex > 19) {
      stakeIndex = 15;
    } else {
      stakeIndex -= 4;
    }
    const stake = stakeRange[stakeIndex];

    const production = normal16(data, 12, '0x0708083409600a8c0bb80ce40e100e100e100e101068151819c81e7823282ee0');
    const attackRoll = normal8(data, 20);
    const attack = 4000 + attackRoll * 400;
    const defenseRoll = normal8(data, 28);
    const defense = 4000 + defenseRoll * 400;
    const speedRoll = normal8(data, 36);
    const speed = 5005 + speedRoll * 333;
    const natives = 15000 + normal8(data, 44) * 3000;

    // const type = value8Mod(data, 60, 23);
    const attackGrade = attackRoll < 6 ? 0 : attackRoll < 10 ? 1 : 2;
    const defenseGrade = defenseRoll < 6 ? 0 : defenseRoll < 10 ? 1 : 2;
    const speedGrade = speedRoll < 6 ? 0 : speedRoll < 10 ? 1 : 2;

    const type = attackGrade * 9 + defenseGrade * 3 + speedGrade;

    const name = uniqueName(2, location);

    const planetObj = {
      location: {
        id: location,
        x,
        y,
        globalX: x * 4 + subX,
        globalY: y * 4 + subY,
      },
      type,
      stats: {
        name,
        stake,
        production,
        attack,
        defense,
        speed,
        natives,
        subX,
        subY,
      },
    };
    this.cache[id] = planetObj;
    return planetObj;
  }

  findNextPlanet(
    pointer?: LocationPointer<PlanetInfo> | StrictLocationPointer<PlanetInfo>
  ): StrictLocationPointer<PlanetInfo> {
    do {
      pointer = nextInSpiral(pointer);
      pointer.data = this.getPlanetInfo(pointer.x, pointer.y);
    } while (!pointer.data);
    return pointer as StrictLocationPointer<PlanetInfo>;
  }
}