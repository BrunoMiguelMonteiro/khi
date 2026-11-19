<script lang="ts" module>
	export type CoverProps = {
		src?: string;
		title: string;
		author?: string;
		bookId: number | string;
		newCount?: number;
		class?: string;
	};
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { _ } from '$lib/i18n';
	import { cn } from '$lib/utils';
	import { Badge } from '../badge';
	import { COVER_BG, coverTone } from './cover-tone';

	let { src, title, author, bookId, newCount = 0, class: className }: CoverProps = $props();

	// Movimento 3: when the new highlights run out (exported), the badge keeps its last number and
	// fades out; it leaves the DOM when the fade ends.
	let leaving = $state<number | null>(null);
	let previous = untrack(() => newCount);
	$effect.pre(() => {
		const count = newCount;
		untrack(() => {
			if (count > 0) leaving = null;
			else if (previous > 0) leaving = previous;
			previous = count;
		});
	});
	const badgeCount = $derived(newCount > 0 ? newCount : leaving);
	// onanimationcancel is missing from Svelte's attribute types, so it goes in through a spread.
	const closing = $derived(newCount <= 0 && leaving !== null);

	// If the fade is cancelled or never reports its end, the badge still leaves: duration/out
	// (150 ms) plus a margin. The cleanup covers a new count and the unmount.
	$effect(() => {
		if (!closing) return;
		const timer = setTimeout(() => (leaving = null), 200);
		return () => clearTimeout(timer);
	});
</script>

<!-- Componentes (D7) · 16 · Capa (63:3281). No overflow-hidden here: the card's focus ring is an outline on this element. -->
<div
	data-slot="cover"
	class={cn(
		'relative aspect-2/3 rounded-cover',
		!src && 'flex flex-col gap-1 p-3',
		!src && COVER_BG[coverTone(bookId)],
		className
	)}
>
	{#if src}
		<img
			{src}
			alt=""
			class="absolute inset-0 size-full overflow-hidden rounded-cover object-cover"
		/>
	{:else}
		<p aria-hidden="true" class="line-clamp-4 text-cover-title text-cover-foreground">{title}</p>
		{#if author}
			<p aria-hidden="true" class="truncate text-cover-author text-cover-foreground">{author}</p>
		{/if}
	{/if}
	<!-- Componentes 6: the 1 px edge is painted over the image, inside. -->
	<span
		aria-hidden="true"
		data-slot="cover-border"
		class="pointer-events-none absolute inset-0 rounded-cover inset-ring inset-ring-cover-border"
	></span>
	{#if badgeCount !== null}
		<Badge
			class="absolute bottom-2 left-2 data-closed:animate-out data-closed:fade-out-0 data-closed:duration-(--duration-out) data-closed:ease-out data-closed:fill-mode-forwards"
			data-closed={closing ? '' : undefined}
			aria-hidden={closing ? 'true' : undefined}
			onanimationend={() => closing && (leaving = null)}
			{...{ onanimationcancel: () => closing && (leaving = null) }}
		>
			{$_('book.newCount', { count: badgeCount })}
		</Badge>
	{/if}
</div>
