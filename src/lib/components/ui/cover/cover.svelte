<script lang="ts" module>
	export type CoverProps = {
		src?: string;
		title: string;
		author?: string;
		bookId: number | string;
		newCount?: number;
		/** `sm` is the small cover (96 px, in the Detail): «Capa/Título pequeno». */
		size?: 'md' | 'sm';
		/** The badge comes in with a 250 ms fade: only when a Sync ends, never when a card is merely shown again. */
		badgeEnter?: boolean;
		class?: string;
	};
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { _ } from '$lib/i18n';
	import { cn } from '$lib/utils';
	import { Badge } from '../badge';
	import { COVER_BG, coverTone } from './cover-tone';
	import { canvasMeasure, coverTitle } from './cover-title';

	let { src, title, author, bookId, newCount = 0, size = 'md', badgeEnter = false, class: className }: CoverProps = $props();

	// Movimento 3: when the new highlights run out (exported), the badge keeps its last number and
	// fades out; it leaves the DOM when the fade ends.
	let leaving = $state<number | null>(null);
	let previous = untrack(() => newCount);
	// Latched when the badge appears during the entrance window; it stays until the badge is gone
	let entering = $state(untrack(() => badgeEnter && newCount > 0));
	$effect.pre(() => {
		const count = newCount;
		untrack(() => {
			if (count <= 0) entering = false;
			else if (previous <= 0 && badgeEnter) entering = true;
			if (count > 0) leaving = null;
			else if (previous > 0) leaving = previous;
			previous = count;
		});
	});
	// Short words are bound to the next with U+00A0 when the pair fits the title's width, and the
	// browser may hyphenate only when a word alone does not fit. It is measured on a canvas in the
	// computed font, so it is measured again when the font loads, when the cover changes width and
	// when `size` changes. `measured` remembers which title it is for.
	let coverEl = $state<HTMLElement>();
	let titleEl = $state<HTMLElement>();
	let measured = $state<{ title: string; text: string; hyphenate: boolean } | null>(null);
	const current = $derived(measured?.title === title ? measured : null);
	const shownTitle = $derived(current?.text ?? title);
	$effect(() => {
		const el = titleEl;
		const text = title;
		void size;
		if (!el || !coverEl) return;
		let live = true;
		const measure = () => {
			if (!live) return;
			measured = { title: text, ...coverTitle(text, el.getBoundingClientRect().width, canvasMeasure(el)) };
		};
		measure();
		const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
		observer?.observe(coverEl);
		// `ready` covers a font that is still loading; `loadingdone` a late one (and does not depend on the order of the calls).
		const fonts = document.fonts;
		void fonts?.ready.then(measure);
		fonts?.addEventListener?.('loadingdone', measure);
		return () => {
			live = false;
			observer?.disconnect();
			fonts?.removeEventListener?.('loadingdone', measure);
		};
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

<!-- Componentes (D7) · 16 · Capa (63:3281). The badge enters with a 250 ms fade only when a Sync ends (`badgeEnter`), shown with the header; a fade only, so Reduzir movimento keeps it. No overflow-hidden here: the card's focus ring is an outline on this element. -->
<div
	bind:this={coverEl}
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
		<p
			bind:this={titleEl}
			aria-hidden="true"
			lang="pt"
			class={cn(
				'line-clamp-4 wrap-anywhere text-cover-foreground',
				current?.hyphenate ? 'hyphens-auto' : 'hyphens-manual',
				size === 'sm' ? 'text-cover-title-sm' : 'text-cover-title'
			)}
		>
			{shownTitle}
		</p>
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
			class={cn(
				'absolute bottom-2 left-2',
				entering && 'animate-in fade-in-0 duration-(--duration-reveal) ease-out',
				'data-closed:animate-out data-closed:fade-out-0 data-closed:duration-(--duration-out) data-closed:ease-out data-closed:fill-mode-forwards'
			)}
			data-closed={closing ? '' : undefined}
			aria-hidden={closing ? 'true' : undefined}
			onanimationend={() => closing && (leaving = null)}
			{...{ onanimationcancel: () => closing && (leaving = null) }}
		>
			{$_('book.newCount', { count: badgeCount })}
		</Badge>
	{/if}
</div>
