<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import type { ComponentProps, Snippet } from 'svelte';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import AlertDialogOverlay from './alert-dialog-overlay.svelte';
	import AlertDialogPortal from './alert-dialog-portal.svelte';
	import { dialogContent } from '../dialog/dialog-classes';
	import { dialogBehaviour } from '../dialog/dialog-behaviour';

	let {
		ref = $bindable(null),
		class: className,
		portalProps,
		initialFocus,
		onOpenAutoFocus,
		onCloseAutoFocus,
		onEscapeKeydown,
		onkeydown,
		onkeydowncapture,
		children,
		...restProps
	}: WithoutChildrenOrChild<AlertDialogPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof AlertDialogPortal>>;
		children: Snippet;
		/** The field that takes focus on open; by default the first text field, else the window (Q-E). */
		initialFocus?: HTMLElement | null;
	} = $props();

	const behaviour = dialogBehaviour({ content: () => ref, initialFocus: () => initialFocus });
</script>

<AlertDialogPortal {...portalProps}>
	<AlertDialogOverlay />
	<AlertDialogPrimitive.Content
		bind:ref
		data-slot="alert-dialog-content"
		tabindex={-1}
		class={cn(dialogContent, className)}
		onOpenAutoFocus={(e) => {
			onOpenAutoFocus?.(e);
			if (!e.defaultPrevented) behaviour.openAutoFocus(e);
		}}
		onCloseAutoFocus={(e) => {
			onCloseAutoFocus?.(e);
			if (!e.defaultPrevented) behaviour.closeAutoFocus(e);
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
	</AlertDialogPrimitive.Content>
</AlertDialogPortal>
