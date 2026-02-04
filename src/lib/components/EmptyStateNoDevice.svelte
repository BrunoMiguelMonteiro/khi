<script lang="ts">
  import KoboIcon from './KoboIcon.svelte';
</script>

<div
  class="flex flex-col items-center justify-center min-h-screen gap-8"
  style="background-color: var(--surface-primary);"
  role="status"
  aria-live="polite"
>
  <KoboIcon variant="dashed" size={128} />

  <div class="flex flex-col items-center gap-2 text-center">
    <h2 class="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
      No Kobo connected
    </h2>
    <p class="text-base text-neutral-500 max-w-[320px]">
      Connect your Kobo to view your highlights
    </p>
  </div>
</div>
