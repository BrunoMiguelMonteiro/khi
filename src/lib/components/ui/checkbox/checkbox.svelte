<script lang="ts" module>
	import type { Checkbox as CheckboxPrimitive } from 'bits-ui';

	export type CheckboxProps = Omit<
		CheckboxPrimitive.RootProps,
		'children' | 'child' | 'disabled' | 'readonly' | 'indeterminate' | 'onIndeterminateChange'
	> & {
		/** The text on the right; clicking it toggles. Omit when aria-labelledby names the box. */
		label?: string;
		/** Bits UI readonly plus aria-disabled: the box keeps its place in the Tab order. */
		disabled?: boolean;
		/** Why it is disabled, shown in a Tooltip on focus and hover (needs a TooltipProvider). */
		disabledReason?: string;
	};

	type TriggerProps = Record<string, unknown>;

	// Aliases that would fight the component-owned state attributes if forwarded.
	const OWNED_ALIASES = new Set([
		'readOnly',
		'aria-disabled',
		'data-disabled',
		'aria-readonly',
		'data-readonly'
	]);
</script>

<script lang="ts">
	import { Checkbox as Primitive } from 'bits-ui';
	import Check from 'lucide-svelte/icons/check';
	import { cn } from '$lib/utils.js';
	import { withTrigger } from '../button';
	import { Tooltip } from '../tooltip';

	const uid = $props.id();

	let {
		ref = $bindable(null),
		checked = $bindable(false),
		label,
		disabled = false,
		disabledReason,
		id = `checkbox-${uid}`,
		class: className,
		...restProps
	}: CheckboxProps = $props();

	const forwarded = $derived(
		Object.fromEntries(Object.entries(restProps).filter(([key]) => !OWNED_ALIASES.has(key)))
	);

	let reasonOpen = $state(false);

	// No focus event fires when the focused box becomes disabled, so its reason opens here.
	$effect(() => {
		if (!disabled) reasonOpen = false;
		else if (disabledReason && ref && ref === document.activeElement) reasonOpen = true;
	});
</script>

<!--
	Componentes (D7) · 4 · Caixa (55:1684). No hover state in the Figma, so nothing animates: the
	press is instant. The ring is keyboard-only and follows radius/checkbox. Disabled is Bits UI
	readonly (Space and clicks change nothing) with aria-disabled, never native disabled.
	input-strong already darkens in the contrast modes, so there is no contrast outline.
-->
{#snippet box(trigger: TriggerProps)}
	<Primitive.Root bind:ref bind:checked {...forwarded} {id} readonly={disabled} disabled={false}>
		{#snippet child({ props, checked: on })}
			{@const merged = withTrigger(props, trigger)}
			<!--
				The checked and disabled states come last, so neither forwarded nor trigger props can
				undo them: the tooltip trigger's own data-state (closed, delayed-open) must not hide it.
			-->
			<button
				{...merged}
				data-slot="checkbox"
				class={cn(
					'inline-flex size-3.5 shrink-0 items-center justify-center outline-none',
					'rounded-checkbox focus-visible:focus-ring',
					'border-(length:--stroke-border) border-input-strong bg-background',
					'not-data-disabled:data-unchecked:active:bg-accent-pressed',
					'data-disabled:border-disabled-border data-disabled:bg-disabled',
					'data-checked:border-0 data-checked:bg-primary text-primary-foreground',
					'not-data-disabled:data-checked:active:bg-primary-pressed',
					'data-disabled:data-checked:bg-toolbar-icon-disabled data-disabled:text-disabled-mark'
				)}
				role="checkbox"
				data-state={props['data-state']}
				aria-readonly={undefined}
				data-readonly={undefined}
				aria-disabled={disabled ? 'true' : undefined}
				data-disabled={disabled ? '' : undefined}
			>
				{#if on}
					<Check
						data-slot="checkbox-mark"
						aria-hidden="true"
						size={10}
						strokeWidth={4 / 3}
						absoluteStrokeWidth
						color="currentColor"
						class="size-2.5"
					/>
				{/if}
			</button>
		{/snippet}
	</Primitive.Root>
{/snippet}

<span data-slot="checkbox-root" class={cn('inline-flex items-center gap-2', className)}>
	<!-- On disabledReason, not on disabled: toggling disabled keeps the same box, and its focus. -->
	{#if disabledReason}
		<Tooltip text={disabledReason} disabled={!disabled} bind:open={reasonOpen} {id}>
			{#snippet children({ props })}
				{@render box(props)}
			{/snippet}
		</Tooltip>
	{:else}
		{@render box({})}
	{/if}
	{#if label}
		<label
			for={id}
			data-slot="checkbox-label"
			data-disabled={disabled ? '' : undefined}
			class="text-body text-foreground select-none data-disabled:text-disabled-foreground"
		>
			{label}
		</label>
	{/if}
</span>
