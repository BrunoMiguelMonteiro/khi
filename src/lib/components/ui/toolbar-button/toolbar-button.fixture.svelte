<script lang="ts">
	// Test fixture for toolbar-button.test.ts: the ToolbarButton under a TooltipProvider, as a toolbar would have it.
	import { TooltipProvider } from '../tooltip';
	import { ToolbarButton, type ToolbarButtonProps } from './index';

	let props: ToolbarButtonProps = $props();
</script>

<TooltipProvider>
	<ToolbarButton {...props} />
</TooltipProvider>
