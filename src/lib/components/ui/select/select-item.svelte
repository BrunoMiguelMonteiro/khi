<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import Check from 'lucide-svelte/icons/check';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import { menuItem, menuMark } from '../menu/menu-classes';

	let {
		ref = $bindable(null),
		class: className,
		value,
		label,
		...restProps
	}: WithoutChildrenOrChild<SelectPrimitive.ItemProps> = $props();
</script>

<!-- Item de menu (55:3156), Tipo=Com marca: the check marks the value in force. -->
<SelectPrimitive.Item
	bind:ref
	{value}
	{label}
	data-slot="select-item"
	class={cn(menuItem, className)}
	{...restProps}
>
	{#snippet children({ selected })}
		<span data-slot="menu-mark" class={menuMark}>
			{#if selected}
				<Check
					aria-hidden="true"
					size={12}
					strokeWidth={4 / 3}
					absoluteStrokeWidth
					color="currentColor"
					class="size-icon-sm"
				/>
			{/if}
		</span>
		<span class="truncate">{label || value}</span>
	{/snippet}
</SelectPrimitive.Item>
