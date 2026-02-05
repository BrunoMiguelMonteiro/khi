<script lang="ts">
  import { X } from 'lucide-svelte';
  import { tick } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import Button from './Button.svelte';

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
      // Tentativa de manter a barra visível mas inativa via CSS no body
      document.body.classList.add('modal-open');
      tick().then(() => {
        modalRef?.focus();
      });
    } else {
      document.removeEventListener('keydown', handleKeydown);
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
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
    class="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 p-4"
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
        class="focus:outline-none"
        transition:scale={{ duration: 200, start: 0.95 }}
      >
        {@render children()}
      </div>
    {:else}
      <!-- Use default Modal structure with header/content/footer -->
      <div
        class="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] focus:outline-none"
        bind:this={modalRef}
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        transition:scale={{ duration: 200, start: 0.95 }}
      >
        <div class="flex items-center justify-between gap-3 p-4 pb-2 border-b border-neutral-100 dark:border-neutral-800">
          {#if header}
            {@render header()}
          {:else if title}
            <h2 id="modal-title" class="m-0 text-lg font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">{title}</h2>
            <Button
              variant="icon"
              onclick={onClose}
              ariaLabel="Fechar"
            >
              {#snippet icon()}
                <X size={20} />
              {/snippet}
            </Button>
          {:else}
            <div class="flex-1"></div>
            <Button
              variant="icon"
              onclick={onClose}
              ariaLabel="Fechar"
            >
              {#snippet icon()}
                <X size={20} />
              {/snippet}
            </Button>
          {/if}
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          {#if content}
            {@render content()}
          {/if}
        </div>

        {#if footer}
          <div class="flex items-center justify-end gap-3 p-3 pt-0 px-4 pb-4 border-t border-neutral-100 dark:border-neutral-800">
            {@render footer()}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}
