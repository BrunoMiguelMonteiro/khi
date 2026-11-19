<script lang="ts" module>
	import type { Switch as SwitchPrimitive } from 'bits-ui';

	export type SwitchProps = Omit<SwitchPrimitive.RootProps, 'children' | 'child' | 'disabled'> & {
		/** aria-disabled, not native disabled: the switch keeps its place in the Tab order. */
		disabled?: boolean;
		/** Why it is disabled, shown in a Tooltip on focus and hover (needs a TooltipProvider). */
		disabledReason?: string;
	};

	type TriggerProps = Record<string, unknown>;

	// Aliases that would fight the component-owned state attributes if forwarded.
	const OWNED_ALIASES = new Set(['aria-disabled', 'data-disabled']);
</script>

<script lang="ts">
	import { Switch as Primitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { withTrigger } from '../button';
	import { Tooltip } from '../tooltip';

	const uid = $props.id();

	let {
		ref = $bindable(null),
		checked = $bindable(false),
		disabled = false,
		disabledReason,
		onCheckedChange,
		id = `switch-${uid}`,
		class: className,
		...restProps
	}: SwitchProps = $props();

	const forwarded = $derived(
		Object.fromEntries(Object.entries(restProps).filter(([key]) => !OWNED_ALIASES.has(key)))
	);

	let reasonOpen = $state(false);

	// No focus event fires when the focused switch becomes disabled, so its reason opens here.
	$effect(() => {
		if (!disabled) reasonOpen = false;
		else if (disabledReason && ref && ref === document.activeElement) reasonOpen = true;
	});
</script>

<!--
	Componentes (D7) · 11 · Switch (55:3471). The button is the 32 × 20 hit area (1 px of transparent
	padding above and below, decision B); the track inside is the visible 32 × 18 and paints the
	keyboard-only ring. Bits UI has no readonly Switch, so disabled is a function binding that
	refuses the write, and onCheckedChange is not called. The thumb slides in duration/in with
	ease/out by its margin, so the end position stays with Reduzir movimento, where it just jumps.
-->
{#snippet control(trigger: TriggerProps)}
	<Primitive.Root
		bind:ref
		bind:checked={
			() => checked,
			(v) => {
				if (!disabled) checked = v;
			}
		}
		onCheckedChange={(v) => {
			if (!disabled) onCheckedChange?.(v);
		}}
		{...forwarded}
		{id}
		disabled={false}
	>
		{#snippet child({ props, checked: on })}
			{@const merged = withTrigger(props, trigger)}
			{@const state = {
				'data-state': on ? 'checked' : 'unchecked',
				'data-disabled': disabled ? '' : undefined
			}}
			<!-- The checked and disabled states come last: the tooltip trigger's data-state must not hide them. -->
			<button
				{...merged}
				data-slot="switch"
				class={cn('group/switch inline-flex h-5 w-8 shrink-0 py-px outline-none', className)}
				role="switch"
				{...state}
				aria-disabled={disabled ? 'true' : undefined}
			>
				<span
					data-slot="switch-track"
					{...state}
					class={cn(
						'flex h-4.5 w-8 rounded-full p-0.5 group-focus-visible/switch:focus-ring',
						'bg-input-strong data-checked:bg-switch-on',
						'data-disabled:bg-disabled-border data-disabled:data-checked:bg-primary-disabled'
					)}
				>
					<Primitive.Thumb
						data-slot="switch-thumb"
						class={cn(
							'pointer-events-none block size-3.5 rounded-full bg-switch-thumb shadow-sombra-segmento',
							'transition-[margin-left] duration-(--duration-in) ease-out data-checked:ml-3.5',
							'motion-reduce:transition-none'
						)}
					/>
				</span>
			</button>
		{/snippet}
	</Primitive.Root>
{/snippet}

<!-- On disabledReason, not on disabled: toggling disabled keeps the same switch, and its focus. -->
{#if disabledReason}
	<Tooltip text={disabledReason} disabled={!disabled} bind:open={reasonOpen} {id}>
		{#snippet children({ props })}
			{@render control(props)}
		{/snippet}
	</Tooltip>
{:else}
	{@render control({})}
{/if}
