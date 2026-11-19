<script lang="ts">
	// Test fixture for select.test.ts: the Select under a TooltipProvider, with value bound to the
	// fixture's own state, as a screen would bind it; onbound reports each bound value.
	import { TooltipProvider } from '../tooltip';
	import { Select, type SelectProps } from './index';

	let {
		value = $bindable(),
		onbound,
		...props
	}: SelectProps & { onbound?: (value: string | undefined) => void } = $props();

	$effect.pre(() => onbound?.(value));
</script>

<TooltipProvider>
	<Select bind:value {...props} />
</TooltipProvider>
