<script lang="ts">
	import Toast from './toast.svelte';
	import { toastState } from './toast-state.svelte';
</script>

<!--
	The polite live region stays in the DOM, so VoiceOver hears each toast as it is added (Cor 6).
	Bottom centre, 24 px from the window edge, over the content. The theme comes from tokens.css.
-->
<div
	data-slot="toaster"
	aria-live="polite"
	aria-atomic="true"
	class="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center"
>
	{#if toastState.current}
		{#key toastState.current.id}
			<Toast item={toastState.current} />
		{/key}
	{/if}
</div>
