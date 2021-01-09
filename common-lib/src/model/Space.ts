import {Planet, PlanetContractState} from '../types';
import { SpaceInfo } from './SpaceInfo';
import {xyToLocation, locationToXY} from '../util/location';

export type PlanetData = PlanetContractState & {id: string};

export type TimeKeeper = {
  setTimeout: (fn: () => void, sec: number) => number;
  clearTimeout: (t: number) => void;
  getTime: () => number;
}

export type PlanetFetch = (ids: string[]) => Promise<{discovered: {minX: number; minY: number; maxX: number; maxY: number}, planetStates: PlanetData[]}>

type PlanetRecord = {
  contractState?: PlanetContractState; // TODO optional ?
  planet: Planet;
}

export class Space {

  private planetRecords: Record<string, PlanetRecord | undefined> = {};
  private planetIdsToUpdate: string[] = [];
  // private extraLocations: string[] = [];

  private focusTimeout: number | undefined;
  private fetchUpdateTimeout: number | undefined;
  private fetchInProgress = false;
  private fetchQueued = false;
  private x0 = 0;
  private y0 = 0;
  private x1 = 0;
  private y1 = 0;

  public discovered: {x1: number; y1: number; x2: number; y2: number} = {x1:-1, y1:-1, x2:1, y2:1};

  private planetListeners: Record<string, number[] | undefined> = {};
  private listenerIndex = 0;
  private listeners: Record<number, (planet: Planet) => void> = {};

  constructor(public spaceInfo: SpaceInfo, private fetch: PlanetFetch, private timeKeeper: TimeKeeper) {
    this._fetchUpdate();
    this._timeBasedUpdate();
  }

  // THIS have the whole planet postiion synchronously
  // planetAt(x: number, y: number): Planet | undefined {
  //   const location = xyToLocation(x, y); // TODO speed up ?
  //   const planetInfo = this.spaceInfo.getPlanetInfo(x, y);
  //   if (planetInfo) {
  //     const planetRecord = this.planetRecords[location];
  //     if (planetRecord) {
  //       return planetRecord.planet;
  //     } else {
  //       return {
  //         ...planetInfo,
  //         state: undefined,
  //         loaded: false
  //       };
  //     }
  //   }
  //   return undefined;
  // }

  planetAt(x: number, y: number): Planet | undefined {
    const location = xyToLocation(x, y); // TODO speed up ?
    const planetRecord = this.planetRecords[location];
    if (planetRecord) {
      return planetRecord.planet;
    }
    return undefined;
  }

  ensurePlanetAt(x: number, y: number): Planet {
    const location = xyToLocation(x, y); // TODO speed up ?
    const planetRecord = this.planetRecords[location];
    // TODO add to focus
    if (planetRecord) {
      return planetRecord.planet;
    }
    const planetInfo = this.spaceInfo.getPlanetInfo(x, y);
    if (!planetInfo) {
      throw new Error(`no planet info for a fetched planet `)
    }
    // TODO fetch contract state and add focus
    return {
        ...planetInfo,
        state: undefined,
        loaded: false
    };
  }

  onPlannetUpdates(location: string, func: (planet: Planet) => void) : number {
    this.listenerIndex++;
    this.listeners[this.listenerIndex] = func;
    let currentListeners = this.planetListeners[location];
    if (!currentListeners) {
      currentListeners = [];
    }
    currentListeners.push(this.listenerIndex);
    this.planetListeners[location] = currentListeners;
    return this.listenerIndex;
  }

  switchOffPlanetUpdates(listenerIndex: number): void {
    delete this.listeners[listenerIndex];
  }


  focus(locationX0: number, locationY0: number, locationX1: number, locationY1: number): void {
    this._syncSetupRecords(locationX0, locationY0, locationX1, locationY1);
    if (this.focusTimeout) {
      this.timeKeeper.clearTimeout(this.focusTimeout);
    }
    this.focusTimeout = this.timeKeeper.setTimeout(() => this._focus(locationX0, locationY0, locationX1, locationY1), 1);
  }

  private async _focus(locationX0: number, locationY0: number, locationX1: number, locationY1: number): Promise<void> {
    this.focusTimeout = undefined;
    console.log("FOCUS", {locationX0, locationY0, locationX1, locationY1})
    const width = locationX1 - locationX0;
    const height = locationY1 - locationY0;
    this.x0 = Math.floor(locationX0 - width / 2);
    this.x1 = Math.ceil(locationX1 + width / 2);
    this.y0 = Math.floor(locationY0 - height / 2);
    this.y1 = Math.ceil(locationY1 + height / 2);
    // this._setupRecords(this.x0, this.y0, this.x1, this.y1);
    if (this.fetchUpdateTimeout) {
      this.timeKeeper.clearTimeout(this.fetchUpdateTimeout);
      this._fetchUpdate(); // TODO check reconsiliation if already being processed
    } else if (!this.fetchInProgress) {
      this._fetchUpdate(); // TODO check reconsiliation if already being processed
    } else {
      this.fetchQueued = true;
    }
  }

  private _setPlanet(planetId: string, planetRecord: PlanetRecord) {
    this.planetRecords[planetId] = planetRecord;
    this._updatePlanetRecord(planetId, this.timeKeeper.getTime());
  }

  private _callListeners(planetId: string, planet: Planet) {
    const listeners = this.planetListeners[planetId];
    if (listeners) {
      const num = listeners.length;
      for (let i = 0; i < num; i++) {
        const listenerIndex = listeners[i];
        const listener = this.listeners[listenerIndex];
        if (listener) {
          listener(planet);
        } else {
          listeners.splice(i,1);
          // i--; // TODO check ?
          if (listeners.length === 0) {
            delete this.planetListeners[planetId];
          }
        }
      }
    }
  }

  skip(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.timeKeeper.setTimeout(resolve, 1);
    })
  }

  private _syncSetupRecords(x0: number, y0: number, x1: number, y1: number, extraLocations: string[] = []): string[] {
    const locations = this.spaceInfo.syncFromRect(x0, y0, x1, y1);
    for (const extraLocation of extraLocations) {
      if (locations.indexOf(extraLocation) === -1) {
        locations.push(extraLocation);
      }
    }
    for (const location of locations) {
      this._setupRecord(location);
    }
    return locations;
  }


  private _setupRecord(location: string) {
    const planetRecord = this.planetRecords[location];
    if (!planetRecord) {
      const xy = locationToXY(location); // TODO speed up
      const planetInfo = this.spaceInfo.getPlanetInfo(xy.x, xy.y); // TODO getPlanetInfo should take a location ?
      if (!planetInfo) {
        throw new Error(`no planet infor for a fetched planet `)
      }
      this._setPlanet(location, {
        planet: {
          ...planetInfo,
          state: undefined,
          loaded: false
        }
      })
    }
  }

  // private async _setupRecords(x0: number, y0: number, x1: number, y1: number, extraLocations: string[] = []): Promise<string[]> {
  //   const locations = [];
  //   let i = 0;
  //   for (const location of this.spaceInfo.yieldPlanetIdsFromRect(x0, y0, x1, y1)) {
  //     i++;
  //     locations.push(location);
  //     this._setupRecord(location);
  //     if (i % 3 == 0) {
  //       await this.skip(); // TODO use worker instead
  //     }
  //   }
  //   for (const extraLocation of extraLocations) {
  //     if (locations.indexOf(extraLocation) === -1) {
  //       locations.push(extraLocation);
  //       this._setupRecord(extraLocation);
  //     }
  //   }
  //   return locations;
  // }

  private async _setupRecords(x0: number, y0: number, x1: number, y1: number, extraLocations: string[] = []): Promise<string[]> {
    // console.log("SETUP RECORDS...", {x0,y0,x1,y1});
    // COMPUTE PLANET INFOS
    const locations = await this.spaceInfo.asyncPlanetIdsFromRect(x0, y0, x1, y1);
    for (const extraLocation of extraLocations) {
      if (locations.indexOf(extraLocation) === -1) {
        locations.push(extraLocation);
      }
    }

    // SETUP PLANET RECORD WITH EMPTY CONTRACT STATE
    for (const location of locations) {
      this._setupRecord(location);
    }
    // console.log("..DONE RECORDS", {x0,y0,x1,y1});
    return locations;
  }

  private async _fetchUpdate(): Promise<void> {
    this.fetchUpdateTimeout = undefined;
    this.fetchInProgress = true;
    try {
      const extraLocations = Object.keys(this.planetListeners);
      const locations = this._syncSetupRecords(this.x0, this.y0, this.x1, this.y1, extraLocations); //await this._setupRecords(this.x0, this.y0, this.x1, this.y1, extraLocations);
      // TODO batch grouping :
      // console.log("FETCHING....");
      const result = await this.fetch(locations);
      const planetDatas = result.planetStates;
      const discovered = result.discovered;
      console.log({result});
      this.discovered.x1 = - discovered.minX;
      this.discovered.y1 = - discovered.minY;
      this.discovered.x2 = discovered.maxX;
      this.discovered.y2 = discovered.maxY;

      // console.log("...DONE");
      this.planetIdsToUpdate.splice(0, this.planetIdsToUpdate.length);
      // console.log({planetDatas});
      for (let i = 0; i < planetDatas.length; i++) {
        const location = locations[i];
        const planetDatum = planetDatas[i];
        if (!planetDatum.owner) {
          console.error(`missing owner for ${location}`)
        }
        // const queryTime = Math.floor(Date.now() / 1000); // TODO use latest block number for queries
        const contractState = {
          owner: planetDatum.owner,
          exitTime: planetDatum.exitTime,
          numSpaceships: planetDatum.numSpaceships,
          lastUpdated: planetDatum.lastUpdated,
          active: planetDatum.active,
          // queryTime // TODO ?
        };
        const planetRecord = this.planetRecords[location];
        if (!planetRecord) {
          throw new Error(`no planet record for ${location}`)
        }
        planetRecord.contractState = contractState;
        this._setPlanet(location, planetRecord);
        this.planetIdsToUpdate.push(location);
      }
    } catch(e) {
      console.error(e);
    }

    this.fetchInProgress = false;
    let delay = 5; // config delay;
    if (this.fetchQueued) {
      this.fetchQueued = false;
      delay = 0.01;
    }
    // console.log(`NEW UPDATE in ${delay} s`);
    this.fetchUpdateTimeout = this.timeKeeper.setTimeout(this._fetchUpdate.bind(this), delay);
  }

  private _timeBasedUpdate(): void {
    // console.log({planetIdsToUpdate: this.planetIdsToUpdate});
    try {
      for (const planetId of this.planetIdsToUpdate) {
        this._updatePlanetRecord(planetId, this.timeKeeper.getTime());
      }
    } catch( e) {
      console.error(e);
    }
    this.timeKeeper.setTimeout(this._timeBasedUpdate.bind(this), 1);
  }

  private _updatePlanetRecord(planetId: string, time: number): void {
    const planetRecord = this.planetRecords[planetId];
    if (!planetRecord) {
      throw new Error(`no planet record for ${planetId}`)
    }

    const contractState = planetRecord.contractState;
    if (!contractState) {
      // SKIP UNTIL THERE IS A CONTRACT STATE TO COMPUTE PREDICTED VALUES FROM TIME
      return;
    }
    let owner = contractState.owner;
    let active = contractState.active;
    let numSpaceships = contractState.numSpaceships;
    let exiting = !!contractState.exitTime;
    let exitTimeLeft = this.spaceInfo.exitDuration - (time - contractState.exitTime);
    const natives = contractState.lastUpdated == 0;
    if (contractState.exitTime > 0 && time > contractState.exitTime + this.spaceInfo.exitDuration) {
      // exited
      numSpaceships = 0;
      owner = "0x0000000000000000000000000000000000000000";
      active = false;
      exiting = false;
      exitTimeLeft = 0;
    } else if (contractState.active) {
      numSpaceships = contractState.numSpaceships + (Math.floor(((time - contractState.lastUpdated) * planetRecord.planet.stats.production) / (60 * 60)));
    } else if (natives) {
      numSpaceships = planetRecord.planet.stats.natives; // TODO show num Natives
    }

    if (!planetRecord.planet.state) {
      planetRecord.planet.loaded = true;
      planetRecord.planet.state = {
        owner, active, numSpaceships, exiting, exitTimeLeft, natives
      };
    } else {
      planetRecord.planet.state.owner = owner;
      planetRecord.planet.state.active = active;
      planetRecord.planet.state.numSpaceships = numSpaceships;
      planetRecord.planet.state.exiting = exiting;
      planetRecord.planet.state.exitTimeLeft = exitTimeLeft;
      planetRecord.planet.state.natives = natives;
    }

    this._callListeners(planetId, planetRecord.planet);
  }

}

