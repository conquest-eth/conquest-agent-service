<script lang="ts">
  import {base} from '$app/paths';
  import NavButton from '$lib/components/navigation/NavButton.svelte';
</script>

<div class="w-full h-full bg-black">
  <NavButton label="Back To Game" href={`${base}/`}>Back To Game</NavButton>

  <div class="relative bg-gray-900 border-2 border-cyan-300 top-1 mx-1 z-20">
    <div class="max-w-screen-xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
      <div class="pr-16 sm:text-center sm:px-16 text-cyan-300">
        <p>
          conquest.eth is a game of strategy and diplomacy where players compete to conquer the universe. Player can
          take control of empty planets by staking tokens on them. This activate their production of spaceships.
        </p>
      </div>
    </div>
  </div>
</div>
