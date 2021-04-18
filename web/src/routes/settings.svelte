<script lang="ts">
  import NavButton from '$lib/components/navigation/NavButton.svelte';
  import {base} from '$app/paths';
</script>

<div class="w-full h-full bg-black">
  <NavButton label="Back To Game" href={`${base}/`}>Back To Game</NavButton>

  <p class="text-center text-yellow-500">Work in Progress...</p>
</div>
