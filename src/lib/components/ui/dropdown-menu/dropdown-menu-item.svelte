<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import Check from 'lucide-svelte/icons/check';
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';
	import { menuItem, menuMark, menuShortcut } from '../menu/menu-classes';

	let {
		ref = $bindable(null),
		checked = $bindable(),
		shortcut,
		class: className,
		children,
		...restProps
	}: Omit<DropdownMenuPrimitive.ItemProps, 'children' | 'child'> & {
		/** Figma «Marcado»: with a value, the item is a menuitemcheckbox with a Marca column. */
		checked?: boolean;
		/** Figma «Atalho»: the key equivalent at the trailing edge, e.g. «⌘E». */
		shortcut?: string;
		children?: Snippet;
	} = $props();
</script>

<!--
	Item de menu (55:3156). Disabled is Bits UI's own: the arrows skip it, as on macOS (an exception
	to the focusable-disabled rule). Items that ask for more information end their text in «…».
-->
{#snippet content(on?: boolean)}
	{#if checked !== undefined}
		<span data-slot="menu-mark" class={menuMark}>
			{#if on}
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
	{/if}
	<span class="truncate">{@render children?.()}</span>
	{#if shortcut}
		<span data-slot="dropdown-menu-shortcut" class={menuShortcut}>{shortcut}</span>
	{/if}
{/snippet}

{#if checked !== undefined}
	<DropdownMenuPrimitive.CheckboxItem
		bind:ref
		bind:checked={() => checked ?? false, (v) => (checked = v)}
		data-slot="dropdown-menu-item"
		class={cn(menuItem, className)}
		{...restProps}
	>
		{#snippet children({ checked: on })}
			{@render content(on)}
		{/snippet}
	</DropdownMenuPrimitive.CheckboxItem>
{:else}
	<DropdownMenuPrimitive.Item
		bind:ref
		data-slot="dropdown-menu-item"
		class={cn(menuItem, className)}
		{...restProps}
	>
		{@render content()}
	</DropdownMenuPrimitive.Item>
{/if}
