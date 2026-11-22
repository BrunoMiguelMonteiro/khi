<script lang="ts" module>
	import type { RadioGroup as RadioGroupPrimitive } from 'bits-ui';
	import type { AccentChoice } from '$lib/accent/accent';

	export type SwatchValue = AccentChoice;

	export type SwatchGroupProps = Omit<
		RadioGroupPrimitive.RootProps,
		| 'children'
		| 'child'
		| 'value'
		| 'onValueChange'
		| 'orientation'
		| 'loop'
		| 'disabled'
		| 'readonly'
	> & {
		value?: SwatchValue;
		onValueChange?: (value: SwatchValue) => void;
		/** Bits UI readonly plus aria-disabled: the swatches stay reachable, and nothing changes. */
		disabled?: boolean;
		/** Why it is disabled, shown in each swatch's Tooltip (needs a TooltipProvider). */
		disabledReason?: string;
		/** The group's accessible name; «Cor de realce» when omitted. */
		'aria-label'?: string;
	};
</script>

<script lang="ts">
	import { RadioGroup as Primitive } from 'bits-ui';
	import { _ } from '$lib/i18n';
	import { cn } from '$lib/utils.js';
	import { SWATCH_NAMES, type SwatchName } from './swatch-classes';
	import Swatch from './swatch.svelte';

	let {
		ref = $bindable(null),
		value = $bindable<SwatchValue>('system'),
		onValueChange,
		disabled = false,
		disabledReason,
		'aria-label': ariaLabel,
		class: className,
		...restProps
	}: SwatchGroupProps = $props();

	const KEYS: Record<SwatchName, string> = {
		'azul-tinta': 'settings.accent.swatches.azulTinta',
		'verde-folha': 'settings.accent.swatches.verdeFolha',
		turquesa: 'settings.accent.swatches.turquesa',
		laranja: 'settings.accent.swatches.laranja',
		amarelo: 'settings.accent.swatches.amarelo',
		rosa: 'settings.accent.swatches.rosa',
		violeta: 'settings.accent.swatches.violeta'
	};

	const items: { value: SwatchValue; label: string }[] = $derived([
		{ value: 'system', label: $_('settings.accent.system') },
		...SWATCH_NAMES.map((name) => ({ value: name, label: $_(KEYS[name]) }))
	]);
</script>

<!--
	Componentes (D7) · 13 · Amostra de cor (56:5146): eight swatches, spacing/2 apart. A Bits UI
	radio group: one Tab stop, the arrows choose and wrap. Disabled is Bits UI readonly, never
	native disabled, so the arrows still read each swatch while nothing is chosen.
-->
<Primitive.Root
	bind:ref
	bind:value={
		() => value,
		(v) => {
			value = v as SwatchValue;
			onValueChange?.(value);
		}
	}
	{...restProps}
	orientation="horizontal"
	loop
	readonly={disabled}
	data-slot="swatch-group"
	aria-label={ariaLabel ?? $_('settings.accent.label')}
	aria-disabled={disabled ? 'true' : undefined}
	aria-readonly={undefined}
	data-readonly={undefined}
	data-disabled={disabled ? '' : undefined}
	class={cn('inline-flex items-center gap-2', className)}
>
	{#each items as item (item.value)}
		<Swatch value={item.value} label={item.label} {disabled} {disabledReason} />
	{/each}
</Primitive.Root>
