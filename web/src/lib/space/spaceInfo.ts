import {contractsInfos} from '$lib/blockchain/contractsInfos';
import {camera, Camera, CameraState} from '$lib/map/camera';
import {PlanetInfo, SpaceInfo} from 'conquest-eth-common';

import {Writable, writable} from 'svelte/store';

export class SpaceInfoStore {
  private spaceInfo: SpaceInfo;
  private camera: Camera;
  public readonly planetsOnFocus: PlanetInfo[] = [];
  private lastFocus: {x0: number; y0: number; x1: number; y1: number} = {x0: 0, y0: 0, x1: 0, y1: 0};
  private store: Writable<PlanetInfo[]>;

  constructor(spaceInfo: SpaceInfo, camera: Camera) {
    this.camera = camera;
    this.spaceInfo = spaceInfo;
    this.store = writable(this.planetsOnFocus, this.start.bind(this));
  }

  start(): () => void {
    return this.camera.subscribe(this.onCameraUpdated.bind(this));
  }

  onCameraUpdated(view?: CameraState): void {
    if (!view) {
      return;
    }
    // console.log({zoom: view.zoom});
    const locationX = Math.floor(view.x / 4);
    const locationY = Math.floor(view.y / 4);
    const halfWidth = Math.ceil(view.width / 4 / 2);
    const halfHeight = Math.ceil(view.height / 4 / 2);
    this.focus(locationX - halfWidth, locationY - halfHeight, locationX + halfWidth, locationY + halfHeight);
  }

  subscribe(run: (value: PlanetInfo[]) => void, invalidate?: (value?: PlanetInfo[]) => void): () => void {
    return this.store.subscribe(run, invalidate);
  }

  focus(x0: number, y0: number, x1: number, y1: number): PlanetInfo[] {
    // console.log({x0, x1, y0, y1});
    if (this.lastFocus.x0 !== x0 || this.lastFocus.x1 !== x1 || this.lastFocus.y0 !== y0 || this.lastFocus.y1 !== y1) {
      this.planetsOnFocus.length = 0;
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          const planet = this.spaceInfo.getPlanetInfo(x, y);
          if (planet) {
            this.planetsOnFocus.push(planet);
          }
        }
      }
      this.lastFocus.x0 = x0;
      this.lastFocus.x1 = x1;
      this.lastFocus.y0 = y0;
      this.lastFocus.y1 = y1;
      this.store.set(this.planetsOnFocus);
    }

    return this.planetsOnFocus;
  }
}

export const spaceInfo = new SpaceInfoStore(new SpaceInfo(contractsInfos.contracts.OuterSpace.linkedData), camera);
