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

<!-- Componentes (D7) · 1 · Etiqueta (55:584); contrast outline from Tema 3 via contrast-outline-tint (transparent outside the Figma contrast modes). -->
<span
	bind:this={ref}
	data-slot="badge"
	class={cn(
		'inline-flex w-fit shrink-0 items-center whitespace-nowrap',
		'rounded-badge bg-primary-tint px-1 inset-ring inset-ring-contrast-outline-tint text-subheadline-semibold text-primary-tint-foreground tabular-nums',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</span>
