<script lang="ts">
	// Test harness: the swatches' tooltips need the provider that the Settings page puts around its panes.
	import { TooltipProvider } from '$lib/components/ui/tooltip';
	import AppearancePane from './AppearancePane.svelte';

	let { onerror }: { onerror?: (message: string | null) => void } = $props();
</script>

<TooltipProvider>
	<AppearancePane {onerror} />
</TooltipProvider>
