<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { menuSeparator } from '../menu/menu-classes';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: DropdownMenuPrimitive.SeparatorProps = $props();
</script>

<!-- Separador de menu (55:3159). -->
<DropdownMenuPrimitive.Separator
	bind:ref
	data-slot="dropdown-menu-separator"
	class={cn(menuSeparator, className)}
	{...restProps}
/>
