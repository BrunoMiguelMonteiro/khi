<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import type { WithoutChildrenOrChild } from '$lib/utils.js';
	import { Button, type ButtonProps } from '../button';
	import { destructiveText, type DialogActionVariant } from '../dialog/dialog-classes';

	/**
	 * The window's action. `principal` is the default button (Return presses it); `destructive` is
	 * Secundário with destructive-text and no default (Q-A). Closing is the caller's, after acting.
	 */
	let {
		ref = $bindable(null),
		class: className,
		variant = 'principal',
		disabled = false,
		disabledReason,
		icon,
		children,
		...restProps
	}: WithoutChildrenOrChild<AlertDialogPrimitive.ActionProps> &
		Pick<ButtonProps, 'disabledReason' | 'icon' | 'children'> & { variant?: DialogActionVariant } = $props();
</script>

<AlertDialogPrimitive.Action bind:ref {...restProps}>
	{#snippet child({ props })}
		<Button
			{...props}
			data-dialog-default={variant === 'principal' ? '' : undefined}
			data-slot="alert-dialog-action"
			variant={variant === 'principal' ? 'principal' : 'secundario'}
			class={cn(variant === 'destructive' && destructiveText, className)}
			{icon}
			disabled={disabled ?? false}
			{disabledReason}
		>
			{@render children?.()}
		</Button>
	{/snippet}
</AlertDialogPrimitive.Action>
