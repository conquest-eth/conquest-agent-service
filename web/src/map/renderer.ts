import planetsFrame from '../assets/planets.json';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
///@ts-ignore
import planetsDataURL from '../assets/planets.png';
import type {RenderState} from '../types';
import type {CameraSetup, WorldSetup} from './camera';

// pre-render
const planetSpriteSheet = new Image();
planetSpriteSheet.src = planetsDataURL;
let pctx;
const horizPattern = document.createElement('canvas');
horizPattern.width = 48;
horizPattern.height = 1;
pctx = horizPattern.getContext('2d');
pctx.fillStyle = '#4F487A';
pctx.fillRect(0, 0, 2, 1);
pctx.fillRect(6, 0, 36, 1);
pctx.fillRect(46, 0, 2, 1);
const vertPattern = document.createElement('canvas');
vertPattern.width = 1;
vertPattern.height = 48;
pctx = vertPattern.getContext('2d');
pctx.fillStyle = '#4F487A';
pctx.fillRect(0, 0, 1, 2);
pctx.fillRect(0, 6, 1, 36);
pctx.fillRect(0, 46, 1, 2);

const planetTypesToFrame = [
  'Baren.png',
  'Desert.png',
  'Forest.png',
  'Ice.png',
  'Lava.png',
  'Ocean.png',
  'Terran.png',
  'Barren_2.png',
  'Desert_1.png',
  'Desert_2.png',
  'Gas_1.png',
  'Ice_1.png',
  'Ice_2.png',
  'Jungle32.png',
  'Jungle64.png',
  'Lava_1.png',
  'Lava_2.png',
  // 'Moon.png',
  'Ocean_1.png',
  'Tech_1.png',
  'Tech_2.png',
  'Terran_1.png',
  'Terran_2.png',
  'Tundra.png',
];

function line2line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number
): {x: number; y: number} | null {
  const uA =
    ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) /
    ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
  const uB =
    ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) /
    ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));

  if (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1) {
    const x = x1 + uA * (x2 - x1);
    const y = y1 + uA * (y2 - y1);
    return {x, y};
  }
  return null;
}

function line2rect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): {x1: number; y1: number; x2: number; y2: number} {
  const newSegment = {x1, y1, x2, y2};
  if (x1 > rx && x2 < rx + rw && y1 > ry && y2 < ry + rh) {
    return newSegment;
  }
  const left = line2line(x1, y1, x2, y2, rx, ry, rx, ry + rh);
  const right = line2line(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh);
  const top = line2line(x1, y1, x2, y2, rx, ry, rx + rw, ry);
  const bottom = line2line(x1, y1, x2, y2, rx, ry + rh, rx + rw, ry + rh);
  if (!left && !right && !top && !bottom) {
    return null;
  }
  if (left) {
    if (right) {
      if (x1 < x2) {
        newSegment.x1 = left.x;
        newSegment.y1 = left.y;
        newSegment.x2 = right.x;
        newSegment.y2 = right.y;
      } else {
        newSegment.x2 = left.x;
        newSegment.y2 = left.y;
        newSegment.x1 = right.x;
        newSegment.y1 = right.y;
      }
    } else if (top) {
      if (x1 < x2) {
        newSegment.x1 = left.x;
        newSegment.y1 = left.y;
        newSegment.x2 = top.x;
        newSegment.y2 = top.y;
      } else {
        newSegment.x2 = left.x;
        newSegment.y2 = left.y;
        newSegment.x1 = top.x;
        newSegment.y1 = top.y;
      }
    } else if (bottom) {
      if (x1 < x2) {
        newSegment.x1 = left.x;
        newSegment.y1 = left.y;
        newSegment.x2 = bottom.x;
        newSegment.y2 = bottom.y;
      } else {
        newSegment.x2 = left.x;
        newSegment.y2 = left.y;
        newSegment.x1 = bottom.x;
        newSegment.y1 = bottom.y;
      }
    } else {
      if (x1 < x2) {
        newSegment.x1 = left.x;
        newSegment.y1 = left.y;
      } else {
        newSegment.x2 = left.x;
        newSegment.y2 = left.y;
      }
    }
  } else if (right) {
    if (top) {
      if (x1 > x2) {
        newSegment.x1 = right.x;
        newSegment.y1 = right.y;
        newSegment.x2 = top.x;
        newSegment.y2 = top.y;
      } else {
        newSegment.x2 = right.x;
        newSegment.y2 = right.y;
        newSegment.x1 = top.x;
        newSegment.y1 = top.y;
      }
    } else if (bottom) {
      if (x1 > x2) {
        newSegment.x1 = right.x;
        newSegment.y1 = right.y;
        newSegment.x2 = bottom.x;
        newSegment.y2 = bottom.y;
      } else {
        newSegment.x2 = right.x;
        newSegment.y2 = right.y;
        newSegment.x1 = bottom.x;
        newSegment.y1 = bottom.y;
      }
    } else {
      if (x1 > x2) {
        newSegment.x1 = right.x;
        newSegment.y1 = right.y;
      } else {
        newSegment.x2 = right.x;
        newSegment.y2 = right.y;
      }
    }
  } else if (top) {
    if (bottom) {
      if (y1 < y2) {
        newSegment.x1 = top.x;
        newSegment.y1 = top.y;
        newSegment.x2 = bottom.x;
        newSegment.y2 = bottom.y;
      } else {
        newSegment.x2 = top.x;
        newSegment.y2 = top.y;
        newSegment.x1 = bottom.x;
        newSegment.y1 = bottom.y;
      }
    } else {
      if (y1 < y2) {
        newSegment.x1 = top.x;
        newSegment.y1 = top.y;
      } else {
        newSegment.x2 = top.x;
        newSegment.y2 = top.y;
      }
    }
  } else {
    if (y1 > y2) {
      newSegment.x1 = bottom.x;
      newSegment.y1 = bottom.y;
    } else {
      newSegment.x2 = bottom.x;
      newSegment.y2 = bottom.y;
    }
  }
  return newSegment;
}

export class Renderer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private hPattern: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private vPattern: any;

  private lastCamera: WorldSetup = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    zoom: 0,
  };
  private lastRenderStateChangeCounter = 0;

  constructor(private renderState: RenderState) {}

  setup(ctx: CanvasRenderingContext2D): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ctx as any).mozImageSmoothingEnabled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ctx as any).webkitImageSmoothingEnabled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ctx as any).msImageSmoothingEnabled = false;
    ctx.imageSmoothingEnabled = false;

    this.hPattern = ctx.createPattern(horizPattern, 'repeat-x');
    this.vPattern = ctx.createPattern(vertPattern, 'repeat-y');
  }

  cameraChanged(camera: WorldSetup): boolean {
    if (
      this.lastCamera.x !== camera.x ||
      this.lastCamera.y !== camera.y ||
      this.lastCamera.width !== camera.width ||
      this.lastCamera.height !== camera.height ||
      this.lastCamera.zoom !== camera.zoom
    ) {
      this.lastCamera.x = camera.x;
      this.lastCamera.y = camera.y;
      this.lastCamera.width = camera.width;
      this.lastCamera.height = camera.height;
      this.lastCamera.zoom = camera.zoom;
      return true;
    }

    return false;
  }

  stateChanged(camera: WorldSetup): boolean {
    const changeCounter = this.renderState.changeCounter;
    if (this.cameraChanged(camera)) {
      this.lastRenderStateChangeCounter = changeCounter;
      return true;
    }

    if (this.lastRenderStateChangeCounter !== changeCounter) {
      this.lastRenderStateChangeCounter = changeCounter;
      return true;
    }

    return false;
  }

  render(
    time: number,
    ctx: CanvasRenderingContext2D,
    camera: WorldSetup,
    render: CameraSetup
  ): void {
    if (!this.stateChanged(camera)) {
      return;
    }

    let gridLevel = 1;
    if (camera.zoom < 1) {
      gridLevel = Math.floor(1 / camera.zoom); //Math.floor(Math.floor(48 / (camera.zoom)) / 48);
    }

    const gridSize =
      Math.max(1, Math.pow(2, Math.floor(Math.log2(gridLevel)))) * 48;
    // const gridSize = 48 * Math.pow(2, gridLevel-1);
    // const nextLevelGridSize = 48 * Math.pow(2, gridLevel);
    const gridOffset = gridSize - gridSize / 8;
    const mainDash = gridSize - gridSize / 4;
    const smallDash = gridSize / 6 / 2;
    const lineWidth = gridSize / 6 / 2;

    const leftX = camera.x - camera.width / 2;
    const topY = camera.y - camera.height / 2;
    const gridStart = {
      x: Math.floor(leftX / gridSize) * gridSize,
      y: Math.floor(topY / gridSize) * gridSize,
    };

    // const gridLevelRoot = Math.floor(Math.sqrt((1 / camera.zoom) * 2)); //Math.floor(Math.floor(48 / (camera.zoom)) / 48);

    // console.log(JSON.stringify({gridLevelRoot, gridSize, gridLevel}));

    if (gridLevel < 10) {
      // console.log(JSON.stringify({gridLevel, gridSize, nextLevelGridSize}));

      // console.log(offset, camera);
      // console.log({lineWidth,gridStart, gridOffset, gridSize, canvasWidth: canvas.width, canvasHeight: canvas.height, zoom: camera.zoom});

      // eslint-disable-next-line no-inner-declarations
      function setColor(x) {
        if (gridSize == 48) {
          if (Math.floor(x / (8 * 48)) == x / (8 * 48)) {
            ctx.strokeStyle = '#4f5d94'; //"#6c7fc9";
          } else if (Math.floor(x / (4 * 48)) == x / (4 * 48)) {
            ctx.strokeStyle = '#3e4974'; //"#5665a1";
          } else if (Math.floor(x / (2 * 48)) == x / (2 * 48)) {
            ctx.strokeStyle = '#323b5e'; //"#434f7d";
          } else if (Math.floor(x / (1 * 48)) == x / (1 * 48)) {
            ctx.strokeStyle = '#28304c'; //"#323b52";
          } else {
            ctx.strokeStyle = '#00000';
          }
        } else if (gridSize == 2 * 48) {
          if (Math.floor(x / (8 * 48)) == x / (8 * 48)) {
            ctx.strokeStyle = '#3e4974'; //"#6c7fc9";
          } else if (Math.floor(x / (4 * 48)) == x / (4 * 48)) {
            ctx.strokeStyle = '#323b5e'; //"#5665a1";
          } else if (Math.floor(x / (2 * 48)) == x / (2 * 48)) {
            ctx.strokeStyle = '#28304c'; //"#434f7d";
          } else {
            ctx.strokeStyle = '#00000';
          }
        } else if (gridSize == 4 * 48) {
          if (Math.floor(x / (8 * 48)) == x / (8 * 48)) {
            ctx.strokeStyle = '#323b5e'; //"#6c7fc9";
          } else if (Math.floor(x / (4 * 48)) == x / (4 * 48)) {
            ctx.strokeStyle = '#28304c'; //"#5665a1";
          } else {
            ctx.strokeStyle = '#00000';
          }
        } else if (gridSize == 8 * 48) {
          if (Math.floor(x / (8 * 48)) == x / (8 * 48)) {
            ctx.strokeStyle = '#28304c'; //"#5665a1";
          } else {
            ctx.strokeStyle = '#00000';
          }
        }
      }

      for (
        let x = gridStart.x;
        x < gridStart.x + camera.width + gridOffset;
        x += gridSize
      ) {
        // ctx.fillStyle = vPattern;
        // ctx.save();
        // ctx.scale(1, gridSize / 48);
        // ctx.fillRect(x-lineWidth/2, gridStart.y, lineWidth, camera.height + gridOffset);
        // ctx.restore();

        // // console.log('x', Math.round(x-lineWidth/2), Math.round(gridStart.y), Math.round(lineWidth), Math.round(gridSize))
        // for (let y = gridStart.y; y < gridStart.y + camera.height + gridOffset; y += gridSize) {
        // 	ctx.drawImage(vertPattern, Math.round(x-lineWidth/2), Math.round(y), Math.round(lineWidth), Math.round(gridSize));
        // }

        ctx.beginPath();
        setColor(x);
        ctx.lineWidth = lineWidth;
        // if ((x / nextLevelGridSize) == Math.floor(x / nextLevelGridSize)) {
        // 	ctx.lineWidth = lineWidth * 2;
        // }
        ctx.setLineDash([mainDash, smallDash, smallDash, smallDash]);
        ctx.moveTo(Math.round(x), Math.round(gridStart.y - gridOffset)); // TODO use drawImage for line pattern to avoid anti-aliasing
        ctx.lineTo(
          Math.round(x),
          Math.round(gridStart.y + camera.height + gridOffset)
        );
        ctx.stroke();
      }

      for (
        let y = gridStart.y;
        y < gridStart.y + camera.height + gridOffset;
        y += gridSize
      ) {
        // ctx.fillStyle = hPattern;
        // ctx.save();
        // ctx.scale(gridSize / 48, 1);
        // ctx.fillRect(gridStart.x, y-lineWidth/2, camera.width + gridOffset, lineWidth);
        // ctx.restore();

        // // console.log('y', Math.round(gridStart.x), Math.round(y-lineWidth/2), Math.round(gridSize), Math.round(lineWidth))
        // for (let x = gridStart.x; x < gridStart.x + camera.width + gridOffset; x += gridSize) {
        // 	ctx.drawImage(horizPattern, Math.round(x), Math.round(y-lineWidth/2), Math.round(gridSize), Math.round(lineWidth));
        // }

        ctx.beginPath();
        setColor(y);
        ctx.lineWidth = lineWidth;
        // if ((y / nextLevelGridSize) == Math.floor(y / nextLevelGridSize)) {
        // 	ctx.lineWidth = lineWidth * 2;
        // }
        ctx.setLineDash([mainDash, smallDash, smallDash, smallDash]);
        ctx.moveTo(Math.round(gridStart.x - gridOffset), Math.round(y));
        ctx.lineTo(
          Math.round(gridStart.x + camera.width + gridOffset),
          Math.round(y)
        );
        ctx.stroke();
      }
    }

    const gridX = Math.floor(gridStart.x / 48 / 4 / 2);
    const gridY = Math.floor(gridStart.y / 48 / 4 / 2);
    const gridEndX = Math.floor(
      (gridStart.x + camera.width + gridOffset) / 48 / 4 / 2
    );
    const gridEndY = Math.floor(
      (gridStart.y + camera.height + gridOffset) / 48 / 4 / 2
    );
    for (let x = gridX; x <= gridEndX + 1; x++) {
      for (let y = gridY; y <= gridEndY + 1; y++) {
        const planet = this.renderState.getPlanet(x, y);
        if (planet) {
          const lavaFrame =
            planetsFrame.frames[planetTypesToFrame[planet.type]].frame;
          // console.log(planet)
          ctx.imageSmoothingEnabled = false;
          const planetX = (x * 4 * 2) * 48;
          const planetY = (y * 4 * 2) * 48;
          ctx.drawImage(
            planetSpriteSheet,
            lavaFrame.x,
            lavaFrame.y,
            lavaFrame.w,
            lavaFrame.h,
            Math.round(planetX - 48 / 2),
            Math.round(planetY - 48 / 2),
            48,
            48
          );

          let circleColor = undefined;
          let circleDash = [];
          let circleRotate = false;
          if (planet.loaded) {
            if (planet.state) {
              if (this.renderState.player) {
                if (
                  // TODO enforce convention to not need `toLowerCase` overhead
                  planet.state.owner.toLowerCase() ===
                  this.renderState.player.toLowerCase()
                ) {
                  circleColor = 'green';
                } else if (
                  planet.state.owner !==
                  '0x0000000000000000000000000000000000000000'
                ) {
                  circleColor = 'red';
                } else {
                  circleColor = undefined;
                }
              } else {
                if (
                  planet.state.owner !==
                  '0x0000000000000000000000000000000000000000'
                ) {
                  circleColor = 'white';
                } else {
                  circleColor = 'white';
                }
              }
              if (planet.state.stake == '0') {
                // TODO BigNumber ?
                circleDash = [2, 10];
              }
            }
          } else {
            circleColor = 'white'; // TODO remove
            circleDash = [5, 15];
            circleRotate = true;
          }

          // circleColor = 'white'; // TODO remove

          if (circleColor) {
            ctx.beginPath();
            ctx.setLineDash(circleDash);
            if (circleColor === 'white') {
              ctx.lineWidth = 1 / render.scale;
            } else {
              ctx.lineWidth = 1 / render.scale;
            }

            ctx.strokeStyle = circleColor;
            ctx.ellipse(
              Math.round(planetX),
              Math.round(planetY),
              72,
              72,
              circleRotate ? time / 500 : 0,
              0,
              2 * Math.PI
            );
            ctx.stroke();
          }
        }
      }
    }

    let scale = render.scale * 8;
    if (scale > 2) {
      scale = 1;
    }
    if (scale < 0.25) {
      scale = 0.25;
    }

    const fleets = this.renderState.getOwnFleets();
    for (const fleet of fleets) {
      const fGx1 = fleet.from.x * 4 * 2 * 48;
      const fGy1 = fleet.from.y * 4 * 2 * 48;
      const fGx2 = fleet.to.x * 4 * 2 * 48;
      const fGy2 = fleet.to.y * 4 * 2 * 48;
      const segment = line2rect(
        fGx1,
        fGy1,
        fGx2,
        fGy2,
        leftX,
        topY,
        camera.width,
        camera.height
      );
      if (segment) {
        ctx.beginPath();
        ctx.strokeStyle = '#FDFBF3';
        ctx.lineWidth = 8 / scale;
        ctx.moveTo(segment.x1, segment.y1);
        ctx.lineTo(segment.x2, segment.y2);
        ctx.stroke();
      }

      // TODO
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
      // if inside rect
      ctx.fillRect(fx - 50, fy - 50, 100, 100);
    }

    ctx.beginPath();
    ctx.strokeStyle = '#FDFBF3';
    ctx.lineWidth = 8 / scale;
    ctx.setLineDash([]);
    ctx.moveTo(-64 / scale, 0);
    ctx.lineTo(64 / scale, 0);
    ctx.moveTo(0, -64 / scale);
    ctx.lineTo(0, 64 / scale);
    ctx.stroke();
  }
}
