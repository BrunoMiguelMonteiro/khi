<script lang="ts">
	// Test fixture for window-bar.test.ts: the WindowBar under a TooltipProvider, as a screen mounts it.
	import { TooltipProvider } from '../tooltip';
	import { WindowBar, type WindowBarProps } from './index';

	let props: WindowBarProps = $props();
</script>

<TooltipProvider>
	<WindowBar {...props} />
</TooltipProvider>
