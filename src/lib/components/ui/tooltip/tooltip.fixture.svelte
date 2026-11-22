<script lang="ts">
	// Test fixture for tooltip.test.ts: two triggers under the provider, as a toolbar would have.
	import { Tooltip, TooltipProvider } from './index';
</script>

<TooltipProvider>
	<Tooltip text="Sincronizar com o Kobo" shortcut="⌘R">
		{#snippet children({ props })}
			<button {...props}>Sincronizar</button>
		{/snippet}
	</Tooltip>
	<Tooltip text="Exportar">
		{#snippet children({ props })}
			<button {...props}>Exportar</button>
		{/snippet}
	</Tooltip>
</TooltipProvider>
