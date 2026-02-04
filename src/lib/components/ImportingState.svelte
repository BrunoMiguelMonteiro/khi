<script lang="ts">
  import { _ } from '$lib/i18n';
  import KoboIcon from './KoboIcon.svelte';
</script>

<div class="importing-state" role="status" aria-live="polite">
  <div class="icon-container">
    <KoboIcon animate={true} size={80} />
  </div>

  <h2 class="title">{$_('screens.importing.title')}</h2>
</div>

<style>
  .importing-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-12, 48px) var(--space-6, 24px);
    text-align: center;
    min-height: 100vh;
    background-color: var(--surface-primary);
  }

  .icon-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: var(--space-6, 24px);
  }

  .title {
    font-size: var(--text-xl, 20px);
    font-weight: var(--font-semibold, 600);
    color: var(--text-primary, #171717);
    margin: 0 0 var(--space-2, 8px) 0;
  }

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    :global(.kobo-icon.animate) {
      animation: none !important;
    }
  }
</style>
