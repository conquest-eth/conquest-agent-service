<script>
  let class_names: string = '';
  export {class_names as class};
  export let label: string;
  export let color: string | undefined = undefined;
  export let borderColor: string | undefined = undefined;

  let actualColor = color || 'cyan-300';
  let actualBorderColor = borderColor
    ? borderColor
    : color
    ? color
    : 'cyan-600';
</script>

<div class="inline-block text-{actualColor} border-{actualColor} {class_names}">
  <button {label} class="relative p-1">
    <div
      class="absolute left-0 -top-0 w-4 h-4 border-r-0 border-l-2 border-t-2 border-b-0 border-{actualColor}" />
    <div
      class="absolute -left-0 -bottom-0 w-4 h-4 border-r-0 border-l-2 border-b-2 border-t-0 border-{actualColor}" />
    <div
      class="absolute -right-0 -top-0 w-4 h-4 border-r-2 border-l-0 border-t-2 border-b-0 border-{actualColor}" />
    <div
      class="absolute -right-0 -bottom-0 w-4 h-4 border-r-2 border-l-0 border-t-0 border-b-2 border-{actualColor}" />
    <div
      class="block relative border overflow-hidden border-{actualBorderColor}">
      <div>
        <div on:click class="px-4 py-2 relative">
          <slot />
        </div>
      </div>
    </div>
  </button>
</div>
