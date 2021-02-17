<script lang="ts">
  import {onMount, onDestroy} from 'svelte';
  export let timestamp: number;
  export let title: string;
  export let description: string;

  let container: HTMLElement;
  let elem: HTMLElement;
  onMount(() => {
    elem = document.getElementById('addeventatc1') as HTMLElement;
    elem.style.display = 'block';
    container.appendChild(elem);

    const start = new Date(timestamp * 1000);
    const end = new Date((timestamp + 2 * 60)  * 1000);

    // const dropElem = document.getElementById('addeventatc1-drop') as HTMLElement;

    const children = elem.children;
    for (const child of children) {
      console.log(child.className);
      if (child.classList.contains('start')) {
        child.innerHTML = start.toISOString();
      } else if (child.classList.contains('end')) {
        child.innerHTML = end.toISOString();
      } else if (child.classList.contains('timezone')) {
        child.innerHTML = 'UTC';
      } else if (child.classList.contains('title')) {
        child.innerHTML = title;
      } else if (child.classList.contains('description')) {
        child.innerHTML = description;
      } else if (child.classList.contains('location')) {
        child.innerHTML = '';
      }
    }

    /*
    <span class="start">02/28/2021 08:00 AM</span>
    <span class="end">02/28/2021 10:00 AM</span>
    <span class="timezone">America/Los_Angeles</span>
    <span class="title">Summary of the event</span>
    <span class="description">Description of the event</span>
    <span class="location">Location of the event</span>
    */
  })


  onDestroy(() => {
    if (elem) {
      elem.style.display = 'none';
      document.body.appendChild(elem);
    }
  })
</script>

<div bind:this={container}>

</div>
