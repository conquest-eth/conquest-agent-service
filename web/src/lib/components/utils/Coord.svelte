<script lang="ts">
  export let location: string;
  export let link: boolean = false;
  import {url} from '$lib/utils/url';
  import {coordFromXYObject, locationToXY} from 'conquest-eth-common';
  import Copiable from '../generic/Copiable.svelte';

  function _select(elem: HTMLElement) {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(elem);
    (selection as any).removeAllRanges();
    (selection as any).addRange(range);
  }
  function select(e: MouseEvent) {
    _select(e.currentTarget as HTMLElement);
  }

  $: xy = locationToXY(location);
  $: coordStr = coordFromXYObject(xy);
</script>

{#if link}
  <a href={url(`?x=${xy.x}&y=${xy.y}`)} class="underline">{coordStr}</a>
{:else}
  <Copiable text={`${coordStr}`}>
    <span style="user-select: all; cursor: pointer;" class="border">{coordStr}</span>
  </Copiable>
{/if}
