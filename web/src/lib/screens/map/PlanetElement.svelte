<script lang="ts">
  export let planetInfo: PlanetInfo;

  import planetsFrame from '../../../assets/planets.json';
  import planetsImageURL from '../../../assets/planets.png';
  import type {PlanetInfo} from 'conquest-eth-common';
  import {camera} from '$lib/map/camera';
  // import {onDestroy, onMount} from 'svelte';

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

  let frameType: string;
  if (!frameType) {
    frameType = planetTypesToFrame[planetInfo.type % planetTypesToFrame.length];
    if (!frameType) {
      throw new Error(`no frame type for ${planetInfo.type}`);
    }
  }
  const frameInfo = (planetsFrame.frames as any)[frameType] as {frame: Frame};
  const frame = frameInfo.frame;
  const x = planetInfo.location.globalX - 24;
  const y = planetInfo.location.globalY - 24;
</script>

<div
  style={`position: absolute; transform: translate(${x}px,${y}px) scale(0.04,0.04); background: url(${planetsImageURL}); background-position: ${-frame.x}px ${-frame.y}px; width: ${
    frame.w
  }px; height: ${frame.h}px;
  `}
  data={`${planetInfo.location.x}, ${planetInfo.location.y}`}
/>

<!-- <div class="text-red-600" style={`position: absolute; left: ${x}px; top: ${y}px;`}>a</div> -->

<!-- <div
  style={`position: absolute; left: ${x}px; top: ${y}px; background: url(${planetsImageURL}); background-position: ${
    -frame.x / planetsFrame.meta.size.w
  }% ${-frame.y / planetsFrame.meta.size.h}%; width: ${frame.w / 2}px; height: ${frame.h / 2}px;
  background-size: 50% 50%
  `}
/> -->

<!-- zoom:0.5; -moz-transform:scale(0.5); -moz-transform-origin: 0 0; -->
<!-- background-size: ${Math.floor(frame.w / 1)}px ${Math.floor(frame.h / 1)}px -->
