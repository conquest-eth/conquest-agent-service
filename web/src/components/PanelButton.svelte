<script>
  let class_names: string = '';
  export {class_names as class};
  export let label: string;
</script>

<div class="inline-block text-cyan-300 border-cyan-300 {class_names}">
  <button {label} class="relative p-1 text-cyan-300 border-cyan-300">
    <div
      class="absolute left-0 -top-0 w-4 h-4 border-r-0 border-l-2 border-t-2 border-b-0 border-cyan-300" />
    <div
      class="absolute -left-0 -bottom-0 w-4 h-4 border-r-0 border-l-2 border-b-2 border-t-0 border-cyan-300" />
    <div
      class="absolute -right-0 -top-0 w-4 h-4 border-r-2 border-l-0 border-t-2 border-b-0 border-cyan-300" />
    <div
      class="absolute -right-0 -bottom-0 w-4 h-4 border-r-2 border-l-0 border-t-0 border-b-2 border-cyan-300" />
    <div class="block relative border overflow-hidden border-cyan-600">
      <div>
        <div on:click class="px-4 py-2 relative">
          <slot />
        </div>
      </div>
    </div>
  </button>
</div>
