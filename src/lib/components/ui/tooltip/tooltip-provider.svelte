<script lang="ts">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';

	// delay/tooltip 500 ms; 300 ms is the Bits UI default for "the next one opens at once".
	// Not hoverable, so leaving the trigger closes the tooltip at once (Movimento 5).
	let {
		delayDuration = 500,
		skipDelayDuration = 300,
		disableHoverableContent = true,
		...restProps
	}: TooltipPrimitive.ProviderProps = $props();
</script>

<TooltipPrimitive.Provider {delayDuration} {skipDelayDuration} {disableHoverableContent} {...restProps} />
