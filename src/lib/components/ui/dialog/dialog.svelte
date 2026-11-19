<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { setDialogCancel } from './dialog-behaviour';

	let { open = $bindable(false), onOpenChange, ...restProps }: DialogPrimitive.RootProps = $props();

	// ⌘. closes as Esc and Cancelar do; Bits UI calls onOpenChange only for its own changes.
	setDialogCancel(() => {
		open = false;
		onOpenChange?.(false);
	});
</script>

<DialogPrimitive.Root bind:open {onOpenChange} {...restProps} />
