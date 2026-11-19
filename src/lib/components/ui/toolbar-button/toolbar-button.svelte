<script lang="ts" module>
	import { tv } from 'tailwind-variants';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { WithElementRef } from '$lib/utils.js';
	import type { LucideIcon } from '../icon';

	/*
		Componentes (D7) · 3 · Botão de toolbar (55:1346), over buttonVariants({ shape: 'toolbar' }).
		No fill at rest; the selected (pressed) tint holds on hover and press. Tema 3: the contrast
		outline is always drawn (transparent outside the Figma contrast modes), tinted when selected.
	*/
	const toolbarButtonVariants = tv(
		{
			base: 'inset-ring data-disabled:text-toolbar-icon-disabled',
			variants: {
				pressed: {
					false: [
						'text-foreground inset-ring-contrast-outline',
						'not-data-disabled:hover:bg-accent not-data-disabled:active:bg-accent-pressed'
					],
					true: 'bg-primary-tint text-primary-tint-foreground inset-ring-contrast-outline-tint'
				}
			}
		},
		{ twMerge: false }
	);

	export type ToolbarButtonProps = WithElementRef<
		Omit<HTMLButtonAttributes, 'disabled' | 'children' | 'aria-label' | 'aria-pressed'>
	> & {
		icon: LucideIcon;
		/** The accessible name (aria-label). */
		label: string;
		/** The tooltip text; the label when omitted. */
		tooltip?: string;
		/** Shown in the tooltip, e.g. "⌘R". */
		shortcut?: string;
		/** A toggle's state (Selecionado): aria-pressed. Leave undefined for a plain action. */
		pressed?: boolean;
		/** aria-disabled, not native disabled: the button keeps its place in the Tab order. */
		disabled?: boolean;
		/** Why it is disabled; the tooltip shows it instead of the name. */
		disabledReason?: string;
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { buttonVariants, guardClick, withTrigger } from '../button';
	import { Icon } from '../icon';
	import { Tooltip } from '../tooltip';

	let {
		class: className,
		icon,
		label,
		tooltip,
		shortcut,
		pressed,
		ref = $bindable(null),
		type = 'button',
		disabled = false,
		disabledReason,
		onclick,
		...restProps
	}: ToolbarButtonProps = $props();

	const explained = $derived(disabled && Boolean(disabledReason));
</script>

<Tooltip
	text={explained ? (disabledReason as string) : (tooltip ?? label)}
	shortcut={explained ? undefined : shortcut}
>
	{#snippet children({ props })}
		{@const merged = withTrigger(restProps, props)}
		<!-- The name and the disabled state come last, so forwarded props can't undo them. -->
		<button
			bind:this={ref}
			data-slot="toolbar-button"
			class={cn(
				buttonVariants({ shape: 'toolbar' }),
				toolbarButtonVariants({ pressed: pressed === true }),
				className
			)}
			{type}
			{...merged}
			disabled={undefined}
			aria-label={label}
			aria-pressed={pressed === undefined ? undefined : pressed ? 'true' : 'false'}
			aria-disabled={disabled ? 'true' : undefined}
			data-disabled={disabled ? '' : undefined}
			onclick={guardClick(() => disabled, merged.onclick, onclick)}
		>
			<Icon {icon} size="md" />
		</button>
	{/snippet}
</Tooltip>
