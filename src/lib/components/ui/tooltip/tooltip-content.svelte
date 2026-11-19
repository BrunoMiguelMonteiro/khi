<script lang="ts">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 4,
		side = 'bottom',
		children,
		...restProps
	}: TooltipPrimitive.ContentProps = $props();
</script>

<!--
	Componentes (D7) · 7 · Tooltip (55:2128); Movimento 5. Only the first tooltip (delayed-open)
	fades in; the next one (instant-open) and the exit are instant. Reduced motion keeps the fade (Figma 55:2128; Movimento 6).
-->
<TooltipPrimitive.Portal>
	<TooltipPrimitive.Content
		bind:ref
		data-slot="tooltip-content"
		role="tooltip"
		{sideOffset}
		{side}
		class={cn(
			'z-50 inline-flex h-6 w-fit items-center gap-4 px-2 whitespace-nowrap data-closed:hidden',
			'rounded-control border-(length:--stroke-border) border-tooltip-border bg-tooltip text-callout text-tooltip-foreground',
			'data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:duration-(--duration-tooltip) data-[state=delayed-open]:ease-out',
			className
		)}
		{...restProps}
	>
		{@render children?.()}
	</TooltipPrimitive.Content>
</TooltipPrimitive.Portal>
