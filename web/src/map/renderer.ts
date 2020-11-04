import planetsFrame from '../assets/planets.json';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
///@ts-ignore
import planetsDataURL from '../assets/planets.png';
import {OuterSpace} from 'planet-wars-common';
import type {WorldSetup} from './camera';
const outerspace = new OuterSpace(
  '0xe0c3fa9ae97fc9b60baae605896b5e3e7cecb6baaaa4708162d1ec51e8d65a69'
); // TODO

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

export class Renderer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private hPattern: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private vPattern: any;

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

  render(ctx: CanvasRenderingContext2D, camera: WorldSetup): void {
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

    const gridStart = {
      x: Math.floor((camera.x - camera.width / 2) / gridSize) * gridSize,
      y: Math.floor((camera.y - camera.height / 2) / gridSize) * gridSize,
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
        const planet = outerspace.getPlanetStats({x, y});
        if (planet) {
          const lavaFrame =
            planetsFrame.frames[planetTypesToFrame[planet.type]].frame;
          // console.log(planet)
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            planetSpriteSheet,
            lavaFrame.x,
            lavaFrame.y,
            lavaFrame.w,
            lavaFrame.h,
            Math.round((x * 4 * 2 + planet.location.subX * 2) * 48 - 48 / 2),
            Math.round((y * 4 * 2 + planet.location.subY * 2) * 48 - 48 / 2),
            48,
            48
          );
        }
      }
    }

    ctx.beginPath();
    ctx.strokeStyle = '#FDFBF3';
    ctx.lineWidth = 8; // / scale;
    ctx.setLineDash([]);
    ctx.moveTo(-64, 0);
    ctx.lineTo(64, 0);
    ctx.moveTo(0, -64);
    ctx.lineTo(0, 64);
    ctx.stroke();
  }
}
