<script lang="ts">
  import { X } from 'lucide-svelte';
  import { tick } from 'svelte';
  import { fade, scale } from 'svelte/transition';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    header?: import('svelte').Snippet;
    content?: import('svelte').Snippet;
    footer?: import('svelte').Snippet;
    children?: import('svelte').Snippet;
  }

  let { isOpen, onClose, title, header, content, footer, children }: Props = $props();

  let modalRef = $state<HTMLDivElement>();

  $effect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeydown);
      document.body.style.overflow = 'hidden';
      tick().then(() => {
        modalRef?.focus();
      });
    } else {
      document.removeEventListener('keydown', handleKeydown);
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.body.style.overflow = '';
    };
  });

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    transition:fade={{ duration: 200 }}
  >
    {#if children}
      <!-- Render children directly (e.g., SettingsPanel with its own structure) -->
      <div
        bind:this={modalRef}
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        style="outline: none"
        transition:scale={{ duration: 200, start: 0.95 }}
      >
        {@render children()}
      </div>
    {:else}
      <!-- Use default Modal structure with header/content/footer -->
      <div
        class="modal-container"
        bind:this={modalRef}
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        transition:scale={{ duration: 200, start: 0.95 }}
      >
        <div class="modal-header">
          {#if header}
            {@render header()}
          {:else if title}
            <h2 id="modal-title" class="modal-title">{title}</h2>
            <button
              type="button"
              class="modal-close-btn"
              onclick={onClose}
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          {:else}
            <div class="modal-title-spacer"></div>
            <button
              type="button"
              class="modal-close-btn"
              onclick={onClose}
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          {/if}
        </div>

        <div class="modal-content">
          {#if content}
            {@render content()}
          {/if}
        </div>

        {#if footer}
          <div class="modal-footer">
            {@render footer()}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 50;
    padding: var(--space-4);
  }

  .modal-container {
    width: 100%;
    max-width: 480px;
    background: var(--surface-elevated);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-xl);
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - var(--space-8));
    outline: none;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-4) var(--space-2);
    border-bottom: 1px solid var(--border-subtle);
  }

  .modal-title {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    line-height: var(--leading-tight);
  }

  .modal-title-spacer {
    flex: 1;
  }

  .modal-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .modal-close-btn:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }

  .modal-close-btn:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-4);
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4) var(--space-4);
    border-top: 1px solid var(--border-subtle);
  }
</style>
