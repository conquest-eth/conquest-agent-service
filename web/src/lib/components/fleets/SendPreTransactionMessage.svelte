<script lang="ts">
  import sendFlow from '$lib/flows/send';
  import PanelButton from '$lib/components/generic/PanelButton.svelte';
  import Modal from '$lib/components/generic/Modal.svelte';
  import {planetAt} from '$lib/space/planets';
  import {xyToLocation} from 'conquest-eth-common';
  import {spaceInfo} from '$lib/space/spaceInfo';
  import {timeToText} from '$lib/utils';
  import {now} from '$lib/time';

  $: planetFrom = $sendFlow.data?.from
    ? planetAt(xyToLocation($sendFlow.data.from.x, $sendFlow.data.from.y))
    : undefined;

  $: planetTo = $sendFlow.data?.to ? planetAt(xyToLocation($sendFlow.data.to.x, $sendFlow.data.to.y)) : undefined;

  $: duration = space.timeToArrive($planetFrom, $planetTo);
  $: arrival = duration + now();
  const base: string = window.basepath || '/';
</script>

<Modal>
  <p class="mb-3">
    You are about to confirm the launch of your fleet. Remember that you'll need to ensure an extra transaction is
    performed once the fleet reaches destination (around
    {new Date(arrival * 1000).toString()}). You'll have a
    {timeToText(spaceInfo.resolveWindow, {verbose: true})}
    time window to execute it.
  </p>
  <p>Once the first transaction is submitted, we will help you create a reminder.</p>
  <p class="my-2">
    You can also setup an agent that will run on its own and resolve your fleets automatically. You just need to leave
    the agent running. See
    <a href={`agent/`} target="_blank" class="underline">here</a>
  </p>
  <div class="text-center">
    <PanelButton label="OK" class="mt-4" on:click={() => sendFlow.acknowledgeWelcomingStep2()}>OK</PanelButton>
  </div>
</Modal>
