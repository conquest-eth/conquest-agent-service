<script lang="ts">
  import {onMount} from 'svelte';
  import Map from '../map';
  import {Camera} from '../map/camera';
  import {Renderer} from '../map/renderer';
  import {PrivateSpaceImpl, SpaceInfoImpl, SpaceImpl} from 'planet-wars-common';
  import {RenderStateImpl} from '../map/RenderStateImpl';
  import {StateAdapterFromTheGraph} from './StateAdapterFromTheGraph';

  let canvas;
  onMount(() => {
    const spaceInfo = new SpaceInfoImpl(
      '0xe0c3fa9ae97fc9b60baae605896b5e3e7cecb6baaaa4708162d1ec51e8d65a69'
    ); // TODO
    const space = new SpaceImpl(spaceInfo, new StateAdapterFromTheGraph());
    const privateSpace = new PrivateSpaceImpl(space);
    const renderState = new RenderStateImpl(privateSpace);
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
