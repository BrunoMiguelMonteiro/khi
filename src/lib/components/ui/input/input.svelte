<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLInputAttributes } from 'svelte/elements';

	// Text-field types whose native readonly makes the control inert; disabled relies on it.
	const TEXT_FIELD_TYPES = ['text', 'search', 'email', 'url', 'tel', 'password', 'number'] as const;
	type TextFieldType = (typeof TEXT_FIELD_TYPES)[number];

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, 'type' | 'files'> & { type?: TextFieldType }
	>;

	// Aliases that would fight the component-owned state attributes if forwarded.
	const OWNED_ALIASES = new Set(['readOnly', 'readonly', 'disabled', 'aria-disabled', 'data-disabled']);

	let {
		ref = $bindable(null),
		value = $bindable(),
		type = 'text',
		disabled = false,
		readonly = false,
		class: className,
		'data-slot': dataSlot = 'input',
		...restProps
	}: Props = $props();

	const safeType = $derived<TextFieldType>(
		(TEXT_FIELD_TYPES as readonly string[]).includes(type) ? type : 'text'
	);
	const forwarded = $derived(
		Object.fromEntries(
			Object.entries(restProps).filter(([key]) => !OWNED_ALIASES.has(key))
		) as HTMLInputAttributes
	);
</script>

<!--
	Componentes (D7) · 5 · Campo de texto (55:1908). Disabled is native readonly plus aria-disabled,
	never native disabled, so the field keeps focus and its place in the Tab order (Componentes 5).
	Forwarded props spread first so they cannot override the state attributes that follow.
-->
<input
	{...forwarded}
	bind:this={ref}
	type={safeType}
	readonly={disabled || readonly}
	aria-disabled={disabled ? 'true' : undefined}
	data-disabled={disabled ? '' : undefined}
	bind:value
	data-slot={dataSlot}
	class={cn(
		'h-control w-55 min-w-0 truncate px-2 outline-none',
		'rounded-control border-(length:--stroke-border) border-input-strong bg-background',
		'text-body text-foreground placeholder:text-tertiary-foreground',
		'focus-visible:focus-ring',
		'data-disabled:border-disabled-border data-disabled:bg-disabled data-disabled:text-disabled-foreground data-disabled:placeholder:text-disabled-foreground',
		className
	)}
/>
