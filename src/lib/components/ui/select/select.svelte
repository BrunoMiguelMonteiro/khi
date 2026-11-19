<script lang="ts" module>
	import type { HTMLButtonAttributes } from 'svelte/elements';

	export type SelectItem = { value: string; label: string; disabled?: boolean };

	export type SelectProps = Omit<
		HTMLButtonAttributes,
		'value' | 'disabled' | 'children' | 'type' | 'name' | 'id'
	> & {
		ref?: HTMLButtonElement | null;
		id?: string;
		value?: string;
		/** The choices; there is no empty state, so a value not among them becomes the first. */
		items: SelectItem[];
		/** The accessible name, when no aria-labelledby names the trigger. */
		label?: string;
		/** aria-disabled, not native disabled: the trigger keeps its place in the Tab order. */
		disabled?: boolean;
		/** Why it is disabled, shown in a Tooltip on focus and hover (needs a TooltipProvider). */
		disabledReason?: string;
		/** The form field name of the hidden input that carries the value. */
		name?: string;
		open?: boolean;
		onValueChange?: (value: string) => void;
		onOpenChange?: (open: boolean) => void;
	};

	type TriggerProps = Record<string, unknown>;

	// Aliases that would fight the component-owned state attributes if forwarded.
	const OWNED_ALIASES = new Set(['aria-disabled', 'data-disabled']);
</script>

<script lang="ts">
	import { Select as Primitive } from 'bits-ui';
	import ChevronsUpDown from 'lucide-svelte/icons/chevrons-up-down';
	import { cn } from '$lib/utils.js';
	import { guardClick, withTrigger } from '../button';
	import { Tooltip } from '../tooltip';
	import SelectContent from './select-content.svelte';
	import SelectItemView from './select-item.svelte';

	const uid = $props.id();

	let {
		ref = $bindable(null),
		value = $bindable(),
		open = $bindable(false),
		items,
		label,
		disabled = false,
		disabledReason,
		name,
		onValueChange,
		onOpenChange,
		id = `select-${uid}`,
		class: className,
		...restProps
	}: SelectProps = $props();

	const forwarded = $derived(
		Object.fromEntries(Object.entries(restProps).filter(([key]) => !OWNED_ALIASES.has(key)))
	);

	const current = $derived(items.find((item) => item.value === value) ?? items[0]);

	// pop-up-buttons.md: a pop-up always has a choice.
	$effect.pre(() => {
		if (current && current.value !== value) value = current.value;
	});

	let reasonOpen = $state(false);

	// No focus event fires when the focused trigger becomes disabled, so its reason opens here.
	$effect(() => {
		if (!disabled) reasonOpen = false;
		else if (disabledReason && ref && ref === document.activeElement) reasonOpen = true;
	});

	$effect(() => {
		if (disabled) open = false;
	});
</script>

<!--
	Componentes (D7) · 6 · Pop-up (55:2116). The hover fill fades in duration/hover, the press is
	instant, the ring is keyboard-only. Bits UI's own disabled would make the trigger natively
	disabled and drop it from the Tab order, so disabled is function bindings that refuse to open
	or choose (the arrows, Space, Enter and typeahead all write through them) with aria-disabled.
	input-strong already darkens in the contrast modes, so there is no contrast outline.
-->
{#snippet trigger(tooltip: TriggerProps)}
	<Primitive.Trigger>
		{#snippet child({ props })}
			{@const merged = withTrigger(withTrigger(forwarded, props), tooltip)}
			<!-- The select's data-state (open, closed) wins over the tooltip trigger's. -->
			<button
				bind:this={ref}
				{...merged}
				{id}
				type="button"
				data-slot="select-trigger"
				class={cn(
					'group/select inline-flex h-control min-w-0 items-center justify-between gap-2 pr-2 pl-4',
					'rounded-control border-(length:--stroke-border) border-input-strong bg-background',
					'outline-none select-none focus-visible:focus-ring',
					'transition-[background-color] duration-(--duration-hover) ease-hover',
					'not-data-disabled:hover:bg-accent',
					'not-data-disabled:active:bg-accent-pressed not-data-disabled:active:transition-none',
					'data-disabled:border-disabled-border data-disabled:bg-disabled',
					className
				)}
				aria-label={label ?? (merged['aria-label'] as string | undefined)}
				data-state={props['data-state']}
				aria-disabled={disabled ? 'true' : undefined}
				data-disabled={disabled ? '' : undefined}
				onclickcapture={guardClick(() => disabled, merged.onclickcapture as never)}
				onclick={guardClick(() => disabled, merged.onclick as never)}
			>
				<span
					data-slot="select-value"
					class="truncate text-body text-foreground group-data-disabled/select:text-disabled-foreground"
				>
					{current?.label}
				</span>
				<ChevronsUpDown
					data-slot="select-chevron"
					aria-hidden="true"
					size={12}
					strokeWidth={4 / 3}
					absoluteStrokeWidth
					color="currentColor"
					class="size-icon-sm shrink-0 text-muted-foreground group-data-disabled/select:text-disabled-foreground"
				/>
			</button>
		{/snippet}
	</Primitive.Trigger>
{/snippet}

<Primitive.Root
	type="single"
	{items}
	{name}
	disabled={false}
	bind:open={
		() => open,
		(v) => {
			if (!disabled || !v) open = v;
		}
	}
	bind:value={
		() => current?.value ?? '',
		(v) => {
			if (!disabled) value = v;
		}
	}
	onValueChange={(v) => {
		if (!disabled) onValueChange?.(v);
	}}
	onOpenChange={(v) => {
		if (!disabled) onOpenChange?.(v);
	}}
>
	<!-- On disabledReason, not on disabled: toggling disabled keeps the same trigger, and its focus. -->
	{#if disabledReason}
		<Tooltip text={disabledReason} disabled={!disabled} bind:open={reasonOpen} {id}>
			{#snippet children({ props })}
				{@render trigger(props)}
			{/snippet}
		</Tooltip>
	{:else}
		{@render trigger({})}
	{/if}
	<SelectContent>
		{#each items as item (item.value)}
			<SelectItemView value={item.value} label={item.label} disabled={item.disabled} />
		{/each}
	</SelectContent>
</Primitive.Root>
