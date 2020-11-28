<script lang="ts">
  // export let to: string = '';
  import resolveFlow from '../stores/resolve';
  import privateAccount from '../stores/privateAccount';
  import Button from './Button.svelte';

  function resolve(fleetId) {
    resolveFlow.resolve(fleetId);
  }

  $: fleets = !$privateAccount.data
    ? []
    : Object.keys($privateAccount.data.fleets)
        .map((fleetId) => {
          return {id: fleetId, ...$privateAccount.data.fleets[fleetId]};
        })
        .filter((fleet) => {
          if (fleet.resolveTxHash) {
            return false; // TOOO query it
          }
          const speed = 10000;
          const fullDistance = Math.floor(
            Math.sqrt(
              Math.pow(fleet.to.x - fleet.from.x, 2) +
                Math.pow(fleet.to.y - fleet.from.y, 2)
            )
          );
          const fullTime = fullDistance * ((3600 * 10000) / speed);
          const timePassed = Math.floor(Date.now() / 1000) - fleet.launchTime;
          let ratio = timePassed / fullTime;
          if (timePassed > fullTime) {
            // TODO disapear
            ratio = 1;
          }
          return true; // ratio >= 1;
        });
</script>

<!-- TODO fliter on to-->

{#each fleets as fleet}
  <Button on:click={() => resolve(fleet.id)}>resolve</Button>
{/each}
