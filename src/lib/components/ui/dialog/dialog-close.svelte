<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
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
	}: WithoutChildrenOrChild<DialogPrimitive.CloseProps> &
		Pick<ButtonProps, 'disabledReason' | 'children'> = $props();
</script>

<DialogPrimitive.Close bind:ref {disabled} {...restProps}>
	{#snippet child({ props })}
		<Button {...props} data-slot="dialog-close" variant="secundario" class={className} disabled={disabled ?? false} {disabledReason}>
			{@render children?.()}
		</Button>
	{/snippet}
</DialogPrimitive.Close>
