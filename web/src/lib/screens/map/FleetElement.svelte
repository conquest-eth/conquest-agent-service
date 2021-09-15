<script lang="ts">
  import {account} from '$lib/account/account';
  import {camera} from '$lib/map/camera';
  import type {Fleet} from '$lib/space/fleets';
  export let fleet: Fleet;

  const x1 = fleet.from.location.globalX;
  const y1 = fleet.from.location.globalY;
  const x2 = fleet.to.location.globalX;
  const y2 = fleet.to.location.globalY;
  const angle = Math.atan2(y2 - y1, x2 - x1);

  $: ratio = Math.max(0, (fleet.duration - fleet.timeLeft) / fleet.duration);

  $: x = x1 + (x2 - x1) * ratio;
  $: y = y1 + (y2 - y1) * ratio;

  $: scale = $camera ? $camera.renderScale : 1;

  // $: console.log({scale});

  async function acknowledge() {
    if (fleet.resolution) {
      if (fleet.resolution.status === 'SUCCESS') {
        account.acknowledgeSuccess(fleet.txHash);
        account.acknowledgeSuccess(fleet.resolution.id);
      } else if (fleet.resolution.status === 'FAILURE') {
        account.acknowledgeActionFailure(fleet.resolution.id);
      }
    } else {
      // TODO other failues ?
    }
  }

  let showLine = true;
  let color;
  $: if (fleet.state === 'SEND_BROADCASTED') {
    color = '#00FF00';
  } else if (fleet.state === 'TRAVELING') {
    color = '#00FF00';
  } else if (fleet.state === 'READY_TO_RESOLVE') {
    color = '#ff0000';
  } else if (fleet.state === 'TOO_LATE_TO_RESOLVE') {
    color = '#ff0000';
  } else if (fleet.state === 'RESOLVE_BROADCASTED') {
    color = '#0000ff';
    showLine = false;
  } else if (fleet.state === 'WAITING_ACKNOWLEDGMENT') {
    // fleet is not shown in that case, event take over, see myevents.ts
    color = '#00ff00';
    showLine = false;
  }
</script>

<svg
  on:click={acknowledge}
  style={`position: absolute; z-index: 51; overflow: visible; transform: translate(${x}px,${y}px)`}
>
  <!-- <g style={`transform: scale(${scale});`} > -->
  <path style={`transform: rotate(${angle}rad);`} d="M -5 -2.5 L 0 0 L -5 2.5 z" fill={color} />
  <!-- </g> -->
</svg>

{#if showLine}
  <svg style={`position: absolute; z-index: 50; overflow: visible;`}>
    <marker
      xmlns="http://www.w3.org/2000/svg"
      id="triangle"
      viewBox="0 0 10 10"
      refX="10"
      refY="5"
      fill="#FFFFFF"
      stroke="#34D399"
      markerUnits="strokeWidth"
      markerWidth="4"
      markerHeight="3"
      orient="auto"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" />
    </marker>
    <line marker-end="url(#triangle)" stroke-width={`${4 / scale}px`} stroke="#34D399" {x1} {y1} {x2} {y2} />
  </svg>
{/if}
