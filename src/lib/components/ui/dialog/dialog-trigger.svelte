<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { dialogTrigger } from './dialog-behaviour';

	let {
		ref = $bindable(null),
		type = 'button',
		onclick,
		onkeydown,
		...restProps
	}: DialogPrimitive.TriggerProps = $props();

	const trigger = dialogTrigger();
</script>

<DialogPrimitive.Trigger
	bind:ref
	data-slot="dialog-trigger"
	{type}
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
