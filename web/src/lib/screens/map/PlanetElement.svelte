<script lang="ts">
  export let planetInfo: PlanetInfo;

  import planetsFrame from '../../../assets/planets.json';
  import planetsImageURL from '../../../assets/planets.png';
  import type {PlanetInfo} from 'conquest-eth-common';
  import SharedBlockie from './SharedBlockie.svelte';
  import {camera} from '$lib/map/camera';
  import {planets} from '$lib/space/planets';
  import {base} from '$app/paths';
  import {wallet} from '$lib/blockchain/wallet';
  import selection from '$lib/map/selection';
  import {spaceInfo} from '$lib/space/spaceInfo';
  import {playersQuery} from '$lib/space/playersQuery';

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

  $: active = $planetState.active;

  const alliancesOffset = [-1, 1, 1, -1];

  $: ownerObject = $playersQuery.data?.players[owner];
  $: alliances = ownerObject ? ownerObject.alliances : [];

  // if (x > -20 * 4 && x < 20 * 4 && y > -20 * 4 && y < 20 * 4) {
  //   owner = '0x3333333333333333333333333333333333333333';
  // }

  $: renderScale = $camera ? $camera.renderScale : 1;

  let selectionBorder = 4;
  let adjustedRenderScale;
  let blockieScale = scale;
  let zoomIn = true;
  $: if (owner && renderScale < 10) {
    adjustedRenderScale = 10 / renderScale;
    blockieScale = scale * adjustedRenderScale;
    zoomIn = false;
    selectionBorder = 4;
  } else {
    selectionBorder = 4;
    zoomIn = true;
    blockieScale = scale;
    adjustedRenderScale = 1;
  }

  $: playerIsOwner = owner?.toLowerCase() === $wallet.address?.toLowerCase();

  $: capacityReached =
    spaceInfo.productionCapAsDuration &&
    spaceInfo.productionCapAsDuration > 0 &&
    $planetState.numSpaceships >=
      spaceInfo.acquireNumSpaceships +
        Math.floor(planetInfo.stats.production * spaceInfo.productionCapAsDuration) / (60 * 60);
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

  {#if $selection && $selection.x === planetInfo.location.x && $selection.y === planetInfo.location.y}
    <div
      style={`z-index: 5; position: absolute; transform: translate(${x}px,${y}px)  scale(${blockieScale * 3}, ${
        blockieScale * 3
      }); width: ${frame.w}px;
  height: ${frame.h}px;`}
    >
      <div
        style={`
width: ${frame.w}px;
height: ${frame.h}px;
border: ${selectionBorder}px solid white;
border-left-color: red;
border-radius: 50%;
animation-name: rotate-s-loader;
animation-iteration-count: infinite;
animation-duration: 1s;
animation-timing-function: linear;
`}
      />
    </div>
  {/if}

  {#if $planetState && $planetState.exiting}
    <div
      style={`z-index: 5; position: absolute; transform: translate(${x}px,${y}px) scale(${blockieScale * 3}, ${
        blockieScale * 3
      }); width: ${frame.w}px;
  height: ${frame.h}px;`}
    >
      <svg viewBox="0 0 36 36">
        <path
          style="fill: none; stroke-width: 2.8; stroke-linecap: round; stroke: #ff3300;"
          stroke-dasharray={`${Math.max(
            ((spaceInfo.exitDuration - $planetState.exitTimeLeft) / spaceInfo.exitDuration) * 100,
            3
          )} 100`}
          d="M18 2.0845
            a 15.9155 15.9155 0 0 1 0 31.831
            a 15.9155 15.9155 0 0 1 0 -31.831"
        />
      </svg>
    </div>
  {/if}

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
        pointer-events: none;
        z-index: 1;
        position: absolute;
        transform:
          translate(${x + 0.6 * multiplier}px,${y - 1.2 * multiplier}px)
          scale(${blockieScale}, ${blockieScale});
        width: ${frame.w}px; height: ${frame.h}px;
        outline: ${active ? 'solid ' + 0.25 / scale + 'px' : 'dashed ' + 0.12 / scale + 'px'} ${
          playerIsOwner ? (capacityReached ? 'red' : 'lime') : capacityReached ? 'white' : '#ddd'
        };
`}
        address={owner}
      />
    {:else}
      <SharedBlockie
        style={`
        pointer-events: none;
        z-index: 1;
        position: absolute;
        transform:
          translate(${x + 0 * multiplier}px,${y - 0 * multiplier}px)
          scale(${blockieScale}, ${blockieScale});
        width: ${frame.w}px; height: ${frame.h}px;
        outline: ${active ? 'solid ' + 0.25 / scale + 'px' : 'dashed ' + 0.12 / scale + 'px'} ${
          playerIsOwner ? (capacityReached ? 'red' : 'lime') : capacityReached ? 'white' : '#ddd'
        };
`}
        address={owner}
      />
    {/if}
  {/if}

  {#each alliances as alliance, i}
    {#if blockieScale <= scale}
      <SharedBlockie
        offset={1}
        style={`
        pointer-events: none;
        z-index: 1;
        position: absolute;
        transform:
          translate(${x + alliancesOffset[i % 4] * 1.6 * multiplier}px,${
          y + alliancesOffset[(i + 3) % 4] * 1.6 * multiplier
        }px)
          scale(${blockieScale * 1.5}, ${blockieScale * 1.5});
        width: ${frame.w}px; height: ${frame.h}px;
        border: solid ${0.1 / scale}px  ${alliance.ally ? 'lime' : 'white'};
        border-radius: ${frame.w}px;
`}
        address={alliance.address}
      />
    {:else}
      <SharedBlockie
        offset={1}
        style={`
        pointer-events: none;
        z-index: 1;
        position: absolute;
        transform:
          translate(${x + alliancesOffset[i % 4] * 1.6 * multiplier}px,${
          y + alliancesOffset[(i + 3) % 4] * 1.6 * multiplier
        }px)
          scale(${blockieScale * 1.5}, ${blockieScale * 1.5});
        width: ${frame.w}px; height: ${frame.h}px;
        border: solid ${0.1 / scale}px  ${alliance.ally ? 'lime' : 'white'};
        border-radius: ${frame.w}px;
`}
        address={alliance.address}
      />
    {/if}
  {/each}
</div>
