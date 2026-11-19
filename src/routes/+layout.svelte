<script lang="ts">
  import { onMount } from 'svelte';
  import { emit } from '@tauri-apps/api/event';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { currentWindowLabel } from '$lib/window';
  import { settings } from '$lib/stores/settings.svelte';
  import { updater } from '$lib/stores/updater.svelte';
  import '../app.css';

  let { children } = $props();

  onMount(async () => {
    // Settings only need the settings, the theme and the language
    const isMain = currentWindowLabel() === 'main';
    try {
      await settings.initialize();
      console.log('[Layout] Settings initialized, theme applied');
    } catch (e) {
      console.error('[Layout] Settings initialization failed:', e);
    }
    // Signal to Rust backend that theme is applied and window can be shown
    // (handled by src-tauri/src/window.rs — must match event name)
    // Settings are built hidden (no white flash) and show themselves now;
    // Rust shows them anyway after 3 s
    if (!isMain) {
      getCurrentWindow()
        .show()
        .catch((e) => console.error('[Layout] Failed to show the window:', e));
    }
    if (isMain) {
      console.log('[Layout] Emitting app-ready event');
      try {
        await emit('app-ready');
      } catch (e) {
        console.error('[Layout] Failed to emit app-ready:', e);
      }
    }
    // The version is shown in Settings › Updates
    updater.loadVersion();
    // Once a day, silent unless there is a new version
    if (isMain) updater.checkOnLaunch(settings.uiPreferences.checkForUpdates ?? true);
  });
</script>

{@render children()}
