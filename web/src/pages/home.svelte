<script lang="ts">
  import Map from '../app/Map.svelte';
  import {planets} from '../stores/planets';
  import WalletAccess from '../templates/WalletAccess.svelte';

  import claimFlow from '../stores/claim';
  import ClaimFlow from '../flows/ClaimFlow.svelte';
  planets.fetch(); // TODO somewhere else
</script>

<WalletAccess>
  <Map />

  {#if $claimFlow.step !== 'IDLE'}
    <ClaimFlow />
  {/if}
</WalletAccess>
