<script lang="ts">
	// Test fixture for switch.test.ts: the Switch under a TooltipProvider, with checked bound
	// to the fixture's own state, as a screen would bind it; onbound reports each bound value.
	import { TooltipProvider } from '../tooltip';
	import { Switch, type SwitchProps } from './index';

	let {
		checked = $bindable(false),
		onbound,
		...props
	}: SwitchProps & { onbound?: (checked: boolean) => void } = $props();

	$effect.pre(() => onbound?.(checked));
</script>

<TooltipProvider>
	<Switch bind:checked {...props} />
</TooltipProvider>
