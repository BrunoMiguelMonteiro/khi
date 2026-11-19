<script lang="ts">
	// Test fixture for checkbox.test.ts: the Checkbox under a TooltipProvider, with checked bound
	// to the fixture's own state, as a screen would bind it; onbound reports each bound value.
	import { TooltipProvider } from '../tooltip';
	import { Checkbox, type CheckboxProps } from './index';

	let {
		checked = $bindable(false),
		onbound,
		...props
	}: CheckboxProps & { onbound?: (checked: boolean) => void } = $props();

	$effect.pre(() => onbound?.(checked));
</script>

<TooltipProvider>
	<Checkbox bind:checked {...props} />
</TooltipProvider>
