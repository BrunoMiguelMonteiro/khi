<script lang="ts">
	// Test fixture for swatch.test.ts: the SwatchGroup under a TooltipProvider, with value bound to
	// the fixture's own state, as Settings would bind it; onbound reports each value.
	import { TooltipProvider } from '../tooltip';
	import { SwatchGroup, type SwatchGroupProps, type SwatchValue } from './index';

	let {
		value = $bindable<SwatchValue>('system'),
		onbound,
		...props
	}: SwatchGroupProps & { onbound?: (value: SwatchValue) => void } = $props();

	$effect.pre(() => onbound?.(value));
</script>

<TooltipProvider>
	<SwatchGroup bind:value {...props} />
</TooltipProvider>
