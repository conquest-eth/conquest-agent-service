import type {RenderState} from './RenderState';
import type {Controller} from './controller';
import {space} from '../app/mapState';
import {trackInstances} from '../lib/utils/tools';

const lowZoomOrder = [
  0.5,
  1 / 3,
  0.25,
  1 / 5,
  1 / 6,
  1 / 7,
  1 / 8,
  1 / 9,
  1 / 10,
  1 / 11,
  1 / 12,
  1 / 13,
  1 / 14,
  1 / 15,
  1 / 16,
  1 / 17,
  1 / 18,
  1 / 19,
  1 / 20,
];

// const lowZoomOrder = [
//   0.5,
//   1 / 3,
//   0.25,
//   1 / 5,
//   1 / 6,
//   1 / 7,
//   1 / 8,
//   1 / 9,
//   1 / 10,
//   1 / 11,
//   1 / 12,
//   1 / 13,
//   1 / 14,
//   1 / 15,
//   1 / 16,
//   1 / 17,
//   1 / 18,
//   1 / 19,
//   1 / 20,
//   1 / 21,
//   1 / 22,
//   1 / 23,
//   1 / 24,
//   1 / 25,
//   1 / 26,
//   1 / 27,
//   1 / 28,
//   1 / 29,
//   1 / 48,
//   1 / 64,
// ];

export type CameraSetup = {
  x: number;
  y: number;
  scale: number;
  devicePixelRatio: number;
};

export type WorldSetup = {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
};

@trackInstances
export class Camera {
  private zoomIndex: number;
  public render: CameraSetup;
  public world: WorldSetup;
  private canvas: HTMLCanvasElement;
  private controller: Controller;

  private isPanning = false;
  private lastClientPos = {x: 0, y: 0};
  private firstClientPos = {x: 0, y: 0};
  private isZooming = false;
  private lastDist = 0;
  private zoomPoint = {x: 0, y: 0};

  constructor(private renderState: RenderState) {
    // avoid type errors
    this.canvas = (undefined as unknown) as HTMLCanvasElement;
    this.controller = (undefined as unknown) as Controller;

    this.zoomIndex = -1;
    this.render = {
      // could be computed on the fly
      x: 0,
      y: 0,
      scale: 1,
      devicePixelRatio: 1,
    };
    this.world = {
      x: 0, //-4000000000 / 48 / 4 / 2,
      y: 0, //-4000000000 / 48 / 4 / 2,
      width: 0,
      height: 0,
      zoom: 1,
    };
  }

  _set(x: number, y: number, zoom: number): void {
    this.world.x = x;
    this.world.y = y;
    this.world.zoom = zoom;

    const scale = this.world.zoom * this.render.devicePixelRatio;
    this.render.scale = scale;
    this.world.width = this.canvas.width / scale;
    this.world.height = this.canvas.height / scale;

    this.render.x = Math.floor(
      Math.floor((this.world.width / 2 - this.world.x) * scale) / scale
    );
    this.render.y = Math.floor(
      Math.floor((this.world.height / 2 - this.world.y) * scale) / scale
    );
  }

  _setAndFocus(x: number, y: number, zoom: number): void {
    this._set(x, y, zoom);
    const locationX = Math.floor(x / 48 / 4 / 2);
    const locationY = Math.floor(y / 48 / 4 / 2);
    const lwidth = Math.ceil(this.world.width / 48 / 4 / 2 / 2);
    const lheight = Math.ceil(this.world.height / 48 / 4 / 2 / 2);
    space.focus(
      locationX - lwidth,
      locationY - lheight,
      locationX + lwidth,
      locationY + lheight
    ); // TODO invesrion of control :
  }

  screenToWorld(x: number, y: number): {x: number; y: number} {
    const devicePixelRatio = this.render.devicePixelRatio;
    const scale = this.world.zoom * devicePixelRatio;
    x = (x * devicePixelRatio - this.canvas.width / 2) / scale + this.world.x;
    y = (y * devicePixelRatio - this.canvas.height / 2) / scale + this.world.y;
    return {
      x,
      y,
    };
  }

  worldToScreen(x: number, y: number): {x: number; y: number} {
    const devicePixelRatio = this.render.devicePixelRatio;
    const scale = this.world.zoom * devicePixelRatio;
    return {
      x:
        ((x - this.world.x) * scale + this.canvas.width / 2) / devicePixelRatio,
      y:
        ((y - this.world.y) * scale + this.canvas.height / 2) /
        devicePixelRatio,
    };
  }

  _update(): void {
    this._setAndFocus(this.world.x, this.world.y, this.world.zoom);
  }

  _onClick(x: number, y: number): void {
    const worldPos = this.screenToWorld(x, y);
    const globalX = worldPos.x / 48 / 2;
    const globalY = worldPos.y / 48 / 2;

    // TODO ? // or instead use zoom level to show info or not : buble on top of planet / fleets
    // const fleets = this.renderState.getOwnFleets();
    // // TODO sort on timeLeft
    // for (const fleet of fleets) {
    //   // TODO deduplicate code (see renderer.ts)
    //   const fGx1 = fleet.from.x * 4 * 2 * 48;
    //   const fGy1 = fleet.from.y * 4 * 2 * 48;
    //   const fGx2 = fleet.to.x * 4 * 2 * 48;
    //   const fGy2 = fleet.to.y * 4 * 2 * 48;
    //   const speed = 10000;
    //   const fullDistance = Math.floor(
    //     Math.sqrt(
    //       Math.pow(fleet.to.x - fleet.from.x, 2) +
    //         Math.pow(fleet.to.y - fleet.from.y, 2)
    //     )
    //   );
    //   const fullTime = fullDistance * ((3600 * 10000) / speed);
    //   const timePassed = Math.floor(Date.now() / 1000) - fleet.launchTime;
    //   let ratio = timePassed / fullTime;
    //   if (timePassed > fullTime) {
    //     // TODO disapear
    //     ratio = 1;
    //   }

    //   // const distance = (timePassed * speed) / (10000 * 3600);
    //   const fx = fGx1 + (fGx2 - fGx1) * ratio;
    //   const fy = fGy1 + (fGy2 - fGy1) * ratio;
    //   if (
    //     worldPos.x > fx - 50 &&
    //     worldPos.x < fx + 50 &&
    //     worldPos.y > fy - 50 &&
    //     worldPos.y < fy + 50
    //   ) {
    //     if (this.controller) {
    //       this.controller.onFleetSelected(fleet);
    //     }
    //   }
    // }

    const locX = Math.floor((Math.round(globalX) + 2) / 4);
    const locY = Math.floor((Math.round(globalY) + 2) / 4);
    // const locationX = Math.floor(globalX / 4);
    // const locationY = Math.floor(globalY / 4);
    // console.log('onClick', JSON.stringify({worldPos, gridPos, location, shifted}, null, '  '));
    // TODO emit event // This should actually be moved to Screen
    // const planet = this.renderState.space.planetAt(locationX, locationY);
    const planet = this.renderState.space.planetAt(locX, locY);

    // console.log({
    //   locX,
    //   locY,
    //   locationX,
    //   locationY,
    //   globalX,
    //   globalY,
    //   planetGlobalX: planet?.location.globalX,
    //   planetGlobalY: planet?.location.globalY,
    // });
    console.log({zoom: this.world.zoom});
    if (
      planet &&
      Math.sqrt(
        Math.pow(planet.location.globalX - globalX, 2) +
          Math.pow(planet.location.globalY - globalY, 2)
      ) <= (this.world.zoom < 1 / 5 ? 1 / this.world.zoom / 5 : 1)
    ) {
      // console.log(JSON.stringify(planet, null, '  '));
      if (this.controller) {
        this.controller.onPlanetSelected(planet);
      }
    } else {
      // console.log('no planet');
      this.controller.onPlanetSelected(undefined);
    }
  }

  onmousedown(e: TouchEvent | MouseEvent): void {
    // console.log('startPanning');
    this.isPanning = true;
    let eventX;
    let eventY;
    if ('clientX' in e) {
      // console.log('mouse');
      eventX = e.clientX;
      eventY = e.clientY;
    } else {
      // console.log('touch', e);
      eventX = e.touches[0].clientX;
      eventY = e.touches[0].clientY;
    }
    this.lastClientPos = {x: eventX, y: eventY};
    this.firstClientPos = {x: eventX, y: eventY};
  }

  onmouseup(e: TouchEvent | MouseEvent): void {
    // console.log('endPanning');
    this.isPanning = false;

    let eventX;
    let eventY;
    if ('clientX' in e) {
      // console.log('mouse');
      eventX = e.clientX;
      eventY = e.clientY;
    } else {
      // console.log('touch', e);
      eventX = e.changedTouches[0].clientX;
      eventY = e.changedTouches[0].clientY;
    }
    const dist = Math.hypot(
      eventX - this.firstClientPos.x,
      eventY - this.firstClientPos.y
    );
    if (dist < 22) {
      // TODO : devicePixelRatio?
      // TODO time too ?
      this._onClick(this.lastClientPos.x, this.lastClientPos.y);
    }
  }

  onmousemove(e: TouchEvent | MouseEvent): void {
    if (!this.isPanning) return;

    // let movementX;
    // let movementY;
    // if (e.movementX) {
    // 	movementX = e.movementX / windowDevicePxelRatio;
    // 	movementY = e.movementY / windowDevicePxelRatio;
    // }
    let eventX;
    let eventY;
    if ('clientX' in e) {
      eventX = e.clientX;
      eventY = e.clientY;
    } else {
      eventX = e.touches[0].clientX;
      eventY = e.touches[0].clientY;
    }

    // console.log({eventX, eventY});
    const movementX = eventX - this.lastClientPos.x;
    const movementY = eventY - this.lastClientPos.y;
    // console.log(JSON.stringify({movementX, movementY, eMovementX: e.movementX, eMovementY: e.movementY}))
    this.lastClientPos = {x: eventX, y: eventY};

    // console.log('panning', movementX, movementY);

    const devicePixelRatio = this.render.devicePixelRatio;
    const scale = this.world.zoom * devicePixelRatio;
    this.world.x -= (movementX * devicePixelRatio) / scale;
    this.world.y -= (movementY * devicePixelRatio) / scale;
    this._update();
  }

  onwheel(e: WheelEvent): void {
    e.preventDefault();
    const {offsetX, offsetY, deltaY} = e;
    const dir = (Math.abs(deltaY) / deltaY) as 0 | -1 | 1;
    this.updateZoom(offsetX, offsetY, dir);
  }

  startZooming(e: TouchEvent): void {
    this.isPanning = false; // zooming override panning
    this.isZooming = true;
    this.lastDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    this.zoomPoint = {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  endZooming(_e: TouchEvent): void {
    this.isZooming = false;
  }

  doZooming(e: TouchEvent): void {
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );

    // console.log(JSON.stringify({dist, lastDist}));
    const diff = this.lastDist - dist;
    if (Math.abs(diff) > 50) {
      // devicePixelRatio
      const dir: 0 | -1 | 1 = Math.sign(diff) as 0 | -1 | 1;
      this.updateZoom(this.zoomPoint.x, this.zoomPoint.y, dir);
      this.lastDist = dist;
    }
  }

  logTouchEvent(_title: string, e: TouchEvent): void {
    const touches = [];
    for (let i = 0; i < e.touches.length; i++) {
      touches.push({identifier: e.touches[i].identifier});
    }
    // console.log(title, JSON.stringify(touches));
  }

  ontouchstart(e: TouchEvent): void {
    e.preventDefault();
    this.logTouchEvent('start', e);
    if (!this.isZooming && e.touches.length === 2) {
      this.startZooming(e);
    } else if (!this.isZooming) {
      this.onmousedown(e); // TODO ?
    }
  }

  ontouchend(e: TouchEvent): void {
    e.preventDefault();
    this.logTouchEvent('end', e);
    if (this.isZooming) {
      this.endZooming(e);
    } else if (this.isPanning) {
      this.onmouseup(e); // TODO ?
    }
  }

  ontouchmove(e: TouchEvent): void {
    e.preventDefault();
    this.logTouchEvent('move', e);
    if (this.isZooming) {
      if (e.touches.length != 2) {
        this.endZooming(e);
      } else {
        this.doZooming(e);
      } // TODO allow panning if one touch left?
    } else if (this.isPanning) {
      this.onmousemove(e); // TODO ?
    }
  }

  // function clientToCanvas(x: number, y: number) {
  //   const devicePixelRatio = this.render.devicePixelRatio;
  //   x = x * devicePixelRatio;
  //   y = y * devicePixelRatio;
  //   return {
  //     x,
  //     y,
  //   };
  // }

  updateZoom(offsetX: number, offsetY: number, dir: 1 | -1 | 0): void {
    const {x, y} = this.screenToWorld(offsetX, offsetY);
    // const oldZoom = this.world.zoom;

    if (dir > 0) {
      // console.log('zoom out');
      if (this.world.zoom > 1) {
        this.world.zoom--;
      } else {
        this.zoomIndex = Math.min(this.zoomIndex + 1, lowZoomOrder.length - 1);
        this.world.zoom = lowZoomOrder[this.zoomIndex];
        // this.world.zoom /=2;
      }
    } else {
      // console.log('zoom in');
      if (this.world.zoom >= 1) {
        this.world.zoom++;
      } else {
        this.zoomIndex = this.zoomIndex - 1;
        if (this.zoomIndex < 0) {
          this.zoomIndex = -1;
          this.world.zoom = 1;
        } else {
          this.world.zoom = lowZoomOrder[this.zoomIndex];
        }

        // this.world.zoom *=2;
      }
    }
    // this.world.zoom = Math.min(Math.max(0.25, this.world.zoom), 2);

    const screenPos = this.worldToScreen(x, y);
    const delta = {
      x: Math.round((offsetX - screenPos.x) / this.world.zoom),
      y: Math.round((offsetY - screenPos.y) / this.world.zoom),
    };
    this.world.x -= delta.x;
    this.world.y -= delta.y;
    this._update();
  }

  setup({
    canvas,
    controller,
  }: {
    canvas: HTMLCanvasElement;
    controller: Controller;
  }): void {
    this.controller = controller;
    this.canvas = canvas;
    // this.windowDevicePxelRatio = window.devicePixelRatio;
    this.render.devicePixelRatio = 0.5; //window.devicePixelRatio;

    const zero = this.worldToScreen(0, 0);
    for (let i = 0; i < 4; i++) {
      this.updateZoom(zero.x, zero.y, 1);
    }

    // function logEvent(name, func, options) {
    //   return function (e) {
    //     if (options && options.preventDefault) {
    //       e.preventDefault();
    //     }
    //     // console.log(name);
    //     if (func) {
    //       return func(e);
    //     }
    //   };
    // }
    canvas.onmousedown = (e) => {
      this.onmousedown(e);
    };
    canvas.onmouseup = (e) => {
      this.onmouseup(e);
    };
    canvas.onmousemove = (e) => {
      this.onmousemove(e);
    };

    canvas.ontouchstart = (e: TouchEvent) => {
      this.ontouchstart(e);
    };
    canvas.ontouchend = (e: TouchEvent) => {
      this.ontouchend(e);
    };
    canvas.ontouchmove = (e: TouchEvent) => {
      this.ontouchmove(e);
    };

    canvas.onwheel = (e) => {
      this.onwheel(e);
    };
  }

  onRender(): boolean {
    const canvas = this.canvas;
    const devicePixelRatio = this.render.devicePixelRatio;
    const displayWidth = Math.floor(canvas.clientWidth * devicePixelRatio);
    const displayHeight = Math.floor(canvas.clientHeight * devicePixelRatio);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      this._set(this.world.x, this.world.y, this.world.zoom);
      return true;
    }
    return false;
  }
}
