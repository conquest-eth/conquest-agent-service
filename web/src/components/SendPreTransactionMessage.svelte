<script lang="ts">
  import sendFlow from '../stores/send';
  import PanelButton from '../components/PanelButton.svelte';
  import Modal from '../components/Modal.svelte';
  import {planetAt} from '../stores/planets';
  import {xyToLocation} from '../common/src';
  import {space, spaceInfo} from '../app/mapState';
  import {timeToText} from '../lib/utils';
  import {now} from '../stores/time';

  $: planetFrom = $sendFlow.data?.from
    ? planetAt(xyToLocation($sendFlow.data.from.x, $sendFlow.data.from.y))
    : undefined;

  $: planetTo = $sendFlow.data?.to
    ? planetAt(xyToLocation($sendFlow.data.to.x, $sendFlow.data.to.y))
    : undefined;

  $: duration = space.timeToArrive($planetFrom, $planetTo);
  $: arrival = duration + now();
</script>

<Modal>
  <p class="mb-3">
    You are about to confirm the launch of your fleet. Remember that you'll need
    to ensure an extra transaction is performed once the fleet reaches
    destination (around
    {new Date(arrival).toString()}). You'll have a
    {timeToText(spaceInfo.resolveWindow, {verbose: true})}
    time window for that.
  </p>
  <div class="text-center">
    <PanelButton
      label="OK"
      class="mt-4"
      on:click={() => sendFlow.acknowledgeWelcomingStep2()}>
      OK
    </PanelButton>
  </div>
</Modal>
