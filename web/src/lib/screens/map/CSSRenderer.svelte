<script lang="ts">
  import {spaceInfo} from '$lib/space/spaceInfo';
  import PlanetElement from './PlanetElement.svelte';
  import {camera} from '$lib/map/camera';
</script>

<!-- <div
  style={`transform: translate(${$camera ? $camera.renderX : 0}px,${$camera ? $camera.renderY : 0}px); zoom: ${
    $camera ? $camera.renderScale : 1
  }; width:100%; height: 100%; overflow: hidden;`}
> -->

<!-- kind of working -->
<!-- <div
  style={`transform: scale(${$camera ? $camera.renderScale : 1},${$camera ? $camera.renderScale : 1}) translate(${
    $camera ? $camera.renderX : 0
  }px,${$camera ? $camera.renderY : 0}px); width:100%; height: 100%; overflow: hidden;`}
> -->
<!-- --- -->

<!-- <div
  style={`transform:
  scale(${$camera ? $camera.renderScale : 1},${$camera ? $camera.renderScale : 1})
  translate(${$camera ? $camera.renderX + $camera.width / 2 : 0}px,${
    $camera ? $camera.renderY + $camera.height / 2 : 0
  }px); width:100%; height: 100%;`}
> -->

<div
  style={`transform:
  scale(${$camera ? $camera.renderScale : 1},${$camera ? $camera.renderScale : 1})
  translate(${$camera ? $camera.renderX : 0}px,${$camera ? $camera.renderY : 0}px);
  width:100%; height: 100%;
  border: 3px red solid;
  `}
>
  <!-- <div
  style={`scale: ${$camera ? $camera.renderScale : 1} ${$camera ? $camera.renderScale : 1}; translate: ${
    $camera ? -$camera.x + $camera.width / 2 : 0
  }px ${$camera ? -$camera.y + $camera.height / 2 : 0}px; width:100%; height: 100%; overflow: hidden;`}
> -->
  <!-- <div
  style={`transform: scale(${$camera ? $camera.renderScale : 1},${$camera ? $camera.renderScale : 1}) left:${
    $camera ? $camera.renderX : 0
  }px; top:${$camera ? $camera.renderY : 0}px;  overflow: hidden;`}
> -->
  <!-- <div> -->
  {#each $spaceInfo as planetInfo (planetInfo.location.id)}
    <!-- <p class="text-red-600">{planetInfo.location.x},{planetInfo.location.y}</p> -->
    <PlanetElement {planetInfo} />
  {/each}
</div>
