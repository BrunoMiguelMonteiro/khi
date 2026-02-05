<script lang="ts">
  import { onMount } from 'svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import '../app.css';

  let { children } = $props();

  onMount(async () => {
    await settings.initialize();
  });
</script>

{@render children()}
