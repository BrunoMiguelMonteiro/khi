<script lang="ts">
  import KoboIcon from './KoboIcon.svelte';
  import { _ } from '$lib/i18n';

  interface Props {
    /** Books processed so far in the running Sync; `total` 0 until Rust has counted them. */
    progress?: { done: number; total: number } | null;
  }

  let { progress = null }: Props = $props();

  const total = $derived(progress?.total ?? 0);
  const done = $derived(progress?.done ?? 0);
  // The 7 text lines of the screen: one more for each seventh of the books (floor, never ahead of the Kobo)
  const filledLines = $derived(total > 0 ? Math.min(7, Math.floor((7 * done) / total)) : 0);
</script>

<!--
  Ecrã 2 · W2 (Q-W) and X2 (Q-X): the first Sync with no books yet. The same centred state as the first start
  (L1 of screen 6, Figma 72:11428), with a solid Kobo whose lines fill with the progress. Not a live region: the page's own
  announcer says the start; the count changes on screen only.
-->
<div class="flex h-full flex-col items-center justify-center gap-6 bg-background" data-testid="syncing-state">
  <KoboIcon variant="solid" size={96} {filledLines} />

  <div class="flex w-[320px] flex-col items-center gap-2 text-center">
    <h2 class="text-title-3 text-foreground">
      {$_('screens.syncingEmpty.title')}
    </h2>
    {#if total > 0}
      <p class="text-body text-muted-foreground">
        {$_('screens.library.header.syncProgress', { done, count: total })}
      </p>
    {/if}
  </div>
</div>
