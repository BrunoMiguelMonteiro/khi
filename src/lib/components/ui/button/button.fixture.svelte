<script lang="ts">
	// Test fixture for button.test.ts: the Button under a TooltipProvider and inside a form, as a screen would have it.
	import { TooltipProvider } from '../tooltip';
	import { Button, type ButtonProps } from './index';

	let {
		text = 'Exportar',
		onsubmit,
		...props
	}: ButtonProps & { text?: string; onsubmit?: () => void } = $props();
</script>

<TooltipProvider>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			onsubmit?.();
		}}
	>
		<Button {...props}>{text}</Button>
	</form>
</TooltipProvider>
