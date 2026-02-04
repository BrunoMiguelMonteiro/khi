<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeSettings } from '$lib/stores/settings.svelte';
  import '../app.css';

  let { children } = $props();

  onMount(async () => {
    await initializeSettings();
  });
</script>

{@render children()}
