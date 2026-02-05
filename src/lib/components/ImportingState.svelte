<script lang="ts">
  import { _ } from '$lib/i18n';
  import KoboIcon from './KoboIcon.svelte';
</script>

<div class="flex flex-col items-center justify-center h-full p-12 text-center bg-white dark:bg-neutral-900" role="status" aria-live="polite">
  <div class="relative flex items-center justify-center mb-6">
    <KoboIcon animate={true} size={80} />
  </div>

  <h2 class="m-0 mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-100">{$_('screens.importing.title')}</h2>
</div>
