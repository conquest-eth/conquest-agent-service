import {contractsInfos} from '$lib/blockchain/contractsInfos';
import {camera, Camera, CameraState} from '$lib/map/camera';
import {PlanetInfo, SpaceInfo} from 'conquest-eth-common';

import {Writable, writable} from 'svelte/store';

function skip(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 1);
  });
}

export class SpaceInfoStore {
  private spaceInfo: SpaceInfo;
  private camera: Camera;
  public readonly planetsOnFocus: PlanetInfo[] = [];
  private lastFocus: {x0: number; y0: number; x1: number; y1: number} = {x0: 0, y0: 0, x1: 0, y1: 0};
  private store: Writable<PlanetInfo[]>;

  private updateTimout: NodeJS.Timeout | undefined;

  constructor(spaceInfo: SpaceInfo, camera: Camera) {
    this.camera = camera;
    this.spaceInfo = spaceInfo;
    this.store = writable(this.planetsOnFocus, this.start.bind(this));
  }

  start(): () => void {
    return this.camera.subscribe(this.onCameraUpdated.bind(this));
  }

  delayedUpdate(view?: CameraState): void {
    this.updateTimout = undefined;
    this.updateFocus(view);
  }

  onCameraUpdated(view?: CameraState): void {
    if (!view) {
      return;
    }

    // if (this.updateTimout) {
    //   clearTimeout(this.updateTimout);
    // }
    // setTimeout(() => this.delayedUpdate(view), 200);
    this.updateFocus(view);
  }

  subscribe(run: (value: PlanetInfo[]) => void, invalidate?: (value?: PlanetInfo[]) => void): () => void {
    return this.store.subscribe(run, invalidate);
  }

  updateFocus(view?: CameraState): void {
    // console.log({zoom: view.zoom});
    // const locationX = Math.floor(view.x / 4);
    // const locationY = Math.floor(view.y / 4);
    // const halfWidth = Math.ceil(view.width / 4 / 2);
    // const halfHeight = Math.ceil(view.height / 4 / 2);
    // this.focus(locationX - halfWidth, locationY - halfHeight, locationX + halfWidth, locationY + halfHeight);

    const x0 = Math.floor((view.x - view.width / 2) / 4);
    const y0 = Math.floor((view.y - view.height / 2) / 4);
    const x1 = Math.ceil((view.x + view.width / 2) / 4);
    const y1 = Math.ceil((view.y + view.height / 2) / 4);
    // this.asyncFocus(x0, y0, x1, y1);
    this.smart_focus(x0, y0, x1, y1);
  }

  async asyncFocus(x0: number, y0: number, x1: number, y1: number): Promise<PlanetInfo[]> {
    if (this.lastFocus.x0 !== x0 || this.lastFocus.x1 !== x1 || this.lastFocus.y0 !== y0 || this.lastFocus.y1 !== y1) {
      this.lastFocus.x0 = x0;
      this.lastFocus.x1 = x1;
      this.lastFocus.y0 = y0;
      this.lastFocus.y1 = y1;

      this.planetsOnFocus.length = 0;
      let i = 0;
      for (const planet of this.spaceInfo.yieldPlanetsFromRect(x0, y0, x1, y1)) {
        this.planetsOnFocus.push(planet);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(planet as any).inCache) {
          i++;
        }
        if (i % 200 == 0) {
          this.store.set(this.planetsOnFocus);
          await skip(); // TODO use worker instead
        }
        if (
          this.lastFocus.x0 !== x0 ||
          this.lastFocus.x1 !== x1 ||
          this.lastFocus.y0 !== y0 ||
          this.lastFocus.y1 !== y1
        ) {
          return;
        }
      }
    }
    return this.planetsOnFocus;
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

  smart_focus(x0: number, y0: number, x1: number, y1: number): PlanetInfo[] {
    // console.log({x0, x1, y0, y1});
    let numPlanetsLeft = this.planetsOnFocus.length;
    if (this.lastFocus.x0 !== x0 || this.lastFocus.x1 !== x1 || this.lastFocus.y0 !== y0 || this.lastFocus.y1 !== y1) {
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          if (x < this.lastFocus.x0 || x > this.lastFocus.x1 || y < this.lastFocus.y0 || y > this.lastFocus.y1) {
            const planet = this.spaceInfo.getPlanetInfo(x, y);
            if (planet) {
              this.planetsOnFocus.push(planet);
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
        const px = this.planetsOnFocus[i].location.x;
        const py = this.planetsOnFocus[i].location.y;
        if (px < x0 || px > x1 || py < y0 || py > y1) {
          this.planetsOnFocus.splice(i, 1);
          i--;
          numPlanetsLeft--;
        }
      }
      this.planetsOnFocus.sort((a, b) => a.location.y - b.location.y);
      this.store.set(this.planetsOnFocus);
    }

    return this.planetsOnFocus;
  }
}

export const spaceInfo = new SpaceInfoStore(new SpaceInfo(contractsInfos.contracts.OuterSpace.linkedData), camera);
