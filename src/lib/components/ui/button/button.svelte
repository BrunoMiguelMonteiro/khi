<script lang="ts" module>
	import { tv } from 'tailwind-variants';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { WithElementRef } from '$lib/utils.js';
	import type { LucideIcon } from '../icon';

	/*
		Componentes (D7) · 2 · Botão (55:787); Componentes 4 e 5. Hover and press only when not disabled;
		the hover fill changes in duration/hover with ease/hover, the press is instant; the ring is keyboard-only (focus-visible).
		`shape: 'toolbar'` is the 32 × 32 Botão de toolbar (55:1346), which adds its own colours.
	*/
	export const buttonVariants = tv(
		{
			base: [
				'inline-flex shrink-0 items-center justify-center whitespace-nowrap select-none',
				'rounded-control outline-none focus-visible:focus-ring',
				'transition-[background-color] duration-(--duration-hover) ease-hover not-data-disabled:active:transition-none'
			],
			variants: {
				variant: {
					principal: [
						'bg-primary text-primary-foreground',
						'not-data-disabled:hover:bg-primary-hover not-data-disabled:active:bg-primary-pressed',
						'data-disabled:bg-primary-disabled data-disabled:text-disabled-foreground',
						// Tema 3: contrast-outline-primary is transparent outside the Figma contrast modes.
						'inset-ring inset-ring-contrast-outline-primary data-disabled:inset-ring-transparent'
					],
					secundario: [
						'border-(length:--stroke-border) border-input-strong bg-background text-foreground',
						'not-data-disabled:hover:bg-accent not-data-disabled:active:bg-accent-pressed',
						'data-disabled:border-disabled-border data-disabled:bg-disabled data-disabled:text-disabled-foreground'
					],
					ligacao: [
						'text-link not-data-disabled:hover:underline not-data-disabled:active:text-primary-pressed',
						'data-disabled:text-disabled-foreground'
					]
				},
				shape: {
					text: 'h-control gap-2 px-4 text-body-medium',
					toolbar: 'size-toolbar-button'
				}
			},
			defaultVariants: { shape: 'text' }
		},
		// cn() merges with the Khi text styles; tv's own tailwind-merge doesn't know them.
		{ twMerge: false }
	);

	export type ButtonVariant = 'principal' | 'secundario' | 'ligacao';

	export type ButtonProps = WithElementRef<Omit<HTMLButtonAttributes, 'disabled'>> & {
		variant?: ButtonVariant;
		/** 16 px icon on the left of the text. */
		icon?: LucideIcon;
		/** aria-disabled, not native disabled: the button keeps its place in the Tab order. */
		disabled?: boolean;
		/** Why it is disabled, shown in a Tooltip on focus and hover (needs a TooltipProvider). */
		disabledReason?: string;
	};

	type TriggerProps = Record<string, unknown>;

	/** The ids of one or more aria-describedby values, deduplicated, space-separated. */
	function joinIds(...lists: unknown[]): string | undefined {
		const ids = lists.flatMap((list) => (typeof list === 'string' ? list.split(/\s+/) : []));
		return [...new Set(ids.filter(Boolean))].join(' ') || undefined;
	}

	/**
	 * Bits UI trigger props over the forwarded ones, with the event handlers of both kept. The
	 * caller's id and tabindex win; aria-describedby keeps the caller's ids and adds the tooltip's.
	 */
	export function withTrigger(own: TriggerProps, trigger: TriggerProps): TriggerProps {
		const merged = { ...own, ...trigger };
		for (const [key, handler] of Object.entries(trigger)) {
			const mine = own[key];
			if (key.startsWith('on') && typeof handler === 'function' && typeof mine === 'function') {
				merged[key] = (event: Event) => {
					mine(event);
					handler(event);
				};
			}
		}
		for (const key of ['id', 'tabindex']) if (own[key] != null) merged[key] = own[key];
		merged['aria-describedby'] = joinIds(own['aria-describedby'], trigger['aria-describedby']);
		return merged;
	}

	/** A disabled control ignores the click and, as a submit button, doesn't submit its form. */
	export function guardClick(
		disabled: () => boolean,
		...handlers: unknown[]
	): (event: MouseEvent) => void {
		return (event) => {
			if (disabled()) {
				event.preventDefault();
				return;
			}
			for (const handler of handlers) if (typeof handler === 'function') handler(event);
		};
	}
</script>

<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { Icon } from '../icon';
	import { Tooltip } from '../tooltip';

	let {
		class: className,
		variant = 'secundario',
		icon,
		ref = $bindable(null),
		type = 'button',
		disabled = false,
		disabledReason,
		onclick,
		children,
		...restProps
	}: ButtonProps = $props();

	let reasonOpen = $state(false);

	// No focus event fires when the focused button becomes disabled, so its reason opens here.
	$effect(() => {
		if (!disabled) reasonOpen = false;
		else if (disabledReason && ref && ref === document.activeElement) reasonOpen = true;
	});
</script>

{#snippet button(trigger: TriggerProps)}
	{@const merged = withTrigger(restProps, trigger)}
	<!-- The type and the disabled state come last, so neither forwarded nor trigger props can undo them. -->
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant }), className)}
		{...merged}
		{type}
		disabled={undefined}
		aria-disabled={disabled ? 'true' : undefined}
		data-disabled={disabled ? '' : undefined}
		onclickcapture={guardClick(() => disabled, merged.onclickcapture)}
		onclick={guardClick(() => disabled, merged.onclick, onclick)}
	>
		{#if icon}<Icon {icon} size="md" />{/if}
		{@render children?.()}
	</button>
{/snippet}

<!--
	On disabledReason, not on disabled: toggling disabled keeps the same <button>, and its focus.
	Enabled, the tooltip is off, and a Button without a reason needs no TooltipProvider.
-->
{#if disabledReason}
	<Tooltip
		text={disabledReason}
		disabled={!disabled}
		bind:open={reasonOpen}
		id={restProps.id ?? undefined}
		tabindex={restProps.tabindex}
	>
		{#snippet children({ props })}
			{@render button(props)}
		{/snippet}
	</Tooltip>
{:else}
	{@render button({})}
{/if}
