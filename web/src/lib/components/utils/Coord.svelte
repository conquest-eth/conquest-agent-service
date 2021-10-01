<script lang="ts">
  export let location: string;
  import {url} from '$lib/utils/url';
  import {locationToXY} from 'conquest-eth-common';

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

<a href={url(`?x=${locationToXY(location).x}&y=${locationToXY(location).y}`)} class="border">{coord(location)}</a>
