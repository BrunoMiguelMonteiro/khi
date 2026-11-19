<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { Button, type ButtonProps } from '../button';
	import { destructiveText, type DialogActionVariant } from './dialog-classes';

	/**
	 * The window's action. `principal` is the default button (Return presses it); `destructive` is
	 * Secundário with destructive-text and no default (Q-A). Closing is the caller's, after acting.
	 */
	let {
		ref = $bindable(null),
		class: className,
		variant = 'principal',
		children,
		...restProps
	}: Omit<ButtonProps, 'variant'> & { variant?: DialogActionVariant } = $props();
</script>

<Button
	bind:ref
	{...restProps}
	data-dialog-default={variant === 'principal' ? '' : undefined}
	data-slot="dialog-action"
	variant={variant === 'principal' ? 'principal' : 'secundario'}
	class={cn(variant === 'destructive' && destructiveText, className)}
>
	{@render children?.()}
</Button>
