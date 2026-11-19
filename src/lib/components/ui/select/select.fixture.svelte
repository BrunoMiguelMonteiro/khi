<script lang="ts">
	// Test fixture for select.test.ts: the Select under a TooltipProvider, with value and open bound
	// to the fixture's own state, as a screen would bind them; onbound and onboundopen report them.
	import { TooltipProvider } from '../tooltip';
	import { Select, type SelectProps } from './index';

	let {
		value = $bindable(),
		open = $bindable(false),
		onbound,
		onboundopen,
		...props
	}: SelectProps & {
		onbound?: (value: string | undefined) => void;
		onboundopen?: (open: boolean) => void;
	} = $props();

	$effect.pre(() => onbound?.(value));
	$effect.pre(() => onboundopen?.(open));
</script>

<TooltipProvider>
	<Select bind:value bind:open {...props} />
</TooltipProvider>
