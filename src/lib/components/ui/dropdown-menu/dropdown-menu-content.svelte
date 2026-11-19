<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import type { ComponentProps } from 'svelte';
	import { menuContent } from '../menu/menu-classes';
	import DropdownMenuPortal from './dropdown-menu-portal.svelte';

	let {
		ref = $bindable(null),
		sideOffset = 4,
		align = 'start',
		portalProps,
		class: className,
		...restProps
	}: DropdownMenuPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DropdownMenuPortal>>;
	} = $props();
</script>

<!-- Menu (55:3185): 200 wide unless the caller's class says otherwise. -->
<DropdownMenuPortal {...portalProps}>
	<DropdownMenuPrimitive.Content
		bind:ref
		data-slot="dropdown-menu-content"
		{sideOffset}
		{align}
		class={cn(
			menuContent,
			'w-50 max-h-(--bits-dropdown-menu-content-available-height)',
			'origin-(--bits-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto',
			className
		)}
		{...restProps}
	/>
</DropdownMenuPortal>
