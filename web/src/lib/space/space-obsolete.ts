import {contractsInfos} from '$lib/blockchain/contractsInfos';
import {camera, Camera, CameraState} from '$lib/map/camera';
import {Planet, PlanetContractState, PlanetInfo, SpaceInfo} from 'conquest-eth-common';
import {Writable, writable} from 'svelte/store';

export type PlanetWithContractState = PlanetInfo & {
  state?: PlanetContractState;
};

type SpaceState = {
  planetsOnFocus: PlanetWithContractState[];
  // ownFleets: Fleet[];
};

export class SpaceStore {
  private spaceInfo: SpaceInfo;
  private camera: Camera;
  private state: SpaceState;
  private lastFocus: {x0: number; y0: number; x1: number; y1: number} = {x0: 0, y0: 0, x1: 0, y1: 0};
  private store: Writable<SpaceState>;

  constructor(spaceInfo: SpaceInfo, camera: Camera) {
    this.camera = camera;
    this.spaceInfo = spaceInfo;
    this.state = {
      planetsOnFocus: [],
    };
    this.store = writable(this.state, this.start.bind(this));
  }

  start(): () => void {
    return this.camera.subscribe(this.onCameraUpdated.bind(this));
  }

  private onCameraUpdated(view?: CameraState): void {
    if (!view) {
      return;
    }
    this.updateFocus(view);
  }

  subscribe(run: (value: SpaceState) => void, invalidate?: (value?: SpaceState) => void): () => void {
    return this.store.subscribe(run, invalidate);
  }

  private updateFocus(view?: CameraState): void {
    const x0 = Math.floor((view.x - view.width / 2) / 4);
    const y0 = Math.floor((view.y - view.height / 2) / 4);
    const x1 = Math.ceil((view.x + view.width / 2) / 4);
    const y1 = Math.ceil((view.y + view.height / 2) / 4);
    this.smart_focus(x0, y0, x1, y1);
  }

  private smart_focus(x0: number, y0: number, x1: number, y1: number): void {
    // console.log({x0, x1, y0, y1});
    let numPlanetsLeft = this.state.planetsOnFocus.length;
    if (this.lastFocus.x0 !== x0 || this.lastFocus.x1 !== x1 || this.lastFocus.y0 !== y0 || this.lastFocus.y1 !== y1) {
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          if (x < this.lastFocus.x0 || x > this.lastFocus.x1 || y < this.lastFocus.y0 || y > this.lastFocus.y1) {
            const planet = this.spaceInfo.getPlanetInfo(x, y) as PlanetWithContractState;
            if (planet) {
              this.state.planetsOnFocus.push(planet);
            }
          }
        }
      }
      this.lastFocus.x0 = x0;
      this.lastFocus.x1 = x1;
      this.lastFocus.y0 = y0;
      this.lastFocus.y1 = y1;
      // this.store.set(this.planetsOnFocus);
      for (let i = 0; i < numPlanetsLeft; i++) {
        const px = this.state.planetsOnFocus[i].location.x;
        const py = this.state.planetsOnFocus[i].location.y;
        if (px < x0 || px > x1 || py < y0 || py > y1) {
          this.state.planetsOnFocus.splice(i, 1);
          i--;
          numPlanetsLeft--;
        }
      }
      this.state.planetsOnFocus.sort((a, b) => a.location.y - b.location.y);
      this.store.set(this.state);
    }
  }
}

export const space = new SpaceStore(new SpaceInfo(contractsInfos.contracts.OuterSpace.linkedData), camera);
