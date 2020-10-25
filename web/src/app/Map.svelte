<script lang="ts">
  import {onMount} from 'svelte';
  import Map from '../map';

  let canvas;
  onMount(() => {
    const map = new Map();
    return map.setup(canvas);
  });
</script>

<style>
  canvas {
    width: 100%;
    height: 100%;
    position: absolute;
    background-color: #1f253a; /*#272e49;*/
    image-rendering: -moz-crisp-edges;
    image-rendering: -webkit-crisp-edges;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }
</style>

<canvas bind:this={canvas} />
