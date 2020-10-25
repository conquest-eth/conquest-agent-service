<script lang="ts">
  import Map from '../app/Map.svelte';
  import {planets} from '../stores/planets';
  planets.fetch(); // TODO somewhere else
</script>

<Map />

<!-- <svelte:component this={flows[$userflow.flow]} /> -->
