<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { dialogTitle } from './dialog-classes';

	let { ref = $bindable(null), class: className, ...restProps }: DialogPrimitive.TitleProps = $props();
</script>

<DialogPrimitive.Title bind:ref data-slot="dialog-title" class={cn(dialogTitle, className)} {...restProps} />
