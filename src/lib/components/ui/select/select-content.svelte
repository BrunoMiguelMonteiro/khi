<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import { cn, type WithoutChild } from '$lib/utils.js';
	import { menuContent } from '../menu/menu-classes';

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 4,
		children,
		...restProps
	}: WithoutChild<SelectPrimitive.ContentProps> = $props();
</script>

<!--
	The list is the Menu's surface (Componentes · 10 · Menu), at least as wide as the trigger, below
	it: Bits UI 2 has no item-aligned position, so it can't open over the value in force.
-->
<SelectPrimitive.Portal>
	<SelectPrimitive.Content
		bind:ref
		side="bottom"
		align="start"
		{sideOffset}
		data-slot="select-content"
		class={cn(
			menuContent,
			'min-w-(--bits-select-anchor-width) max-h-(--bits-select-content-available-height)',
			'origin-(--bits-select-content-transform-origin) overflow-x-hidden overflow-y-auto',
			className
		)}
		{...restProps}
	>
		<SelectPrimitive.Viewport class="w-full">
			{@render children?.()}
		</SelectPrimitive.Viewport>
	</SelectPrimitive.Content>
</SelectPrimitive.Portal>
