<script lang="ts">
	import { tick } from 'svelte';
	import Toast from './toast.svelte';
	import { toastState } from './toast-state.svelte';

	let region: HTMLDivElement;
	let hovered = $state(false);
	let focused = $state(false);

	// WCAG 2.2.1: the pointer or the focus on the toast holds it (Cor 6). Tracked here, on the
	// region that outlives each toast, so a toast that replaces the hovered one stays held.
	$effect(() => toastState.setPaused(hovered || focused));

	// A focused action leaves with its toast without a focusout in every engine: look again.
	$effect(() => {
		void toastState.current?.id;
		tick().then(() => {
			if (region) focused = region.contains(document.activeElement);
		});
	});

	// Without a Toaster nothing can show, pause or end a toast: drop it with its timers, so a
	// later Toaster does not bring back one that was paused when this one went away.
	$effect(() => () => toastState.reset());
</script>

<!--
	The polite live region stays in the DOM, so VoiceOver hears each toast as it is added (Cor 6).
	Bottom centre, 24 px from the window edge, over the content. The theme comes from tokens.css.
	Only the toast takes the pointer; the region hears its pointer and focus events as they bubble.
-->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={region}
	data-slot="toaster"
	aria-live="polite"
	aria-atomic="true"
	class="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center"
	onpointerenter={() => (hovered = true)}
	onpointerleave={() => (hovered = false)}
	onfocusin={() => (focused = true)}
	onfocusout={(event) => {
		if (!region.contains(event.relatedTarget as Node | null)) focused = false;
	}}
>
	{#if toastState.current}
		{#key toastState.current.id}
			<Toast item={toastState.current} />
		{/key}
	{/if}
</div>
