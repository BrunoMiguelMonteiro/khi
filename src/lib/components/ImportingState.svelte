<script lang="ts">
  import { _ } from '$lib/i18n';
</script>

<div class="importing-state" role="status" aria-live="polite">
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
    <div class="pulse-ring"></div>
    <div class="pulse-ring" style="animation-delay: 0.5s;"></div>
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
    min-height: 100%;
  }

  .icon-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    margin-bottom: var(--space-6, 24px);
  }

  .e-reader-icon {
    width: 40px;
    height: 40px;
    color: var(--color-primary-500, #3b82f6);
    z-index: 1;
    position: relative;
  }

  .pulse-ring {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background-color: var(--color-primary-100, #dbeafe);
    animation: pulse 2s ease-out infinite;
  }

  @keyframes pulse {
    0% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0.8;
    }
    100% {
      transform: translate(-50%, -50%) scale(2);
      opacity: 0;
    }
  }

  .title {
    font-size: var(--text-xl, 20px);
    font-weight: var(--font-semibold, 600);
    color: var(--text-primary, #171717);
    margin: 0 0 var(--space-2, 8px) 0;
  }

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .pulse-ring {
      animation: none;
      opacity: 0.3;
    }
  }
</style>
