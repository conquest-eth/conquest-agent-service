<script lang="ts">
  import {camera} from '$lib/map/camera';
  import type {MyEvent} from '$lib/space/myevents';
  import {spaceInfo} from '$lib/space/spaceInfo';
  export let event: MyEvent;

  let planetInfo = spaceInfo.getPlanetInfoViaId(event.event.planet.id);
  let x = planetInfo.location.globalX - 48 / 2;
  let y = planetInfo.location.globalY - 48 / 2;

  const multiplier = planetInfo.stats.production / 3600; // Math.max(planet.stats.stake / 16, 1 / 2);
  const scale = 0.025 * multiplier;

  const color = event.type === 'external_fleet' ? 'red' : ' #10B981'; // TODO

  $: renderScale = $camera ? $camera.renderScale : 1;

  let selectionBorder = 4;
  let adjustedRenderScale;
  let blockieScale = scale;
  // let zoomIn = true;
  $: if (renderScale < 10) {
    adjustedRenderScale = 10 / renderScale;
    blockieScale = scale * adjustedRenderScale;
    // zoomIn = false;
    selectionBorder = 4;
  } else {
    selectionBorder = 4;
    // zoomIn = true;
    blockieScale = scale;
    adjustedRenderScale = 1;
  }

  async function acknowledge() {
    console.log(event);
    // account.acknowledgeEvent(event);
  }
</script>

<div
  id={event.event.fleet.id}
  on:click={acknowledge}
  style={`z-index: 5; position: absolute; transform: translate(${x}px,${y}px)  scale(${blockieScale * 3}, ${
    blockieScale * 3
  }); width: 48px; height: 48px;`}
>
  <div
    style={`
width: ${48}px;
height: ${48}px;
border: ${selectionBorder}px solid ${color};
animation-name: event-scale-up-down;
animation-iteration-count: infinite;
animation-duration: 1s;
animation-timing-function: linear;
`}
  />
</div>
