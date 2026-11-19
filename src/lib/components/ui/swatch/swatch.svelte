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

	/**
	 * Bits UI's roving focus skips every [data-disabled] item, so in a disabled group the arrows
	 * would go nowhere. Here they move focus as when enabled (and wrap), so each swatch's name and
	 * the reason can be read; the group is readonly, so nothing is chosen.
	 */
	function roveWhileDisabled(event: KeyboardEvent): boolean {
		const here = event.currentTarget;
		if (!disabled || !(here instanceof HTMLElement)) return false;
		const group = here.closest('[data-slot="swatch-group"]');
		if (!group) return false;
		const swatches = [...group.querySelectorAll<HTMLElement>('[data-slot="swatch"]')];
		const rtl = getComputedStyle(group).direction === 'rtl';
		const step: Record<string, number> = {
			ArrowRight: rtl ? -1 : 1,
			ArrowDown: 1,
			ArrowLeft: rtl ? 1 : -1,
			ArrowUp: -1
		};
		const at = swatches.indexOf(here);
		let next: number;
		if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = swatches.length - 1;
		else if (event.key in step) next = (at + step[event.key] + swatches.length) % swatches.length;
		else return false;
		event.preventDefault();
		swatches[next]?.focus();
		return true;
	}
</script>

<!--
	Componentes (D7) · 13 · Amostra de cor (56:5146). The radio is the 20 × 20 click area (−1 px
	margin, so it lays out as 18 × 18 and the row keeps gap-2); inside it, the 18 × 18 round visual
	takes no clicks and paints the swatch: Sistema is background with a primary stroke/swatch inside
	and a 6 px primary dot, a colour is its swatch fill. Foco is the Task 5 ring on the visual, flush.
	Selecionada is the radio's after: ring, foreground at stroke/swatch, 3 px out of the radio (Seleção,
	22 × 22, outside stroke, inner radius 11), not hit-testable. No hover, no motion.
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
						'group/swatch relative -m-px inline-flex size-5 shrink-0 items-center justify-center rounded-full outline-none',
						'data-checked:after:pointer-events-none data-checked:after:absolute data-checked:after:-inset-0.75 data-checked:after:rounded-full',
						'data-checked:after:border-(length:--stroke-swatch) data-checked:after:border-foreground',
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
					onkeydown={(event) => {
						if (!roveWhileDisabled(event)) (merged.onkeydown as ((e: KeyboardEvent) => void) | undefined)?.(event);
					}}
				>
					<span
						data-slot="swatch-visual"
						aria-hidden="true"
						class={cn(
							'pointer-events-none inline-flex size-4.5 items-center justify-center rounded-full',
							'group-focus-visible/swatch:focus-ring',
							value === 'system'
								? 'border-(length:--stroke-swatch) border-primary bg-background'
								: SWATCH_BG[value]
						)}
					>
						{#if value === 'system'}
							<span data-slot="swatch-dot" aria-hidden="true" class="size-1.5 rounded-full bg-primary"
							></span>
						{/if}
					</span>
				</button>
			{/snippet}
		</Primitive.Item>
	{/snippet}
</Tooltip>
