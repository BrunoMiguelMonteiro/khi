<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import { dialogTrigger } from '../dialog/dialog-behaviour';

	let {
		ref = $bindable(null),
		onclick,
		onkeydown,
		...restProps
	}: AlertDialogPrimitive.TriggerProps = $props();

	const trigger = dialogTrigger();
</script>

<AlertDialogPrimitive.Trigger
	bind:ref
	data-slot="alert-dialog-trigger"
	onclick={(e) => {
		trigger.click(e);
		onclick?.(e);
	}}
	onkeydown={(e) => {
		trigger.keydown(e);
		onkeydown?.(e);
	}}
	{...restProps}
/>
