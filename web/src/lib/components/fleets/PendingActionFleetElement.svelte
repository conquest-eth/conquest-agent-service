<script lang="ts">
  import type {PendingSend} from '$lib/account/account';

  import type {CheckedPendingAction} from '$lib/account/pendingActions';
  import {spaceInfo} from '$lib/space/spaceInfo';
  import {time} from '$lib/time';
  import {timeToText} from '$lib/utils';
  export let pendingAction: CheckedPendingAction<PendingSend>;

  let from = spaceInfo.getPlanetInfo(pendingAction.action.from.x, pendingAction.action.from.y);
  let to = spaceInfo.getPlanetInfo(pendingAction.action.to.x, pendingAction.action.to.y);
  let distance = spaceInfo.distance(from, to);
  $: timeLeft = spaceInfo.timeLeft($time, from, to, pendingAction.action.actualLaunchTime).timeLeft;
</script>

<p>
  fleets of {pendingAction.action.quantity} spaceships sent from {from.stats.name} ({from.location.x},{from.location.y})
  to reach {to.stats.name} ({to.location.x},{to.location.y}) in {timeToText(timeLeft)}
  {#if pendingAction.action.resolution}
    (tx to resolve on its way...)
  {/if}
</p>
