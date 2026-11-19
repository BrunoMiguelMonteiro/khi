<script lang="ts" module>
	import type { Component, ComponentType, SvelteComponent } from 'svelte';
	import type { IconProps } from 'lucide-svelte';

	export type IconSize = 'sm' | 'md' | 'lg';
	export type LucideIcon = ComponentType<SvelteComponent<IconProps>> | Component<IconProps>;

	// Figma size/icon-sm, size/icon and size/icon-lg (design/tokens.json → medidas).
	const SIZES = {
		sm: { px: 12, class: 'size-icon-sm' },
		md: { px: 16, class: 'size-icon' },
		lg: { px: 20, class: 'size-icon-lg' }
	} as const;

	// Componentes (D7) · 0 · Ícones: 1.333 px at every size (2 on the 24 grid at 16).
	const STROKE_PX = 4 / 3;
</script>

<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		icon: IconComponent,
		size = 'md',
		label,
		class: className
	}: { icon: LucideIcon; size?: IconSize; label?: string; class?: string } = $props();

	const a11y = $derived(
		label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' as const }
	);
</script>

<IconComponent
	{...a11y}
	size={SIZES[size].px}
	strokeWidth={STROKE_PX}
	absoluteStrokeWidth
	color="currentColor"
	class={cn('shrink-0', SIZES[size].class, className)}
/>
