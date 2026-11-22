<script lang="ts">
	// Test fixture for view-group.test.ts: the ViewGroup under a TooltipProvider, with value bound
	// to the fixture's own state, as the Library toolbar would bind it; onbound reports each value.
	import { TooltipProvider } from '../tooltip';
	import { ViewGroup, type ViewGroupProps, type ViewMode } from './index';

	let {
		value = $bindable<ViewMode>('grid'),
		onbound,
		...props
	}: ViewGroupProps & { onbound?: (value: ViewMode) => void } = $props();

	$effect.pre(() => onbound?.(value));
</script>

<TooltipProvider>
	<ViewGroup bind:value {...props} />
</TooltipProvider>
