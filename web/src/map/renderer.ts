import planetsFrame from '../assets/planets.json';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
///@ts-ignore
import planetsDataURL from '../assets/planets.png';
import type {CameraSetup, WorldSetup} from './camera';
import type {RenderState} from './RenderState';
import {hmrClass} from '../lib/utils/hmr';
import type {Controller} from './controller';

// pre-render
const planetSpriteSheet = new Image();
planetSpriteSheet.src = planetsDataURL;
const horizPattern = document.createElement('canvas');
horizPattern.width = 48;
horizPattern.height = 1;
let pctx: CanvasRenderingContext2D = horizPattern.getContext(
  '2d'
) as CanvasRenderingContext2D;
pctx.fillStyle = '#4F487A';
pctx.fillRect(0, 0, 2, 1);
pctx.fillRect(6, 0, 36, 1);
pctx.fillRect(46, 0, 2, 1);
const vertPattern = document.createElement('canvas');
vertPattern.width = 1;
vertPattern.height = 48;
pctx = vertPattern.getContext('2d') as CanvasRenderingContext2D;
pctx.fillStyle = '#4F487A';
pctx.fillRect(0, 0, 1, 2);
pctx.fillRect(0, 6, 1, 36);
pctx.fillRect(0, 46, 1, 2);

const planetTypesToFrame = [
  'Baren.png',
  'Baren.png',
  'Tech_2.png',
  'Baren.png',
  'Barren_2.png',
  'Tech_2.png',
  'Jungle48.png',
  'Jungle48.png',
  'Tundra.png',
  'Baren.png',
  'Desert.png',
  'Tech_2.png',
  'Barren_2.png',
  'Ocean_1.png',
  'Desert_2.png',
  'Jungle48.png',
  'Forest.png',
  'Terran_1.png',
  'Ice.png',
  'Ice.png',
  'Gas_1.png',
  'Ice.png',
  'Lava_1.png',
  'Terran_2.png',
  'Tech_1.png',
  'Ocean.png',
  'Terran.png',
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
): {x1: number; y1: number; x2: number; y2: number} | null {
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
  } else if (bottom) {
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

@hmrClass
export class Renderer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private hPattern: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private vPattern: any;

  private controller: Controller = (undefined as unknown) as Controller; // Force as setup need to be called

  private lastCamera: WorldSetup = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    zoom: 0,
  };
  private lastRenderStateChangeCounter = 0;

  constructor(private renderState: RenderState) {
    // TODO remove:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).renderState = this.renderState;
  }

  setup(ctx: CanvasRenderingContext2D, controller: Controller): void {
    this.controller = controller;
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

    const timeMs = Date.now();

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

    // used to be gridLevel < 10
    const showGrid = gridLevel < 4;
    if (showGrid) {
      // console.log(JSON.stringify({gridLevel, gridSize, nextLevelGridSize}));

      // console.log(offset, camera);
      // console.log({lineWidth,gridStart, gridOffset, gridSize, canvasWidth: canvas.width, canvasHeight: canvas.height, zoom: camera.zoom});

      // const ln = '#000000';
      // const l0 = '#28304c';
      // const l1 = '#323b5e';
      // const l2 = '#3e4974';
      // const l3 = '#4f5d94';
      const ln = '#000000';
      const l0 = '#151515';
      const l1 = '#202020';
      const l2 = '#252525';
      const l3 = '#303030';
      // eslint-disable-next-line no-inner-declarations
      function setColor(x: number) {
        if (gridSize == 48) {
          if (Math.floor(x / (8 * 48)) == x / (8 * 48)) {
            ctx.strokeStyle = l3; //"#6c7fc9";
          } else if (Math.floor(x / (4 * 48)) == x / (4 * 48)) {
            ctx.strokeStyle = l2; //"#5665a1";
          } else if (Math.floor(x / (2 * 48)) == x / (2 * 48)) {
            ctx.strokeStyle = l1; //"#434f7d";
          } else if (Math.floor(x / (1 * 48)) == x / (1 * 48)) {
            ctx.strokeStyle = l0; //"#323b52";
          } else {
            ctx.strokeStyle = ln;
          }
        } else if (gridSize == 2 * 48) {
          if (Math.floor(x / (8 * 48)) == x / (8 * 48)) {
            ctx.strokeStyle = l2; //"#6c7fc9";
          } else if (Math.floor(x / (4 * 48)) == x / (4 * 48)) {
            ctx.strokeStyle = l1; //"#5665a1";
          } else if (Math.floor(x / (2 * 48)) == x / (2 * 48)) {
            ctx.strokeStyle = l0; //"#434f7d";
          } else {
            ctx.strokeStyle = ln;
          }
        } else if (gridSize == 4 * 48) {
          if (Math.floor(x / (8 * 48)) == x / (8 * 48)) {
            ctx.strokeStyle = l1; //"#6c7fc9";
          } else if (Math.floor(x / (4 * 48)) == x / (4 * 48)) {
            ctx.strokeStyle = l0; //"#5665a1";
          } else {
            ctx.strokeStyle = ln;
          }
        } else if (gridSize == 8 * 48) {
          if (Math.floor(x / (8 * 48)) == x / (8 * 48)) {
            ctx.strokeStyle = l0; //"#5665a1";
          } else {
            ctx.strokeStyle = ln;
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

    const x1 = Math.max(
      leftX,
      Math.round(this.renderState.space.discovered.x1 * 8 * 48 - 48 * 4)
    );
    const x2 = Math.min(
      leftX + camera.width,
      Math.round(this.renderState.space.discovered.x2 * 8 * 48 + 48 * 4)
    );
    const y1 = Math.max(
      topY,
      Math.round(this.renderState.space.discovered.y1 * 8 * 48 - 48 * 4)
    );
    const y2 = Math.min(
      topY + camera.height,
      Math.round(this.renderState.space.discovered.y2 * 8 * 48 + 48 * 4)
    );
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = showGrid ? '#444444' : '#353535'; //'#034c4c'; // '#90e1e7'; //'#a5f3fc'; // '#67e8f9';
    ctx.setLineDash([]);

    if (x1 != leftX) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1, y2);
      ctx.stroke();
    }

    if (x2 != leftX + camera.width) {
      ctx.beginPath();
      ctx.moveTo(x2, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    if (y1 != topY) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y1);
      ctx.stroke();
    }

    if (y2 != topY + camera.height) {
      ctx.beginPath();
      ctx.moveTo(x1, y2);
      ctx.lineTo(x2, y2);
      ctx.stroke();
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
        const planet = this.renderState.space.planetAt(x, y);
        if (planet) {
          const frameType =
            planetTypesToFrame[planet.type % planetTypesToFrame.length];
          if (!frameType) {
            throw new Error(`no frame type for ${planet.type}`);
          }
          // if (planet.state && !planet.state.inReach) {
          //   frameType = frameType.slice(0, frameType.length - 4) + '_cloud.png';
          // }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const frameInfo = (planetsFrame.frames as any)[frameType];
          if (!frameInfo) {
            throw new Error(`not frameInfo for ${frameType}`);
          }
          const lavaFrame = frameInfo.frame;
          // console.log(planet)
          ctx.imageSmoothingEnabled = false;
          const planetX = planet.location.globalX * 2 * 48;
          const planetY = planet.location.globalY * 2 * 48;

          const numStars = 1 + Math.floor(planet.stats.stake / 25);

          const multiplier = planet.stats.production / 3600; // Math.max(planet.stats.stake / 16, 1 / 2);
          ctx.drawImage(
            planetSpriteSheet,
            lavaFrame.x,
            lavaFrame.y,
            lavaFrame.w,
            lavaFrame.h,
            Math.round(planetX - (48 * multiplier) / 2),
            Math.round(planetY - (48 * multiplier) / 2),
            48 * multiplier,
            48 * multiplier
          );

          let exitRatio = Number.MAX_SAFE_INTEGER;

          let circleColor = undefined;
          let circleDash: number[] = [];
          let circleRotate = false;
          if (planet.loaded) {
            if (
              planet.state?.owner !==
              '0x0000000000000000000000000000000000000000'
            ) {
              if (this.renderState.space.player) {
                if (
                  // TODO enforce convention to not need `toLowerCase` overhead
                  planet.state?.owner.toLowerCase() ===
                  this.renderState.space.player.toLowerCase()
                ) {
                  circleColor = '#34D399';
                } else if (
                  planet.state?.owner !==
                  '0x0000000000000000000000000000000000000000'
                ) {
                  circleColor = '#DC2626';
                } else {
                  circleColor = undefined;
                }
              } else {
                if (
                  planet.state?.owner !==
                  '0x0000000000000000000000000000000000000000'
                ) {
                  circleColor = '#E5E7EB';
                } else {
                  circleColor = '#E5E7EB';
                }
              }
              // TODO : productionEnabled // see OuterSpace.sol : can use owner and numSpaceships
              // if (planet.state.stake == '0') {
              //   // TODO BigNumber ?
              //   circleDash = [2, 10];
              // }
            }

            if (planet.state?.active) {
              // TODO ?
              if (planet.state.exiting) {
                exitRatio =
                  (this.renderState.space.spaceInfo.exitDuration -
                    planet.state.exitTimeLeft) /
                  this.renderState.space.spaceInfo.exitDuration;
              }
            } else {
              if (
                planet.state?.owner !==
                '0x0000000000000000000000000000000000000000'
              ) {
                circleDash = [15, 5];
                if (this.renderState.space.player) {
                  if (
                    // TODO enforce convention to not need `toLowerCase` overhead
                    planet.state?.owner.toLowerCase() ===
                    this.renderState.space.player.toLowerCase()
                  ) {
                    circleColor = '#10B981';
                  } else {
                    circleColor = '#DC2626';
                  }
                } else {
                  circleColor = '#E5E7EB';
                }
              }
            }
          } else {
            circleColor = '#E5E7EB'; // TODO remove
            circleDash = [5, 15];
            circleRotate = true;
          }

          // circleColor = '#E5E7EB'; // TODO remove

          if (circleColor) {
            ctx.beginPath();
            ctx.setLineDash(circleDash);
            if (circleColor === '#E5E7EB') {
              ctx.lineWidth = 1 / render.scale;
            } else {
              ctx.lineWidth = 1 / render.scale;
            }

            ctx.strokeStyle = circleColor;
            ctx.ellipse(
              Math.round(planetX),
              Math.round(planetY),
              72 * multiplier,
              72 * multiplier,
              circleRotate ? time / 500 : 0,
              0,
              2 * Math.PI
            );
            ctx.stroke();
          }

          if (this.controller.selectedPlanet === planet.location.id) {
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = '#67e8f9';
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.rect(
              Math.round(planetX) - (200 * Math.sqrt(multiplier)) / 2,
              Math.round(planetY) - (200 * Math.sqrt(multiplier)) / 2,
              200 * Math.sqrt(multiplier),
              200 * Math.sqrt(multiplier)
            );
            ctx.stroke();
          }

          // for (let star = 0; star < numStars; i++) {

          // }

          if (exitRatio < 1) {
            ctx.beginPath();
            ctx.setLineDash([]);
            ctx.lineWidth = 1 / render.scale;
            ctx.strokeStyle = 'orange';
            ctx.ellipse(
              Math.round(planetX),
              Math.round(planetY),
              84,
              84,
              circleRotate ? time / 500 : 0,
              -Math.PI / 2,
              -Math.PI / 2 + 2 * Math.PI * Math.max(exitRatio, 0.03)
            );
            ctx.stroke();
          }

          // if (planet.exitTime) // TODO
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

    ctx.setLineDash([]);
    const fleets = this.renderState.space.getOwnFleets();
    for (const fleet of fleets) {
      if (this.renderState.space.isTxPerformed(fleet.resolveTxHash)) {
        continue;
      }
      const fromX = fleet.from.x;
      const fromY = fleet.from.y;
      const fromPlanet = this.renderState.space.ensurePlanetAt(fromX, fromY);
      const toX = fleet.to.x;
      const toY = fleet.to.y;
      const toPlanet = this.renderState.space.ensurePlanetAt(toX, toY);

      const gFromX = fromPlanet.location.globalX;
      const gFromY = fromPlanet.location.globalY;
      const gToX = toPlanet.location.globalX;
      const gToY = toPlanet.location.globalY;

      const destX = gToX * 2 * 48;
      const destY = gToY * 2 * 48;

      const dirX = (gToX - gFromX) / Math.abs(gToX - gFromX);
      const dirY = (gToY - gFromY) / Math.abs(gToY - gFromY);
      const fGx1 = gFromX * 2 * 48 + dirX * 48;
      const fGy1 = gFromY * 2 * 48 + dirY * 48;
      const fGx2 = destX - dirX * 48;
      const fGy2 = destY - dirY * 48;

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
        ctx.strokeStyle = '#67e8f9'; //'#FDFBF3';
        ctx.lineWidth = 8 / scale;
        ctx.moveTo(segment.x1, segment.y1);
        // TODO dash for past
        ctx.lineTo(segment.x2, segment.y2);
        ctx.stroke();
      }

      const speed = fromPlanet.stats.speed;
      const fullDistance = Math.floor(
        Math.sqrt(Math.pow(gToX - gFromX, 2) + Math.pow(gToY - gFromY, 2))
      );
      const fullTime =
        fullDistance *
        ((this.renderState.space.spaceInfo.timePerDistance * 10000) / speed) *
        1000;
      const timePassed = timeMs - fleet.launchTime * 1000;
      let ratio = timePassed / fullTime;
      let fx;
      let fy;
      const timeLeft = fullTime - timePassed;
      let facingAngle;
      if (timePassed > fullTime) {
        const angle = (timePassed - fullTime) / 2000;
        const orbit = 48 * 2;
        fx = destX + Math.cos(angle) * orbit;
        fy = destY + Math.sin(angle) * orbit;
        facingAngle = angle - Math.PI;
        ratio = 1;
      } else {
        // const distance = (timePassed * speed) / (10000 * 3600);
        fx = fGx1 + (fGx2 - fGx1) * ratio;
        fy = fGy1 + (fGy2 - fGy1) * ratio;
        // if inside rect
        // ctx.beginPath();
        // ctx.moveTo( bottom-left corner );
        // ctx.lineTo( bottom-right corner );
        // ctx.closePath(); // automatically moves back to bottom left corner
        // ctx.fill();

        const dx = fx - fGx1;
        const dy = fy - fGy1;
        facingAngle = Math.atan2(dy, dx);

        if (camera.zoom > 0.25) {
          ctx.font = '48px serif';
          ctx.fillStyle = '#E5E7EB';
          ctx.fillText(`${Math.floor(timeLeft / 1000)}s`, fx - 24, fy - 80);
        }
      }
      ctx.fillStyle = '#34D399';
      // ctx.fillRect(fx - 50, fy - 50, 100, 100);
      const headlen = 64 / scale; // length of head in pixels

      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(
        fx - headlen * Math.cos(facingAngle - Math.PI / 6),
        fy - headlen * Math.sin(facingAngle - Math.PI / 6)
      );
      ctx.lineTo(
        fx - headlen * Math.cos(facingAngle + Math.PI / 6),
        fy - headlen * Math.sin(facingAngle + Math.PI / 6)
      );
      ctx.lineTo(fx, fy);
      ctx.closePath();
      ctx.fill();
    }

    // ctx.beginPath();
    // ctx.strokeStyle = '#FDFBF3';
    // ctx.lineWidth = 8 / scale;
    // ctx.setLineDash([]);
    // ctx.moveTo(-64 / scale, 0);
    // ctx.lineTo(64 / scale, 0);
    // ctx.moveTo(0, -64 / scale);
    // ctx.lineTo(0, 64 / scale);
    // ctx.stroke();
  }
}
