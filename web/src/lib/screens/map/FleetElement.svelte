<script lang="ts">
  import type { Fleet } from "conquest-eth-common";
  export let fleet: Fleet;


  const x1 = fleet.from.location.globalX;
  const y1 = fleet.from.location.globalY;
  const x2 = fleet.to.location.globalX;
  const y2 = fleet.to.location.globalY;

  $: ratio = (fleet.duration - fleet.timeLeft) / fleet.duration;

  $: x = x1 + (x2-x1) * ratio;
  $: y = y1 + (y2-y1) * ratio;
  const scale = 1;


</script>

<div>
  <!-- <p> {fleet.from.location.x}</p> -->
  <div
      style={`position: absolute; z-index: 50; transform: translate(${x}px,${y}px) scale(${scale}, ${scale}); background-color: red; width: 1px; height: 1px;
  `}/>
  <!-- <svg width="500" height="500"><line x1="50" y1="50" x2="350" y2="350" stroke="black"/></svg> -->
</div>
