<script lang="ts">
  import {spaceView} from '$lib/space/spaceInfo';
  import PlanetElement from './PlanetElement.svelte';
  import {camera} from '$lib/map/camera';
  import spaceBackground from '../../../assets/Red3.png';
  import {base} from '$app/paths';
  import { fleets } from '$lib/space/fleets';
  import FleetElement from './FleetElement.svelte';
  import { spaceQueryWithPendingActions } from '$lib/space/optimisticSpace';
  import {myevents} from '$lib/space/myevents';

  $: gridTickness = $camera ? Math.min(0.4, 1 / $camera.renderScale) : 0.4;

  $: x1 = ($spaceQueryWithPendingActions.queryState.data?.space.x1 || -16) * 4 - 2; // TODO sync CONSTANTS with thegraph and contract
  $: x2 = ($spaceQueryWithPendingActions.queryState.data?.space.x2 || 16) * 4 + 2;
  $: y1 = ($spaceQueryWithPendingActions.queryState.data?.space.y1 || -16) * 4 -2;
  $: y2 = ($spaceQueryWithPendingActions.queryState.data?.space.y2 || 16) * 4 + 2;

</script>

<div
  style={`
  /* pointer-events: none; */
position: absolute;
transform: scale(${$camera ? $camera.renderScale : 1},${$camera ? $camera.renderScale : 1});
width:100%; height: 100%;
  ${
    $camera && $camera.zoom >= 10
      ? `
    background-size: 4px 4px;
    /*background-image: linear-gradient(to right, grey ${gridTickness}px, transparent ${gridTickness}px),
    linear-gradient(to bottom, grey ${gridTickness}px, transparent ${gridTickness}px);
    background-position: ${($camera ? $camera.renderX : 0) - 2}px ${($camera ? $camera.renderY : 0) - 2}px;*/
    background-image: radial-gradient(circle, #CCCCCC ${gridTickness}px, rgba(0.8, 0.8, 0.8, 0) ${gridTickness}px);
    background-position: ${$camera ? $camera.renderX : 0}px ${$camera ? $camera.renderY : 0}px;
  `
      : ``
  }

     /* background-color: black;
    background-image: radial-gradient(white, rgba(255, 255, 255, 0.2) 2px, transparent 40px),
      radial-gradient(white, rgba(255, 255, 255, 0.15) 1px, transparent 30px),
      radial-gradient(white, rgba(255, 255, 255, 0.1) 2px, transparent 40px),
      radial-gradient(rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.1) 2px, transparent 30px);
    background-size: 550px 550px, 350px 350px, 250px 250px, 150px 150px;
    background-position: ${($camera ? $camera.renderX : 0) - 2}px ${($camera ? $camera.renderY : 0) - 2}px;*/
`}
>
  <div
    style={`
    pointer-events: none;
    position: absolute;
    transform:
    translate(${$camera ? $camera.renderX : 1}px,${$camera ? $camera.renderY : 1}px);
    width:100%; height: 100%;
    `}
  >
    {#each $spaceView as planetInfo (planetInfo.location.id)}
      <PlanetElement {planetInfo} />
    {/each}

    {#each $fleets as fleet}
      <FleetElement {fleet} />
    {/each}

    {#each $myevents as event}
      <!-- <FleetElement {event} /> -->
    {/each}

    <!-- <svg style={`position: absolute; z-index: 50; overflow: visible;`}>
      <rect x={x1-500} y={y2} width={1000} height={1000} fill="black" fill-opacity="0.5"/>
    </svg>
    <svg style={`position: absolute; z-index: 50; overflow: visible;`}>
      <rect x={x1-500} y={y1-1000} width={1000} height={1000} fill="black" fill-opacity="0.5"/>
    </svg>
    <svg style={`position: absolute; z-index: 50; overflow: visible;`}>
      <rect x={x2} y={y1} width={1000} height={y2-y1} fill="black" fill-opacity="0.5"/>
    </svg>
    <svg style={`position: absolute; z-index: 50; overflow: visible;`}>
      <rect x={x1-1000} y={y1} width={1000} height={y2-y1} fill="black" fill-opacity="0.5"/>
    </svg> -->


    <svg style={`pointer-events: none; position: absolute; z-index: 50; overflow: visible;`}>
      <defs>
        <clipPath id="space">
          <rect x={x1} y={y1} width={x2-x1} height={y2-y1} />
        </clipPath>
        <mask id="myMask">
          <rect x={x1-1000000} y={y1-1000000} width={(x2-x1) + 2000000} height={(y2-y1) + 2000000} fill="white" />
          <rect x={x1} y={y1} width={x2-x1} height={y2-y1} fill="black"/>
        </mask>
      </defs>


      <!-- <rect x={x1-1000} y={y1-1000} width={(x2-x1) + 2000} height={(y2-y1) + 2000} fill="black" fill-opacity="0.6" clip-path="url(#space)" /> -->
      <rect x={x1-1000000} y={y1-1000000} width={(x2-x1) + 2000000} height={(y2-y1) + 2000000} fill="black" fill-opacity="0.4" mask="url(#myMask)" />
    </svg>


    <svg style={`pointer-events: none; position: absolute; z-index: 50; overflow: visible;`}>
      <rect x={x1} y={y1} width={x2-x1} height={y2-y1} stroke="white" stroke-opacity="0.5" fill="none" stroke-dasharray="2 10" />
    </svg>

    <!-- <svg style={`position: absolute; z-index: 50; overflow: visible;`}>
      <line stroke-width="1px" stroke="blue"  x1={x1} y1={y1} x2={x2} y2={y1}/>
    </svg>
    <svg style={`position: absolute; z-index: 50; overflow: visible;`}>
      <line stroke-width="1px" stroke="blue"  x1={x2} y1={y1} x2={x2} y2={y2}/>
    </svg>
    <svg style={`position: absolute; z-index: 50; overflow: visible;`}>
      <line stroke-width="1px" stroke="blue"  x1={x2} y1={y2} x2={x1} y2={y2}/>
    </svg>
    <svg style={`position: absolute; z-index: 50; overflow: visible;`}>
      <line stroke-width="1px" stroke="blue"  x1={x1} y1={y2} x2={x1} y2={y1}/>
    </svg> -->
  </div>


  <div
    style={`
    pointer-events: none;
  position: absolute;
  width:150%; height: 150%;
  top: -25%;
  left: -25%;
  opacity: ${$camera ? Math.max(0.2, Math.min(0.4, 1 - $camera.renderScale / 10)) : 0};
  background-image: url(${base}${spaceBackground});
  background-position: ${($camera ? $camera.renderX * 1.5 : 0) - 2}px ${($camera ? $camera.renderY * 1.5 : 0) - 2}px;
  `}
  />
</div>
