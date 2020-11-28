<script lang="ts">
  import Modal from '../components/Modal.svelte';
  import resolveFlow from '../stores/resolve';
</script>

<Modal
  on:close={() => resolveFlow.cancel()}
  on:confirm={() => resolveFlow.confirm()}>
  <p>Attack/Resolve</p>
</Modal>
