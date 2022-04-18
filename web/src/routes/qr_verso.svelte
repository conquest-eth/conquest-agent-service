<script lang="ts">
  import {onMount} from 'svelte';

  import qrs from '../qrs.json';
  const list = qrs;

  const pages = [];
  const chunkSize = 24;
  for (let i = 0; i < list.length; i += chunkSize) {
    const chunk = list.slice(i, i + chunkSize);
    pages.push(chunk);
  }

  let pageIndex = 0;
  onMount(() => {
    if (location.hash && location.hash.slice(1)) {
      pageIndex = parseInt(location.hash.slice(1));
      console.log({pageIndex});
    }
  });

  $: currentPage = pages[pageIndex];

  $: console.log({currentPage});
</script>

<div class="book">
  <div
    class="page"
    style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.2cm; row-gap: 0.9cm;"
  >
    <!-- {#each pages as page} -->
    <!-- <img src={page[0]} alt="qr" style="width:4cm; height:4cm; page-break-before: always;" /> -->
    <!-- {#each page.slice(0, page.length - 1) as qr} -->
    <!-- <img src={qr} alt="qr" style="width:4cm; height:4cm;" /> -->
    <!-- {/each} -->
    <!-- <img src={page[page.length - 1]} alt="qr" style="width:4cm; height:4cm;page-break-after: always;" /> -->
    <!-- {/each} -->

    {#each currentPage as qr}
      <img src="/maskable_icon_512x512.png" alt="qr" style="width:4cm; height:4cm;" />
    {/each}
  </div>
</div>

<style>
  html,
  body {
    /* width: 100%;
    height: 100%; */
    width: 210mm;
    height: 297mm;
    margin: 0cm;
    padding: 0cm;
    background-color: #fafafa;
    font: 12pt 'Tahoma';
  }
  * {
    box-sizing: border-box;
    -moz-box-sizing: border-box;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 0.5cm;
    padding-left: 1cm;
  }

  @page {
    size: A4;
    margin: 0;
  }
  .page {
    margin: 0;
    border: initial;
    border-radius: initial;
    width: initial;
    min-height: initial;
    box-shadow: initial;
    background: initial;
    page-break-after: always;
  }
</style>
