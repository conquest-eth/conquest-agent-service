<script lang="ts">
import { account } from "$lib/account/account";
import { wallet } from "$lib/blockchain/wallet";
import { blockTime } from "$lib/config";

  import { camera } from "$lib/map/camera";
  import type { Fleet } from "conquest-eth-common";
  export let fleet: Fleet;


  const x1 = fleet.from.location.globalX;
  const y1 = fleet.from.location.globalY;
  const x2 = fleet.to.location.globalX;
  const y2 = fleet.to.location.globalY;

  $: ratio = (fleet.duration - fleet.timeLeft) / fleet.duration;

  $: x = x1 + (x2-x1) * ratio;
  $: y = y1 + (y2-y1) * ratio;

  $: scale = $camera ? $camera.renderScale : 1;

  async function acknowledge() {
    const block = await wallet.provider.getBlock("latest");
    if (fleet.resolution && fleet.resolution.status === "SUCCESS") { // TODO if final
      account.acknowledgeSuccess(fleet.txHash, block.timestamp);
      account.acknowledgeSuccess(fleet.resolution.id, block.timestamp);
    }
  }

</script>

<div
      style={`position: absolute; z-index: 50; transform: translate(${x-0.5}px,${y-0.5}px); background-color: red; width: 1px; height: 1px;
  `} on:click={acknowledge}></div>

{#if !fleet.resolution || fleet.resolution.status !== "SUCCESS"}
<svg style={`position: absolute; z-index: 50; overflow: visible`}>
  <marker xmlns="http://www.w3.org/2000/svg" id="triangle" viewBox="0 0 10 10" refX="10" refY="5" fill="#FFFFFF" stroke="#34D399"  markerUnits="strokeWidth" markerWidth="4" markerHeight="3" orient="auto">
    <path d="M 0 0 L 10 5 L 0 10 z"/>
  </marker>
  <line marker-end="url(#triangle)" stroke-width={`${4/scale}px`} stroke="#34D399"  x1={x1} y1={y1} x2={x2} y2={y2}/>
</svg>
{/if}
