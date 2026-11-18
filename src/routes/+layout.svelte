<script lang="ts">
  import { onMount } from 'svelte';
  import { emit } from '@tauri-apps/api/event';
  import { settings } from '$lib/stores/settings.svelte';
  import { updater } from '$lib/stores/updater.svelte';
  import '../app.css';

  let { children } = $props();

  onMount(async () => {
    try {
      await settings.initialize();
      console.log('[Layout] Settings initialized, theme applied');
    } catch (e) {
      console.error('[Layout] Settings initialization failed:', e);
    }
    // Signal to Rust backend that theme is applied and window can be shown
    // (handled by src-tauri/src/window.rs — must match event name)
    console.log('[Layout] Emitting app-ready event');
    try {
      await emit('app-ready');
    } catch (e) {
      console.error('[Layout] Failed to emit app-ready:', e);
    }
    // Once a day, silent unless there is a new version
    updater.loadVersion();
    updater.checkOnLaunch(settings.uiPreferences.checkForUpdates ?? true);
  });
</script>

{@render children()}
