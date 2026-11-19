<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import type { WithoutChildrenOrChild } from '$lib/utils.js';
	import { Button, type ButtonProps } from '../button';

	/** Cancelar: a Secundário button that closes the window, as Esc and ⌘. do. */
	let {
		ref = $bindable(null),
		class: className,
		disabled = false,
		disabledReason,
		children,
		...restProps
	}: WithoutChildrenOrChild<AlertDialogPrimitive.CancelProps> &
		Pick<ButtonProps, 'disabledReason' | 'children'> = $props();
</script>

<AlertDialogPrimitive.Cancel bind:ref {disabled} {...restProps}>
	{#snippet child({ props })}
		<Button
			{...props}
			data-slot="alert-dialog-cancel"
			variant="secundario"
			class={className}
			disabled={disabled ?? false}
			{disabledReason}
		>
			{@render children?.()}
		</Button>
	{/snippet}
</AlertDialogPrimitive.Cancel>
