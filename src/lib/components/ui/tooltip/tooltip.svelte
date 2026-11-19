<script lang="ts">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import TooltipContent from './tooltip-content.svelte';

	type TriggerProps = Record<string, unknown>;

	let {
		open = $bindable(false),
		text,
		shortcut,
		children,
		...restProps
	}: Omit<TooltipPrimitive.RootProps, 'children'> & {
		text: string;
		/** Variant «Com atalho», e.g. "⌘R". */
		shortcut?: string;
		/** The trigger: spread `props` on the focusable element (`<button {...props}>`). */
		children: Snippet<[{ props: TriggerProps }]>;
	} = $props();
</script>

<TooltipPrimitive.Root bind:open {...restProps}>
	<TooltipPrimitive.Trigger>
		{#snippet child({ props })}
			{@render children({ props })}
		{/snippet}
	</TooltipPrimitive.Trigger>
	<TooltipContent>
		<!-- The space keeps the text and the shortcut apart when read as the trigger's description. -->
		<span>{text}</span>{#if shortcut}{' '}<span
				data-slot="tooltip-shortcut"
				class="text-tooltip-secondary-foreground">{shortcut}</span
			>{/if}
	</TooltipContent>
</TooltipPrimitive.Root>
