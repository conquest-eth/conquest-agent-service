<script lang="ts">
  import sendFlow from '$lib/stores/send';
  import PanelButton from '$lib/components/PanelButton.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import AddToCalendar from '$lib/components/addtocalendar/AddToCalendar.svelte';
  import {planetAt} from '$lib/stores/planets';
  import {xyToLocation} from '$lib/common/src';
  import {space} from '$lib/app/mapState';
  import {timeToText} from '$lib/utils';
  import {now} from '$lib/stores/time';
  import {base} from '$app/paths';

  $: planetFrom = $sendFlow.data?.from
    ? planetAt(xyToLocation($sendFlow.data.from.x, $sendFlow.data.from.y))
    : undefined;

  $: planetTo = $sendFlow.data?.to ? planetAt(xyToLocation($sendFlow.data.to.x, $sendFlow.data.to.y)) : undefined;

  $: duration = space.timeToArrive($planetFrom, $planetTo);
  $: arrival = duration + now();
</script>

<Modal>
  <div class="text-center">
    <p class="mb-4">Congratulations! Your fleets is on its way (transaction pending...)</p>
    <p class="mb-4">
      Once the transaction is mined, the fleet will take
      {timeToText(duration, {verbose: true})}
      to reach the destination. Assuming it get mined instantly, it should arrive on
      {new Date(arrival * 1000).toString()}.
    </p>

    <p class="mb-4">
      Remember you need to ensure to execute the "resolution" transaction at that time. See
      <a class="underline" href={`${base}/help/`} target="_blank">Help</a>
      for more details.
    </p>
    <p class="mb-4">
      Or as always if you can have a computer running permanently, you can setup an agent
      <a class="underline" href={`${base}/agent/`} target="_blank">here</a>
    </p>

    <p class="mb-4">You can also create a reminder here</p>

    <AddToCalendar
      title="conquest.eth: Come Back To Resolve Fleet in Time!"
      description="Come back to conquest.eth and resolve your fleet."
      timestamp={arrival}
      duration={105} />
    <!-- 1h45min event duration -->

    <PanelButton label="OK" class="mt-4" on:click={() => sendFlow.acknownledgeSuccess()}>OK</PanelButton>
  </div>
</Modal>
