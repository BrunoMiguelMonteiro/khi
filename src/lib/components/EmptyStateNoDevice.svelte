<script lang="ts">
  import KoboIcon from './KoboIcon.svelte';
  import { _ } from '$lib/i18n';
</script>

<div
  class="flex flex-col items-center justify-center h-full gap-8 bg-white dark:bg-neutral-900"
  role="status"
  aria-live="polite"
>
  <KoboIcon variant="dashed" size={128} />

  <div class="flex flex-col items-center gap-2 text-center">
    <h2 class="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
      {$_('screens.noKobo.title')}
    </h2>
    <p class="text-base text-neutral-500 max-w-[320px]">
      {$_('screens.noKobo.subtitle')}
    </p>
  </div>
</div>
