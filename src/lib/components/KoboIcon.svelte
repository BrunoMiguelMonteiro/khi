<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import solidIcon from '$lib/assets/kobo-icon-solid.svg?raw';
  import dashedIcon from '$lib/assets/kobo-icon-dashed.svg?raw';
  import disabledIcon from '$lib/assets/kobo-icon-disabled.svg?raw';

  interface Props {
    variant?: 'solid' | 'dashed' | 'disabled';
    size?: number;
    disabled?: boolean; // Retrocompatibilidade (deprecated)
    animate?: boolean;   // Alterna entre solid e disabled
  }

  let {
    variant = 'solid',
    size = 128,
    disabled = false,
    animate = false
  }: Props = $props();

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

<div
  class="kobo-icon block transition-opacity duration-300 text-neutral-300 dark:text-neutral-700"
  class:text-neutral-900={!disabled && variant === 'solid'}
  class:dark:text-neutral-100={!disabled && variant === 'solid'}
  class:animate-pulse={animate}
  class:motion-reduce:animate-none={animate}
  style="width: {size}px; height: auto;"
  role="img"
  aria-label="Kobo e-reader device"
>
  <div class="[&>svg]:w-full [&>svg]:h-auto [&>svg]:block">
    {@html iconSvg()}
  </div>
</div>
