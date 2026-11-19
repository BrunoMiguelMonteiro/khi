<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import type { ComponentProps, Snippet } from 'svelte';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import DialogOverlay from './dialog-overlay.svelte';
	import DialogPortal from './dialog-portal.svelte';
	import { dialogContent } from './dialog-classes';
	import { dialogBehaviour } from './dialog-behaviour';

	let {
		ref = $bindable(null),
		class: className,
		portalProps,
		initialFocus,
		onOpenAutoFocus,
		onEscapeKeydown,
		onkeydown,
		onkeydowncapture,
		children,
		...restProps
	}: WithoutChildrenOrChild<DialogPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DialogPortal>>;
		children: Snippet;
		/** The field that takes focus on open; by default the first text field, else the window (Q-E). */
		initialFocus?: HTMLElement | null;
	} = $props();

	const behaviour = dialogBehaviour({ content: () => ref, initialFocus: () => initialFocus });
</script>

<DialogPortal {...portalProps}>
	<DialogOverlay />
	<DialogPrimitive.Content
		bind:ref
		data-slot="dialog-content"
		tabindex={-1}
		class={cn(dialogContent, className)}
		onOpenAutoFocus={(e) => {
			onOpenAutoFocus?.(e);
			if (!e.defaultPrevented) behaviour.openAutoFocus(e);
		}}
		onEscapeKeydown={(e) => {
			behaviour.escapeKeydown(e);
			onEscapeKeydown?.(e);
		}}
		onkeydowncapture={(e) => {
			behaviour.keydownCapture(e);
			onkeydowncapture?.(e);
		}}
		onkeydown={(e) => {
			onkeydown?.(e);
			behaviour.keydown(e);
		}}
		{...restProps}
	>
		{@render children?.()}
	</DialogPrimitive.Content>
</DialogPortal>
