<script lang="ts">
  import {spaceInfo} from '$lib/space/spaceInfo';
  import PlanetElement from './PlanetElement.svelte';
  import {camera} from '$lib/map/camera';
  import spaceBackground from '../../../assets/Red3.png';

  $: gridTickness = $camera ? Math.min(0.4, 1 / $camera.renderScale) : 0.4;
</script>

<div
  style={`
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
  position: absolute;
  width:150%; height: 150%;
  top: -25%;
  left: -25%;
  opacity: ${$camera ? Math.max(0.2, Math.min(0.4, 1 - $camera.renderScale / 10)) : 0};
  background-image: url(${spaceBackground});
  background-position: ${($camera ? $camera.renderX * 1.5 : 0) - 2}px ${($camera ? $camera.renderY * 1.5 : 0) - 2}px;
  `}
  />
  <div
    style={`
    position: absolute;
    transform:
    translate(${$camera ? $camera.renderX : 1}px,${$camera ? $camera.renderY : 1}px);
    width:100%; height: 100%;
    `}
  >
    {#each $spaceInfo as planetInfo (planetInfo.location.id)}
      <PlanetElement {planetInfo} />
    {/each}
  </div>
</div>
