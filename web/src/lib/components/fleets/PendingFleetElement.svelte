<script lang="ts">
  import {account} from '$lib/account/account';
  import {agentService} from '$lib/account/agentService';

  import Button from '$lib/components/generic/PanelButton.svelte';

  import type {Fleet} from '$lib/space/fleets';

  import {spaceInfo} from '$lib/space/spaceInfo';
  import {now, time} from '$lib/time';
  import {timeToText} from '$lib/utils';
  export let fleet: Fleet;

  let from = fleet.from;
  let to = fleet.to;
  // let distance = spaceInfo.distance(from, to);
  $: timeLeft = spaceInfo.timeLeft($time, from, to, fleet.launchTime).timeLeft;

  async function submit() {
    const distance = spaceInfo.distance(from, to);
    const duration = spaceInfo.timeToArrive(from, to);
    const {toHash, fleetId, secretHash} = await account.hashFleet(
      from.location,
      to.location,
      fleet.sending.action.nonce
    );
    const {queueID} = await agentService.submitReveal(
      fleetId,
      secretHash,
      from.location,
      to.location,
      distance,
      fleet.launchTime,
      duration
    );
    account.recordQueueID(fleet.sending.id, queueID);
  }

  function forget() {
    account.markAsFullyAcknwledged(fleet.sending.id, now());
  }
</script>

<p>
  fleets of {fleet.quantity} spaceships sent from {from.stats.name} ({from.location.x},{from.location.y}) to reach {to
    .stats.name} ({to.location.x},{to.location.y}) in {timeToText(timeLeft)}
  {#if fleet.resolution}
    (tx to resolve on its way...)
  {/if}
  ({fleet.state})
  {#if fleet.state === 'TRAVELING' && !fleet.sending.action.queueID}
    <Button label="submit" on:click={submit}>submit</Button>
  {:else if fleet.state === 'SEND_BROADCASTED' && $time - fleet.sending.action.timestamp > 30}
    <Button label="forget" on:click={forget}>forget</Button>
  {/if}
</p>
