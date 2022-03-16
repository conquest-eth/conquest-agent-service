<script lang="ts">
  export let location: string;
  export let link: boolean = false;
  import {url} from '$lib/utils/url';
  import {locationToXY} from 'conquest-eth-common';
  import Copiable from '../generic/Copiable.svelte';

  function coord(location: string): string {
    const loc = locationToXY(location);
    return `${loc.x},${loc.y}`;
  }

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
</script>

{#if link}
  <a href={url(`?x=${locationToXY(location).x}&y=${locationToXY(location).y}`)} class="underline">{coord(location)}</a>
{:else}
  <Copiable text={`${coord(location)}`}>
    <span style="user-select: all; cursor: pointer;" class="border">{coord(location)}</span>
  </Copiable>
{/if}
