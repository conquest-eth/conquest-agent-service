<script lang="ts">
  import PanelButton from './PanelButton.svelte';
  import Blockie from '$lib/components/Blockie.svelte';
  import privateAccount from '$lib/stores/privateAccount';
  import type {AttackEvent} from '$lib/stores/planetLogs';
  import {wallet} from '$lib/stores/wallet';
  // import {planetLogs} from '$lib/stores/planetLogs';
  export let attack: AttackEvent;

  async function acknowledge() {
    const block = await wallet.provider.getBlock(attack.blockNumber);
    privateAccount.acknowledgeAttack(attack.fleet, block.timestamp);
  }
</script>

<p class="p-2">
  {#if attack.won}
    <Blockie class="w-6 h-6 inline-block" address={attack.attacker} />
    succesfully captured your planet by destroying your
    {attack.defenderLoss}
    spaceships
  {:else}
    <Blockie class="w-6 h-6 inline-block" address={attack.attacker} />
    attacked and made your planet lose
    {attack.defenderLoss}
    spaceships
  {/if}
</p>

<PanelButton label="acknowledge" class="m-2" on:click={() => acknowledge()}>
  <div class="w-20">OK</div>
</PanelButton>
