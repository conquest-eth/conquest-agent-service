<script lang="ts">
  import {onDestroy, onMount} from 'svelte';
  import {camera} from '$lib/map/camera';
  import type {RenderView} from '$lib/map/renderview';
  import {ElementRenderView} from '$lib/map/renderview';
  import CSSRenderer from './CSSRenderer.svelte';

  let surface: HTMLElement; // TODO HTMLCanvasElement; ?
  let renderView: RenderView;
  let cancelRenderViewUpdate: number;

  function update(): void {
    renderView.update();
    cancelRenderViewUpdate = window.requestAnimationFrame(update);
  }

  onMount(() => {
    renderView = new ElementRenderView(surface); // TODO CanvasRenderView ?
    camera.start(surface, renderView);
    cancelRenderViewUpdate = window.requestAnimationFrame(update);
  });

  onDestroy(() => {
    camera.stop();
    if (cancelRenderViewUpdate) {
      window.cancelAnimationFrame(cancelRenderViewUpdate);
    }
  });
</script>

<div id="surface" unselectable={true} onselectstart={() => false} bind:this={surface}>
  <CSSRenderer />
</div>

<!-- <canvas id="surface" bind:this={canvas} /> -->
<style>
  #surface {
    width: 100%;
    height: 100%;
    position: absolute;
    background-color: #000; /* #21262c; */ /*#1f253a;*/ /*#272e49;*/
    image-rendering: -moz-crisp-edges;
    image-rendering: -webkit-crisp-edges;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    -webkit-user-select: none; /* Safari */
    -moz-user-select: none; /* Firefox */
    -ms-user-select: none; /* IE10+/Edge */
    user-select: none; /* Standard */
    overflow: hidden;
    border: 3px blue solid;
  }

  /* #surface {
    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAATklEQVQoU2O0O3X+PwMDA8MhM0NGEI0LMBKtEJsJD27YgW1R0DgEtwWrdUQrxGYLY8V5iDUdhghrKFOITfenmXFgW/jSF+H3DNEKsdkCAO99IAvXcD3VAAAAAElFTkSuQmCC)
      repeat;
  } */
  /*
 background-color: #e5e5f7;
  opacity: 0.8;
  background-image:  linear-gradient(30deg, #444cf7 12%, transparent 12.5%, transparent 87%, #444cf7 87.5%, #444cf7), linear-gradient(150deg, #444cf7 12%, transparent 12.5%, transparent 87%, #444cf7 87.5%, #444cf7), linear-gradient(30deg, #444cf7 12%, transparent 12.5%, transparent 87%, #444cf7 87.5%, #444cf7), linear-gradient(150deg, #444cf7 12%, transparent 12.5%, transparent 87%, #444cf7 87.5%, #444cf7), linear-gradient(60deg, #444cf777 25%, transparent 25.5%, transparent 75%, #444cf777 75%, #444cf777), linear-gradient(60deg, #444cf777 25%, transparent 25.5%, transparent 75%, #444cf777 75%, #444cf777);
  background-size: 20px 35px;
  background-position: 0 0, 0 0, 10px 18px, 10px 18px, 0 0, 10px 18px;
  background-repeat: repeat;
*/
</style>
