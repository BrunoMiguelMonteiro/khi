<script lang="ts">
  import KoboIcon from './KoboIcon.svelte';
  import { _ } from '$lib/i18n';
</script>

<!--
  Ecrã 6 · L1 (Figma 72:11425 and 72:11443): the first start, no Reader open and no Kobo. The
  same centred skeleton as the first Sync (EmptyStateSyncing), with the dashed Kobo, still.
-->
<div class="flex h-full flex-col items-center justify-center gap-6 bg-background" role="status" aria-live="polite">
  <KoboIcon variant="dashed" size={96} />

  <div class="flex w-[320px] flex-col items-center gap-2 text-center">
    <h2 class="text-title-3 text-foreground">
      {$_('screens.noKobo.title')}
    </h2>
    <p class="text-body text-muted-foreground">
      {$_('screens.noKobo.subtitle')}
    </p>
  </div>
</div>
