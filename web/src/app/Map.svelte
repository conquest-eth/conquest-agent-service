<script lang="ts">
  import {onMount} from 'svelte';
  import Map from '../map';
  import {Camera} from '../map/camera';
  import {Renderer} from '../map/renderer';
  import {RenderState} from '../map/RenderState';
  import {space} from './mapState';

  let canvas: HTMLCanvasElement;
  onMount(() => {
    const renderState = new RenderState(space);
    const renderer = new Renderer(renderState);
    const camera = new Camera(renderState);
    const map = new Map(renderer, camera);
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
