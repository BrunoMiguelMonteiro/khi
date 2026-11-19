<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from 'svelte/elements';

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, 'type' | 'files'> & { type?: Exclude<HTMLInputTypeAttribute, 'file'> }
	>;

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		disabled = false,
		readonly = false,
		class: className,
		'data-slot': dataSlot = 'input',
		...restProps
	}: Props = $props();
</script>

<!--
	Componentes (D7) · 5 · Campo de texto (55:1908). Disabled is native readonly plus aria-disabled,
	never native disabled, so the field keeps focus and its place in the Tab order (Componentes 5).
-->
<input
	bind:this={ref}
	data-slot={dataSlot}
	class={cn(
		'h-control w-55 min-w-0 truncate px-2 outline-none',
		'rounded-control border-(length:--stroke-border) border-input-strong bg-background',
		'text-body text-foreground placeholder:text-tertiary-foreground',
		'focus-visible:focus-ring',
		'data-disabled:border-disabled-border data-disabled:bg-disabled data-disabled:text-disabled-foreground data-disabled:placeholder:text-disabled-foreground',
		className
	)}
	{type}
	readonly={disabled || readonly}
	aria-disabled={disabled ? 'true' : undefined}
	data-disabled={disabled ? '' : undefined}
	bind:value
	{...restProps}
/>
