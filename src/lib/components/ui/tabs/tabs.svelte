<script lang="ts">
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		value = $bindable(''),
		class: className,
		...restProps
	}: Omit<TabsPrimitive.RootProps, 'activationMode' | 'orientation'> = $props();
</script>

<!-- Automatic activation: the arrows choose, as in the macOS Settings toolbar. -->
<TabsPrimitive.Root
	bind:ref
	bind:value
	data-slot="tabs"
	class={cn('flex flex-col', className)}
	{...restProps}
	activationMode="automatic"
	orientation="horizontal"
/>
