<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { dialogOverlay } from '../dialog/dialog-classes';

	let { ref = $bindable(null), class: className, ...restProps }: AlertDialogPrimitive.OverlayProps = $props();
</script>

<AlertDialogPrimitive.Overlay
	bind:ref
	data-slot="alert-dialog-overlay"
	class={cn(dialogOverlay, className)}
	{...restProps}
/>
