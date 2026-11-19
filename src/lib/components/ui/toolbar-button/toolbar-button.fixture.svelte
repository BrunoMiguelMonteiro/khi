<script lang="ts">
	// Test fixture for toolbar-button.test.ts: the ToolbarButton under a TooltipProvider and inside a form, as a toolbar would have it.
	import { TooltipProvider } from '../tooltip';
	import { ToolbarButton, type ToolbarButtonProps } from './index';

	let { onsubmit, ...props }: ToolbarButtonProps & { onsubmit?: () => void } = $props();
</script>

<TooltipProvider>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			onsubmit?.();
		}}
	>
		<ToolbarButton {...props} />
	</form>
</TooltipProvider>
