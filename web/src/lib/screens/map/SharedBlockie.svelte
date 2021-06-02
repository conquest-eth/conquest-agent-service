<script lang="ts">
  export let address: string;
  export let style: string | undefined = undefined;

  import {Blockie} from '$lib/utils/eth/blockie';
  const uri = Blockie.getURI(address);
</script>

<img {style} src={uri} alt={address} />

<style>
  img {
    image-rendering: -moz-crisp-edges;
    image-rendering: -webkit-crisp-edges;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }
</style>
