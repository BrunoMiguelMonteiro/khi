<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';

	/**
	 * `value` is a percentage; `null` is an indeterminate bar (a segment of a third sliding in a loop,
	 * Q2), which has no aria-valuenow.
	 */
	let {
		ref = $bindable(null),
		value = null,
		class: className,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & { value?: number | null } = $props();

	const percent = $derived(value === null ? null : Math.min(100, Math.max(0, value)));
</script>

<!--
	Atualizações · Barra de progresso (Figma 78:24014): 6 px, muted track and primary fill, radius 3
	(the full height, so rounded-full). `progress-indicators.md`: a determinate bar when the end is known.
	Indeterminate: the segment is 1/3 of the track and slides from the left edge to the right one;
	with Reduzir movimento it stays still in the middle (translate-x-full: one segment from the left).
-->
<div
	bind:this={ref}
	data-slot="progress"
	role="progressbar"
	aria-valuemin={percent === null ? undefined : 0}
	aria-valuemax={percent === null ? undefined : 100}
	aria-valuenow={percent === null ? undefined : Math.round(percent)}
	class={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
	{...restProps}
>
	{#if percent === null}
		<div class="h-full w-1/3 rounded-full bg-primary animate-indeterminate motion-reduce:animate-none motion-reduce:translate-x-full"></div>
	{:else}
		<div class="h-full rounded-full bg-primary transition-[width] duration-200" style:width="{percent}%"></div>
	{/if}
</div>
