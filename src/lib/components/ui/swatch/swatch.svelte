<script lang="ts" module>
	import type { RadioGroup as RadioGroupPrimitive } from 'bits-ui';
	import type { SwatchName } from './swatch-classes';

	export type SwatchProps = Omit<
		RadioGroupPrimitive.ItemProps,
		'children' | 'child' | 'value' | 'disabled'
	> & {
		/** Sistema, or one of the seven colours. */
		value: 'system' | SwatchName;
		/** The swatch's name: its accessible name and its tooltip. */
		label: string;
		/** Set by the group: aria-disabled and data-disabled; the group is Bits UI readonly. */
		disabled?: boolean;
		/** Why the group is disabled, the tooltip instead of the name while disabled. */
		disabledReason?: string;
	};

	// Aliases that would fight the component-owned state attributes if forwarded.
	const OWNED_ALIASES = new Set([
		'aria-disabled',
		'data-disabled',
		'aria-readonly',
		'data-readonly'
	]);
</script>

<script lang="ts">
	import { RadioGroup as Primitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { guardClick, withTrigger } from '../button';
	import { Tooltip } from '../tooltip';
	import { SWATCH_BG } from './swatch-classes';

	const uid = $props.id();

	let {
		ref = $bindable(null),
		value,
		label,
		disabled = false,
		disabledReason,
		id = `swatch-${uid}`,
		class: className,
		...restProps
	}: SwatchProps = $props();

	const forwarded = $derived(
		Object.fromEntries(Object.entries(restProps).filter(([key]) => !OWNED_ALIASES.has(key)))
	);
</script>

<!--
	Componentes (D7) · 13 · Amostra de cor (56:5146): 18 × 18 and round. Sistema is background with a
	primary stroke/swatch inside and a 6 px primary dot; a colour is its swatch fill. Selecionada is
	the after: ring, foreground at stroke/swatch, 2 px out (Seleção, 22 × 22, outside stroke, inner
	radius 11). Foco is the Task 5 ring, flush. The before: inset of 1 px is the 20 × 20 click area,
	so the row keeps gap-2. No hover, no motion: the colour applies at once.
-->
<Tooltip text={disabled && disabledReason ? disabledReason : label} {id}>
	{#snippet children({ props: trigger })}
		<Primitive.Item bind:ref {value} {id} {...forwarded}>
			{#snippet child({ props })}
				{@const merged = withTrigger(props, trigger)}
				<!-- The radio's own type, name and states come last: the tooltip trigger's data-state must not hide them. -->
				<button
					{...merged}
					data-slot="swatch"
					class={cn(
						'relative inline-flex size-4.5 shrink-0 items-center justify-center rounded-full outline-none',
						'before:absolute before:-inset-px before:rounded-full',
						'focus-visible:focus-ring',
						'data-checked:after:absolute data-checked:after:-inset-1 data-checked:after:rounded-full',
						'data-checked:after:border-(length:--stroke-swatch) data-checked:after:border-foreground',
						value === 'system'
							? 'border-(length:--stroke-swatch) border-primary bg-background'
							: SWATCH_BG[value],
						className
					)}
					type="button"
					role="radio"
					aria-label={label}
					data-state={props['data-state']}
					data-readonly={undefined}
					aria-disabled={disabled ? 'true' : undefined}
					data-disabled={disabled ? '' : undefined}
					onclick={guardClick(() => disabled, merged.onclick)}
				>
					{#if value === 'system'}
						<span data-slot="swatch-dot" aria-hidden="true" class="size-1.5 rounded-full bg-primary"
						></span>
					{/if}
				</button>
			{/snippet}
		</Primitive.Item>
	{/snippet}
</Tooltip>
