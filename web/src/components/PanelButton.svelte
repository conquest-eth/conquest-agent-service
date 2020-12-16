<script>
  let class_names: string = '';
  export {class_names as class};
  export let label: string;
</script>

<button
  {label}
  class="border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-gray-200 rounded px-4 py-2 {class_names}"
  on:click>
  <slot />
</button>
