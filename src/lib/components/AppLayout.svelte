<script lang="ts">
  import '../styles/design-system.css';
  import { _ } from '$lib/i18n';

  interface Props {
    children?: import('svelte').Snippet;
    headerActions?: import('svelte').Snippet;
  }

  let { children, headerActions }: Props = $props();
</script>

<div class="app-layout">
  <header class="app-header">
    <div class="header-brand">
      <div class="brand-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 6v7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M9 9h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <h1 class="brand-title">Kobo Highlights</h1>
    </div>
    <div class="header-actions">
      {@render headerActions?.()}
    </div>
  </header>

  <main class="app-main">
    {@render children?.()}
  </main>

  <footer class="app-footer">
    <p class="footer-text">{$_('app.title')}</p>
  </footer>
</div>

<style>
  .app-layout {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background-color: var(--surface-secondary);
  }

  /* Header Styles */
  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--header-height);
    padding: 0 var(--space-6);
    background-color: var(--surface-elevated);
    border-bottom: 1px solid var(--border-default);
    box-shadow: var(--shadow-sm);
    position: sticky;
    top: 0;
    z-index: var(--z-sticky);
  }

  .header-brand {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .brand-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-600) 100%);
    border-radius: var(--radius-lg);
    color: var(--text-inverse);
  }

  .brand-icon svg {
    width: 20px;
    height: 20px;
  }

  .brand-title {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    letter-spacing: var(--tracking-tight);
    margin: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  /* Main Content */
  .app-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Footer Styles */
  .app-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4) var(--space-6);
    background-color: var(--surface-primary);
    border-top: 1px solid var(--border-default);
  }

  .footer-text {
    font-size: var(--text-sm);
    color: var(--text-tertiary);
  }

  /* Responsive Adjustments */
  @media (max-width: 640px) {
    .app-header {
      padding: 0 var(--space-4);
    }

    .brand-title {
      font-size: var(--text-base);
    }

    .footer-text {
      font-size: var(--text-xs);
    }
  }
</style>
