<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLSpanElement>> = $props();
</script>

<!-- Componentes (D7) · 1 · Etiqueta (55:584); contrast outline from Tema 3. -->
<span
	bind:this={ref}
	data-slot="badge"
	class={cn(
		'inline-flex w-fit shrink-0 items-center whitespace-nowrap',
		'rounded-badge bg-primary-tint px-1 text-subheadline-semibold text-primary-tint-foreground tabular-nums',
		'contrast-more:inset-ring contrast-more:inset-ring-primary-tint-foreground',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</span>
