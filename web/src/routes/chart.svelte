<script lang="ts">
  import {base} from '$app/paths';
  import {onMount} from 'svelte';
  import data from '$lib/data/score.json';

  const chart: {name: string; x: number[]; y: number[]; stackgroup: string; type: 'scatter'}[] = data.players.map(
    (v) => {
      return {
        x: data.blockNumbers,
        y: v.values,
        name: v.name,
        stackgroup: 'one',
        type: 'scatter',
      };
    }
  );

  onMount(() => {
    (window as any).Plotly.newPlot('plotly', chart, {title: data.title}, {responsive: true, doubleClickDelay: 500});
  });
</script>

<svelte:head>
  <script src={`${base}/js/plotly-2.8.3.min.js`}></script>
</svelte:head>

<div id="plotly" style="width:100%;height:100%;" />
