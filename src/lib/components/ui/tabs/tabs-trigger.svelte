<script lang="ts">
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { Icon, type LucideIcon } from '../icon';

	let {
		ref = $bindable(null),
		icon,
		class: className,
		children,
		...restProps
	}: Omit<TabsPrimitive.TriggerProps, 'child'> & { icon: LucideIcon } = $props();
</script>

<!--
	Componentes (D7) · 12 · Separador das Definições (55:4977): the 20 px icon above the label, which
	stays Regular in every state. Hover fills accent in duration/hover; only a hovered, unselected
	tab has the transition, so changing tab is instant for both tabs (and leaving hover too). Selecionado: primary-tint with the contrast-outline-strong
	stroke (transparent outside the contrast modes).
-->
<TabsPrimitive.Trigger
	bind:ref
	data-slot="tabs-trigger"
	class={cn(
		'flex flex-col items-center gap-1 px-2 py-1 rounded-control outline-none focus-visible:focus-ring',
		'text-subheadline text-muted-foreground',
		'duration-(--duration-hover) ease-hover',
		'not-data-disabled:not-data-active:hover:bg-accent',
		'not-data-disabled:not-data-active:hover:transition-[background-color]',
		'data-active:bg-primary-tint data-active:text-primary-tint-foreground',
		'data-active:inset-ring data-active:inset-ring-contrast-outline-strong',
		className
	)}
	{...restProps}
>
	<Icon {icon} size="lg" />
	<span data-slot="tabs-trigger-label">{@render children?.()}</span>
</TabsPrimitive.Trigger>
