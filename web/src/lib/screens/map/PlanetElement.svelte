<script lang="ts">
  export let planetInfo: PlanetInfo;

  import planetsFrame from '../../../assets/planets.json';
  import planetsImageURL from '../../../assets/planets.png';
  import type {PlanetInfo} from 'conquest-eth-common';
  import SharedBlockie from './SharedBlockie.svelte';
  import {camera} from '$lib/map/camera';
  import {planets} from '$lib/space/planets';
  import {base} from '$app/paths';

  type Frame = {x: number; y: number; w: number; h: number};

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

  const planetState = planets.planetStateFor(planetInfo);

  let frameType: string;
  if (!frameType) {
    frameType = planetTypesToFrame[planetInfo.type % planetTypesToFrame.length];
    if (!frameType) {
      throw new Error(`no frame type for ${planetInfo.type}`);
    }
  }
  const frameInfo = (planetsFrame.frames as any)[frameType] as {frame: Frame};
  const frame = frameInfo.frame;
  const multiplier = planetInfo.stats.production / 3600; // Math.max(planet.stats.stake / 16, 1 / 2);
  const scale = 0.025 * multiplier;
  const x = planetInfo.location.globalX - frame.w / 2;
  const y = planetInfo.location.globalY - frame.h / 2;

  $: owner = $planetState?.owner;

  // if (x > -20 * 4 && x < 20 * 4 && y > -20 * 4 && y < 20 * 4) {
  //   owner = '0x3333333333333333333333333333333333333333';
  // }

  $: renderScale = $camera ? $camera.renderScale : 1;

  let adjustedRenderScale;
  let blockieScale = scale;
  let zoomIn = true;
  $: if (owner && renderScale < 10) {
    blockieScale = scale * (10 / renderScale);
    zoomIn = false;
    adjustedRenderScale = 10 / renderScale;
  } else {
    zoomIn = true;
    blockieScale = scale;
    adjustedRenderScale = 1;
  }
</script>

<div>
  {#if zoomIn}
    <div
      style={`position: absolute; transform: translate(${x}px,${y}px) scale(${scale}, ${scale}); background: url(${base}${planetsImageURL}); background-position: ${-frame.x}px ${-frame.y}px; width: ${
        frame.w
      }px; height: ${frame.h}px;
  `}
      data={`${planetInfo.location.x}, ${planetInfo.location.y} : ${planetInfo.stats.subX}, ${planetInfo.stats.subY} -| ${planetInfo.location.globalX}, ${planetInfo.location.globalY}`}
    />
  {/if}

  <!-- <div
    style={`
  width: ${frame.w}px;
  height: ${frame.h}px;
  animation-name: rotate-s-loader;
  animation-iteration-count: infinite;
  animation-duration: 1s;
  animation-timing-function: linear;
  `}
  >
    <div
      style={`
    position: absolute; transform: translate(${x}px,${y}px)  scale(${scale * 2}, ${scale * 2});
  width: ${frame.w}px;
  height: ${frame.h}px;
  border: 2px solid green;
  border-left-color: red;
  border-radius: 50%;
  background: transparent;
`}
    />
  </div> -->

  <!-- {#if planetInfo.location.x % 3 === 0 && planetInfo.location.y % 3 === 0}
    <div
      style={`position: absolute; transform: translate(${x}px,${y}px)  scale(${0.1 * adjustedRenderScale}, ${
        0.1 * adjustedRenderScale
      }); width: ${frame.w}px;
  height: ${frame.h}px;`}
    >
      <div
        style={`
width: ${frame.w}px;
height: ${frame.h}px;
border: ${1 + (6 / renderScale) * 2}px solid white;
border-left-color: red;
border-radius: 50%;
animation-name: rotate-s-loader;
animation-iteration-count: infinite;
animation-duration: 1s;
animation-timing-function: linear;
`}
      />
    </div>
  {/if} -->

  {#if owner}
    {#if blockieScale <= scale}
      <!-- <div
        style={`
        z-index: 1;
        position: absolute;
        transform:
          translate(${x + (0.6 - 0.1) * multiplier}px,${y - 0.9 * multiplier}px)
          scale(${blockieScale}, ${blockieScale * 1.5});
        border-left: ${0.25 / scale}px solid white;
        width: ${frame.w}px; height: ${frame.h}px;
  `}
      /> -->
      <SharedBlockie
        style={`
        z-index: 1;
        position: absolute;
        transform:
          translate(${x + 0.6 * multiplier}px,${y - 1.2 * multiplier}px)
          scale(${blockieScale}, ${blockieScale});
        width: ${frame.w}px; height: ${frame.h}px;
        outline: solid ${0.25 / scale}px white;
`}
        address={owner}
      />
    {:else}
      <SharedBlockie
        style={`
        z-index: 1;
        position: absolute;
        transform:
          translate(${x + 0 * multiplier}px,${y - 0 * multiplier}px)
          scale(${blockieScale}, ${blockieScale});
        width: ${frame.w}px; height: ${frame.h}px;
        outline: solid ${0.25 / scale}px white;
`}
        address={owner}
      />
    {/if}
  {/if}
</div>

<style>
  @keyframes -global-rotate-s-loader {
    from {
      transform: rotate(0);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
