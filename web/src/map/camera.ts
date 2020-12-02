import {xyToLocation} from 'planet-wars-common';
import type {RenderState} from '../types';
import type {Controller} from './controller';
import {cache} from '../stores/planetsCache';

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
]; //, 1/17, 1/18, 1/19, 1/20, 1/21, 1/22, 1/23, 1/24, 1/25, 1/26, 1/27, 1/28, 1/29]; // 48

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

export class Camera {
  private zoomIndex: number;
  public render: CameraSetup;
  public world: WorldSetup;
  private canvas: HTMLCanvasElement;
  private controller: Controller;

  constructor(private renderState: RenderState) {
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

  setup({
    canvas,
    controller,
  }: {
    canvas: HTMLCanvasElement;
    controller: Controller;
  }): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.controller = controller;
    this.canvas = canvas;
    // this.windowDevicePxelRatio = window.devicePixelRatio;
    this.render.devicePixelRatio = 0.5; //window.devicePixelRatio;

    let isPanning = false;
    let lastClientPos = {x: 0, y: 0};

    const _set = (x, y, zoom) => {
      this._set(x, y, zoom);
      const locationX = Math.floor(x / 48 / 4 / 2);
      const locationY = Math.floor(y / 48 / 4 / 2);
      cache.update(locationX, locationY); // TODO invesrion of control : emit event
    };

    const _update = () => {
      _set(this.world.x, this.world.y, this.world.zoom);
    };

    const zero = worldToScreen(0, 0);
    for (let i = 0; i < 16; i++) {
      updateZoom(zero.x, zero.y, 1);
    }

    const startPanning = (e) => {
      // console.log('startPanning');
      isPanning = true;
      const eventX = e.clientX || e.touches[0].clientX;
      const eventY = e.clientY || e.touches[0].clientY;
      lastClientPos = {x: eventX, y: eventY};
    };

    const onClick = (x, y) => {
      const worldPos = screenToWorld(x, y);
      const gridPos = {
        x: Math.round(worldPos.x / 48 / 2),
        y: Math.round(worldPos.y / 48 / 2),
      };
      const shifted = {
        x: gridPos.x + 2,
        y: gridPos.y + 2,
      };
      if (shifted.x % 4 == 0 || shifted.y % 4 == 0) {
        // console.log('boundaries');
        return;
      }
      const locX = Math.floor(shifted.x / 4);
      const locY = Math.floor(shifted.y / 4);
      const location = {
        x: locX,
        y: locY,
        id: xyToLocation(locX, locY),
      };

      const fleets = this.renderState.getOwnFleets();
      // TODO sort on timeLeft
      for (const fleet of fleets) {
        // TODO deduplicate code (see renderer.ts)
        const fGx1 = fleet.from.x * 4 * 2 * 48;
        const fGy1 = fleet.from.y * 4 * 2 * 48;
        const fGx2 = fleet.to.x * 4 * 2 * 48;
        const fGy2 = fleet.to.y * 4 * 2 * 48;
        const speed = 10000;
        const fullDistance = Math.floor(
          Math.sqrt(
            Math.pow(fleet.to.x - fleet.from.x, 2) +
              Math.pow(fleet.to.y - fleet.from.y, 2)
          )
        );
        const fullTime = fullDistance * ((3600 * 10000) / speed);
        const timePassed = Math.floor(Date.now() / 1000) - fleet.launchTime;
        let ratio = timePassed / fullTime;
        if (timePassed > fullTime) {
          // TODO disapear
          ratio = 1;
        }

        // const distance = (timePassed * speed) / (10000 * 3600);
        const fx = fGx1 + (fGx2 - fGx1) * ratio;
        const fy = fGy1 + (fGy2 - fGy1) * ratio;
        if (
          worldPos.x > fx - 50 &&
          worldPos.x < fx + 50 &&
          worldPos.y > fy - 50 &&
          worldPos.y < fy + 50
        ) {
          if (this.controller) {
            this.controller.onFleetSelected(fleet);
          }
        }
      }

      // console.log('onClick', JSON.stringify({worldPos, gridPos, location, shifted}, null, '  '));
      // TODO emit event // This should actually be moved to Screen
      const planet = this.renderState.getPlanet(location.x, location.y);
      if (planet) {
        // console.log(JSON.stringify(planet, null, '  '));
        if (this.controller) {
          this.controller.onPlanetSelected(planet);
        }
      } else {
        // console.log('no planet');
        this.controller.onPlanetSelected(null);
      }
    };

    const endPanning = (e) => {
      // console.log('endPanning');
      isPanning = false;
      let dist;
      if (!e.clientX) {
        // endtouch always trigger ? // TODO fix
        dist = 0;
      } else {
        const eventX = e.clientX || e.touches[0].clientX;
        const eventY = e.clientY || e.touches[0].clientY;
        dist = Math.hypot(eventX - lastClientPos.x, eventY - lastClientPos.y);
      }
      if (dist < 22) {
        // TODO : devicePixelRatio?
        // TODO time too ?
        onClick(lastClientPos.x, lastClientPos.y);
      }
    };

    const pan = (e) => {
      if (!isPanning) return;

      // let movementX;
      // let movementY;
      // if (e.movementX) {
      // 	movementX = e.movementX / windowDevicePxelRatio;
      // 	movementY = e.movementY / windowDevicePxelRatio;
      // }
      const eventX = e.clientX || e.touches[0].clientX;
      const eventY = e.clientY || e.touches[0].clientY;
      // console.log({eventX, eventY});
      const movementX = eventX - lastClientPos.x;
      const movementY = eventY - lastClientPos.y;
      // console.log(JSON.stringify({movementX, movementY, eMovementX: e.movementX, eMovementY: e.movementY}))
      lastClientPos = {x: eventX, y: eventY};

      // console.log('panning', movementX, movementY);

      const devicePixelRatio = this.render.devicePixelRatio;
      const scale = this.world.zoom * devicePixelRatio;
      this.world.x -= (movementX * devicePixelRatio) / scale;
      this.world.y -= (movementY * devicePixelRatio) / scale;
      _update();
    };

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
      startPanning(e);
    };
    canvas.onmouseup = (e) => {
      endPanning(e);
    };
    canvas.onmousemove = (e) => {
      pan(e);
    };

    let isZooming = false;
    let lastDist = 0;
    let zoomPoint = {x: 0, y: 0};

    function startZooming(e) {
      isPanning = false; // zooming override panning
      isZooming = true;
      lastDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      zoomPoint = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function endZooming(_e: TouchEvent) {
      isZooming = false;
    }

    function doZooming(e: TouchEvent) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );

      // console.log(JSON.stringify({dist, lastDist}));
      const diff = lastDist - dist;
      if (Math.abs(diff) > 50) {
        // devicePixelRatio
        const dir = Math.sign(diff);
        updateZoom(zoomPoint.x, zoomPoint.y, dir);
        lastDist = dist;
      }
    }

    function logTouchEvent(_title: string, e: TouchEvent) {
      const touches = [];
      for (let i = 0; i < e.touches.length; i++) {
        touches.push({identifier: e.touches[i].identifier});
      }
      // console.log(title, JSON.stringify(touches));
    }
    canvas.ontouchstart = (e: TouchEvent) => {
      e.preventDefault();
      logTouchEvent('start', e);
      if (!isZooming && e.touches.length === 2) {
        startZooming(e);
      } else if (!isZooming) {
        startPanning(e);
      }
    };
    canvas.ontouchend = (e: TouchEvent) => {
      e.preventDefault();
      logTouchEvent('end', e);
      if (isZooming) {
        endZooming(e);
      } else if (isPanning) {
        endPanning(e);
      }
    };
    canvas.ontouchmove = (e: TouchEvent) => {
      e.preventDefault();
      logTouchEvent('move', e);
      if (isZooming) {
        if (e.touches.length != 2) {
          endZooming(e);
        } else {
          doZooming(e);
        } // TODO allow panning if one touch left?
      } else if (isPanning) {
        pan(e);
      }
    };

    function screenToWorld(x, y) {
      const devicePixelRatio = self.render.devicePixelRatio;
      const scale = self.world.zoom * devicePixelRatio;
      x = (x * devicePixelRatio - canvas.width / 2) / scale + self.world.x;
      y = (y * devicePixelRatio - canvas.height / 2) / scale + self.world.y;
      return {
        x,
        y,
      };
    }

    function worldToScreen(x, y) {
      const devicePixelRatio = self.render.devicePixelRatio;
      const scale = self.world.zoom * devicePixelRatio;
      return {
        x:
          ((x - self.world.x) * scale + self.canvas.width / 2) /
          devicePixelRatio,
        y:
          ((y - self.world.y) * scale + self.canvas.height / 2) /
          devicePixelRatio,
      };
    }

    // function clientToCanvas(x: number, y: number) {
    //   const devicePixelRatio = self.render.devicePixelRatio;
    //   x = x * devicePixelRatio;
    //   y = y * devicePixelRatio;
    //   return {
    //     x,
    //     y,
    //   };
    // }

    function updateZoom(offsetX, offsetY, dir) {
      const {x, y} = screenToWorld(offsetX, offsetY);
      // const oldZoom = self.world.zoom;

      if (dir > 0) {
        // console.log('zoom out');
        if (self.world.zoom > 1) {
          self.world.zoom--;
        } else {
          self.zoomIndex = Math.min(
            self.zoomIndex + 1,
            lowZoomOrder.length - 1
          );
          self.world.zoom = lowZoomOrder[self.zoomIndex];
          // self.world.zoom /=2;
        }
      } else {
        // console.log('zoom in');
        if (self.world.zoom >= 1) {
          self.world.zoom++;
        } else {
          self.zoomIndex = self.zoomIndex - 1;
          if (self.zoomIndex < 0) {
            self.zoomIndex = -1;
            self.world.zoom = 1;
          } else {
            self.world.zoom = lowZoomOrder[self.zoomIndex];
          }

          // self.world.zoom *=2;
        }
      }
      // self.world.zoom = Math.min(Math.max(0.25, self.world.zoom), 2);

      const screenPos = worldToScreen(x, y);
      const delta = {
        x: Math.round((offsetX - screenPos.x) / self.world.zoom),
        y: Math.round((offsetY - screenPos.y) / self.world.zoom),
      };
      self.world.x -= delta.x;
      self.world.y -= delta.y;
      _update();
    }

    canvas.onwheel = (e) => {
      e.preventDefault();
      const {offsetX, offsetY, deltaY} = e;
      const dir = Math.abs(deltaY) / deltaY;

      updateZoom(offsetX, offsetY, dir);
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
  }
}
