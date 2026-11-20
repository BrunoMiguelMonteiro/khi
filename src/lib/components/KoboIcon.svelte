<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { _ } from '$lib/i18n';
  import solidIcon from '$lib/assets/kobo-icon-solid.svg?raw';
  import dashedIcon from '$lib/assets/kobo-icon-dashed.svg?raw';
  import disabledIcon from '$lib/assets/kobo-icon-disabled.svg?raw';

  interface Props {
    variant?: 'solid' | 'dashed' | 'disabled';
    size?: number;
    disabled?: boolean; // Retrocompatibilidade (deprecated)
    animate?: boolean;   // Alterna entre solid e disabled
    /** Decorativo: as primeiras N das 7 linhas de texto do ecrã ficam cheias (progresso, Task 38). */
    filledLines?: number;
  }

  let {
    variant = 'solid',
    size = 128,
    disabled = false,
    animate = false,
    filledLines
  }: Props = $props();

  let icon = $state<HTMLElement>();
  // As linhas vêm do SVG em bruto: marcam-se aqui, e a cor e a transição são CSS
  $effect(() => {
    if (filledLines === undefined || !icon) return;
    icon.querySelectorAll('svg line').forEach((line, index) => {
      line.toggleAttribute('data-filled', index < filledLines);
    });
  });

  // Estado para animação (alterna entre solid/disabled)
  let animationFrame = $state<'solid' | 'disabled'>('solid');
  let intervalId: number | undefined;

  onMount(() => {
    if (animate) {
      intervalId = window.setInterval(() => {
        animationFrame = animationFrame === 'solid' ? 'disabled' : 'solid';
      }, 1000); // Alterna cada 1 segundo
    }
  });

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  const iconSvg = $derived(() => {
    // Se está a animar, usar animationFrame
    if (animate) {
      return animationFrame === 'solid' ? solidIcon : disabledIcon;
    }

    // Retrocompatibilidade
    if (disabled) return disabledIcon;

    // Variant normal
    switch (variant) {
      case 'dashed': return dashedIcon;
      case 'disabled': return disabledIcon;
      case 'solid':
      default: return solidIcon;
    }
  });
</script>

<!-- Com `filledLines` a ilustração é decorativa e as linhas mudam de cor em 250 ms, ease-out, igual com Reduzir movimento (só cor) -->
<div
  bind:this={icon}
  class={[
    'kobo-icon block transition-opacity duration-300',
    filledLines === undefined && 'text-neutral-300 dark:text-neutral-700',
    // Body, screen and lines all in the highlight-line token; the filled lines in the new one
    filledLines !== undefined &&
      '[&_rect]:stroke-highlight-line [&_line]:stroke-highlight-line [&_line[data-filled]]:stroke-highlight-line-new [&_line]:transition-[stroke] [&_line]:duration-(--duration-reveal) [&_line]:ease-out'
  ]}
  class:text-neutral-900={!disabled && variant === 'solid' && filledLines === undefined}
  class:dark:text-neutral-100={!disabled && variant === 'solid' && filledLines === undefined}
  class:animate-pulse={animate}
  class:motion-reduce:animate-none={animate}
  style="width: {size}px; height: auto;"
  role={filledLines === undefined ? 'img' : undefined}
  aria-label={filledLines === undefined ? $_('app.koboDevice') : undefined}
  aria-hidden={filledLines === undefined ? undefined : 'true'}
>
  <div class="[&>svg]:w-full [&>svg]:h-auto [&>svg]:block">
    {@html iconSvg()}
  </div>
</div>
