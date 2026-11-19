<script lang="ts">
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let { ref = $bindable(null), class: className, ...restProps }: TabsPrimitive.ListProps = $props();
</script>

<!-- The bar: the tabs centred, gap spacing/1, over a stroke/border rule. -->
<TabsPrimitive.List
	bind:ref
	data-slot="tabs-list"
	class={cn(
		'flex items-center justify-center gap-1 border-b-(length:--stroke-border) border-border',
		className
	)}
	{...restProps}
/>
