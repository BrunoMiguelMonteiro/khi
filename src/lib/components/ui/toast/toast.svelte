<script lang="ts">
	import CircleAlert from 'lucide-svelte/icons/circle-alert';
	import CircleCheck from 'lucide-svelte/icons/circle-check';
	import { Icon } from '../icon';
	import { toastState, type ToastItem } from './toast-state.svelte';

	let { item }: { item: ToastItem } = $props();
</script>

<!--
	Componentes (D7) · 14 · Aviso (57:6346); Movimento 3: in over duration/toast-in with a fade and
	distance/enter from below, ease/out; out over duration/in with the inverse. With Reduzir movimento
	only the fades stay (Movimento 6).
-->
<div
	data-slot="toast"
	data-state={item.closing ? 'closed' : 'open'}
	class={[
		'pointer-events-auto flex w-fit max-w-[calc(100%-3rem)] items-center gap-2 px-4 py-2',
		'rounded-group border-(length:--stroke-border) border-border bg-popover shadow-sombra-aviso',
		'animate-in fade-in-0 slide-in-from-bottom-(length:--distance-enter) duration-(--duration-toast-in) ease-out motion-reduce:slide-in-from-bottom-0',
		'data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-(length:--distance-enter) data-closed:duration-(--duration-in) data-closed:fill-mode-forwards motion-reduce:data-closed:slide-out-to-bottom-0'
	]}
	onanimationend={(event) => {
		// The end of the entry starts the 4 s hold (Movimento 3); the icon has no animation of its own.
		if (event.target === event.currentTarget) toastState.entered(item.id);
	}}
>
	<Icon icon={item.icon === 'error' ? CircleAlert : CircleCheck} class="shrink-0 text-foreground" /><span
		data-slot="toast-text"
		class="min-w-0 truncate text-body-medium whitespace-nowrap text-foreground">{item.text}</span
	>{#if item.action}{' '}<button
			type="button"
			data-slot="toast-action"
			class="shrink-0 rounded-control text-body-medium whitespace-nowrap text-link outline-none select-none hover:underline focus-visible:focus-ring"
			onclick={item.action.onClick}>{item.action.label}</button
		>{/if}
</div>
