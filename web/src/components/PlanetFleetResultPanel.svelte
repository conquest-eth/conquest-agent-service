<script lang="ts">
  import PanelButton from './PanelButton.svelte';
  import privateAccount from '../stores/privateAccount';
  import type {OwnFleet} from '../common/src/types';
  export let fleet: {id: string; status: 'Error' | 'Success'} & OwnFleet;

  function deleteFleet() {
    if (fleet.resolveTxHash) {
      privateAccount.acknowledgeResolveFailure(fleet.id);
    } else {
      privateAccount.deleteFleet(fleet.id);
    }
  }
</script>

<p>{fleet.status}</p>
<PanelButton label="Connect your wallet" class="m-2" on:click={deleteFleet}>
  <div class="w-20">OK</div>
</PanelButton>
