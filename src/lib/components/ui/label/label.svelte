<script lang="ts">
	import { Label as LabelPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: LabelPrimitive.RootProps = $props();
</script>

<!-- Interface/Body in foreground: the label of a Linha de formulário (55:3552). -->
<LabelPrimitive.Root
	bind:ref
	data-slot="label"
	class={cn('text-body text-foreground select-none', className)}
	{...restProps}
/>
