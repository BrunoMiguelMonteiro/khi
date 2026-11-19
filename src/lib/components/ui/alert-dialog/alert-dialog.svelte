<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import { setDialogCancel } from '../dialog/dialog-behaviour';

	let { open = $bindable(false), onOpenChange, ...restProps }: AlertDialogPrimitive.RootProps = $props();

	// ⌘. closes as Esc and Cancelar do; Bits UI calls onOpenChange only for its own changes.
	setDialogCancel(() => {
		open = false;
		onOpenChange?.(false);
	});
</script>

<AlertDialogPrimitive.Root bind:open {onOpenChange} {...restProps} />
