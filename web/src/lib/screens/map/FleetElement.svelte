<script lang="ts">
  import {account} from '$lib/account/account';
  import {camera} from '$lib/map/camera';
  import {timeToText} from '$lib/utils';
  import {clickOutside} from '$lib/utils/clickOutside';
  import type {Fleet} from '$lib/space/fleets';
  import {onMount} from 'svelte';
  import {spaceInfo} from '$lib/space/spaceInfo';
  import {time} from '$lib/time';
  import {planets} from '$lib/space/planets';
  import {playersQuery} from '$lib/space/playersQuery';
  export let fleet: Fleet;

  $: x1 = fleet.from.location.globalX;
  $: y1 = fleet.from.location.globalY;
  $: x2 = fleet.to.location.globalX;
  $: y2 = fleet.to.location.globalY;
  $: angle = Math.atan2(y2 - y1, x2 - x1);

  $: ratio = Math.max(0, (fleet.duration - fleet.timeLeft) / fleet.duration);

  $: x = x1 + (x2 - x1) * ratio;
  $: y = y1 + (y2 - y1) * ratio;

  $: scale = $camera ? $camera.renderScale : 1;

  // $: console.log({scale});

  let showLine = true;
  let color;
  let isShow = false;
  let lineColor = fleet.gift ? '#34D399' : 'red';
  $: if (fleet.state === 'SEND_BROADCASTED') {
    color = 'orange';
  } else if (fleet.state === 'LOADING') {
    color = '#FFFFFF';
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

  // TODO investigate why there is need to check sendFlow.data.from ? might need to do the same to sendFlow.data.to below
  $: fromPlanetInfo = spaceInfo.getPlanetInfo(fleet.from.location.x, fleet.from.location.y);
  $: fromPlanetState = fromPlanetInfo && planets.planetStateFor(fromPlanetInfo);

  $: toPlanetInfo = spaceInfo.getPlanetInfo(fleet.to.location.x, fleet.to.location.y);
  $: toPlanetState = planets.planetStateFor(toPlanetInfo);

  $: toPlayer = $playersQuery.data?.players[$toPlanetState?.owner];
  $: fromPlayer = $playersQuery.data?.players[$fromPlanetState?.owner];

  let prediction:
    | {
        arrivalTime: string;
        numSpaceshipsAtArrival: {max: number; min: number};
        outcome: {
          min: {captured: boolean; numSpaceshipsLeft: number};
          max: {captured: boolean; numSpaceshipsLeft: number};
          allies: boolean;
          giving?: {tax: number; loss: number};
          timeUntilFails: number;
        };
      }
    | undefined = undefined;
  $: {
    if (toPlanetState && fromPlanetState) {
      prediction = {
        arrivalTime: timeToText(spaceInfo.timeToArrive(fromPlanetInfo, toPlanetInfo)),
        numSpaceshipsAtArrival: spaceInfo.numSpaceshipsAtArrival(fromPlanetInfo, toPlanetInfo, $toPlanetState),
        outcome: spaceInfo.outcome(
          fromPlanetInfo,
          $fromPlanetState,
          toPlanetInfo,
          $toPlanetState,
          fleet.quantity,
          Math.min($time - fleet.launchTime, fleet.duration),
          fromPlayer,
          toPlayer,
          fleet.gift,
          fleet.specific
        ),
      };
    }
  }

  $: lineColor = prediction.outcome.giving ? '#34D399' : 'red';
</script>

{#if fleet.state === 'READY_TO_RESOLVE'}
  <svg
    viewBox="0 0 400 400"
    width={10}
    y={10}
    style={`position: absolute; z-index: 51; overflow: visible; transform: translate(${x - 4}px,${y - 3}px) ;`}
  >
    <path
      id="motionPath"
      fill="none"
      d="
        M 150, 100
        m -75, 0
        a 75,75 0 1,0 150,0
        a 75,75 0 1,0 -150,0
        "
    />

    <path
      id={fleet.txHash}
      on:click={() => (isShow = !isShow)}
      style={`transform: rotate(${angle}rad); cursor: pointer; `}
      d="M150 0 L75 200 L225 200 Z"
      fill={color}
    />

    <animateMotion
      xlink:href={'#' + fleet.txHash}
      dur="2s"
      begin="0s"
      fill="freeze"
      repeatCount="indefinite"
      rotate="auto-reverse"
    >
      <mpath xlink:href="#motionPath" />
    </animateMotion>
  </svg>
{:else}
  <svg
    viewBox="0 0 1 1 "
    width={(400 / scale) * 6}
    height={(400 / scale) * 6}
    style={`position: absolute; z-index: 3; overflow: visible; transform: translate(${x}px,${y}px); height: 1px; width: 1px`}
  >
    <!-- <g style={`transform: scale(${scale});`} > -->
    <!-- svelte-ignore a11y-mouse-events-have-key-events -->
    <path
      on:click={() => (isShow = !isShow)}
      style={`transform: rotate(${angle}rad); cursor: pointer; z-index: 99 `}
      d="M -5 -2.5 L 0 0 L -5 2.5 z"
      fill={color}
    />

    <!-- </g> -->
  </svg>
{/if}
{#if isShow}
  <!-- svelte-ignore a11y-mouse-events-have-key-events -->
  <div
    use:clickOutside
    on:click_outside={() => (isShow = false)}
    class="w-24 bg-gray-900 bg-opacity-80 text-cyan-300 border-2 border-cyan-300"
    style={`font-size: 9px;
      transform-origin: top left;
       position: absolute; z-index: 99; overflow: visible; transform: translate(${x}px,${y}px) scale(${2 / scale})`}
  >
    <ul class="text-white">
      <li><span class="text-yellow-300">from:</span> {fleet.from.stats.name}</li>
      <li><span class="text-yellow-300">to:</span> {fleet.to.stats.name}</li>
      <li><span class="text-yellow-300">spaceships:</span> {fleet.quantity}</li>
      <li>
        <span class="text-yellow-300">Duration:</span>
        {timeToText(fleet.duration)}
      </li>
      <li><span class="text-yellow-300">Time left:</span> {timeToText(fleet.timeLeft)}</li>
      {#if prediction}
        <li>
          {#if prediction.outcome.giving}
            <span class="text-green-500">Reinforcement...</span>
          {:else if prediction.outcome.min.captured}
            <span class="text-green-500">Will capture </span>
          {:else}
            <!-- <span class="text-red-500">No Capture</span> -->
          {/if}
        </li>
        <li>
          {#if prediction.outcome.giving}
            <span
              class={prediction.outcome.giving || prediction.outcome.min.captured ? `text-green-500` : `text-red-500`}
              >spaceships: {prediction.outcome.min.numSpaceshipsLeft}</span
            >
          {:else if prediction.outcome.min.captured}
            <span
              class={prediction.outcome.giving || prediction.outcome.min.captured ? `text-green-500` : `text-red-500`}
              >spaceships: {prediction.outcome.min.numSpaceshipsLeft}</span
            >
          {:else}
            <span
              class={prediction.outcome.giving || prediction.outcome.min.captured ? `text-green-500` : `text-red-500`}
              >damage: {prediction.numSpaceshipsAtArrival.min - prediction.outcome.min.numSpaceshipsLeft}</span
            >
            <span
              class={prediction.outcome.giving || prediction.outcome.min.captured ? `text-green-500` : `text-red-500`}
              >spaceships: {prediction.outcome.min.numSpaceshipsLeft}</span
            >
          {/if}
        </li>
      {/if}
    </ul>
  </div>
{/if}

{#if showLine}
  <svg style={`position: absolute; z-index: 2; overflow: visible;`}>
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
    <line
      marker-end="url(#triangle)"
      style="z-index: 1;"
      stroke-width={`${4 / scale}px`}
      stroke={lineColor}
      {x1}
      {y1}
      {x2}
      {y2}
    />
  </svg>
{/if}
