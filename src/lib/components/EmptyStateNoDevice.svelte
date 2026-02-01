<script lang="ts">
  import { _ } from '$lib/i18n';
</script>

<div class="empty-state-no-device" role="status" aria-live="polite">
  <div class="icon-container">
    <svg 
      class="e-reader-icon" 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <line x1="8" y1="6" x2="16" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="8" y1="10" x2="16" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="8" y1="14" x2="12" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="12" cy="18" r="1.5" fill="currentColor"/>
    </svg>
  </div>
  
  <h2 class="title">{$_('screens.noKobo.title')}</h2>
  <p class="subtitle">{$_('screens.noKobo.subtitle')}</p>
</div>

<style>
  .empty-state-no-device {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-12, 48px) var(--space-6, 24px);
    text-align: center;
    min-height: 100%;
  }

  .icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    border-radius: var(--radius-2xl, 16px);
    background-color: var(--surface-tertiary, #f5f5f5);
    margin-bottom: var(--space-6, 24px);
  }

  .e-reader-icon {
    width: 40px;
    height: 40px;
    color: var(--text-disabled, #a3a3a3);
  }

  .title {
    font-size: var(--text-xl, 20px);
    font-weight: var(--font-semibold, 600);
    color: var(--text-primary, #171717);
    margin: 0 0 var(--space-2, 8px) 0;
  }

  .subtitle {
    font-size: var(--text-base, 16px);
    color: var(--text-secondary, #737373);
    margin: 0;
    max-width: 320px;
    line-height: var(--leading-relaxed, 1.625);
  }
</style>
