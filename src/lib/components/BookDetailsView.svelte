<script lang="ts">
	import { untrack } from 'svelte';
	import { convertFileSrc } from '@tauri-apps/api/core';
	import { _ } from '$lib/i18n';
	import { library } from '$lib/stores/library.svelte';
	import type { Book } from '$lib/types';
	import { Cover } from './ui/cover';
	import { Highlight } from './ui/highlight';
	import { Segmented } from './ui/segmented';

	type Filter = 'all' | 'new' | 'withNotes';

	let { book }: { book: Book } = $props();

	let scroller = $state<HTMLElement>();
	let filter = $state<Filter>('all');

	const isRemoved = (h: Book['highlights'][number]) => h.removedAt !== null;
	const hasNote = (h: Book['highlights'][number]) => (h.annotation?.trim() ?? '') !== '';
	// The marks are the ones the book had when it was opened; never `isNew`, which the store clears.
	const marked = (h: Book['highlights'][number]) => library.viewingNewIds.has(h.id) && !isRemoved(h);

	const total = $derived(book.highlights.length);
	const newCount = $derived(book.highlights.filter(marked).length);
	const removedCount = $derived(book.highlights.filter(isRemoved).length);
	const notesCount = $derived(book.highlights.filter(hasNote).length);
	const counts = $derived<Record<Filter, number>>({ all: total, new: newCount, withNotes: notesCount });
	// A filter with nothing to show is disabled: the view leaves it for good, so a count that comes back later does not pull the list there.
	$effect.pre(() => {
		if (counts[filter] === 0) filter = 'all';
	});
	const active = $derived<Filter>(counts[filter] > 0 ? filter : 'all');
	const shown = $derived(
		active === 'new' ? book.highlights.filter(marked) : active === 'withNotes' ? book.highlights.filter(hasNote) : book.highlights
	);
	const summary = $derived(
		[
			$_('book.highlightsCount', { count: total }),
			newCount > 0 ? $_('book.newCount', { count: newCount }) : null,
			removedCount > 0 ? $_('book.removedCount', { count: removedCount }) : null
		]
			.filter(Boolean)
			.join(' · ')
	);

	// WKWebView has no overflow-anchor: when highlights enter above the visible text, scrollTop is raised by
	// how far the first visible one moved. At the top there is nothing above to keep, so what enters is seen.
	let anchors: { el: HTMLElement; top: number }[] = [];
	const visible = () => {
		if (!scroller) return [];
		const edge = scroller.getBoundingClientRect().top;
		return [...scroller.querySelectorAll<HTMLElement>('[data-slot="highlight"]')]
			.map((el) => ({ el, rect: el.getBoundingClientRect() }))
			.filter(({ rect }) => rect.bottom > edge)
			.map(({ el, rect }) => ({ el, top: rect.top - edge }));
	};
	$effect.pre(() => {
		void shown;
		anchors = untrack(() => (scroller && scroller.scrollTop > 0 ? visible() : []));
	});
	$effect(() => {
		void shown;
		untrack(() => {
			const before = anchors;
			anchors = [];
			// The first visible one still in the list; if it left (removed, filtered out), the next one stands in
			const anchor = before.find(({ el }) => el.isConnected);
			if (!anchor || !scroller) return;
			const moved = anchor.el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - anchor.top;
			if (moved !== 0) scroller.scrollTop += moved;
		});
	});

	function changeFilter() {
		if (scroller) scroller.scrollTop = 0;
	}
</script>

<!--
	Ecrãs · 5 · Detalhe do livro (Figma 71:10560). A column of 560, 32 from the top; the bar above is
	the WindowBar's (Back, Export). The gap of 48 between highlights belongs to this list (Q-H).
-->
<div bind:this={scroller} data-testid="book-details-view" class="h-full overflow-y-auto bg-background px-8 pt-8 pb-16 scroll-pt-8">
	<div class="mx-auto flex max-w-140 flex-col gap-8">
		<header class="flex items-start gap-6">
			<Cover
				class="w-24 shrink-0"
				src={book.coverPath ? convertFileSrc(book.coverPath) : undefined}
				title={book.title}
				author={book.author?.trim() || undefined}
				bookId={book.id}
			/>
			<div class="flex min-w-0 flex-col gap-2">
				<h1 class="text-title-1 text-foreground">{book.title}</h1>
				<p class="text-body text-muted-foreground">{book.author?.trim() || $_('screens.bookDetails.unknownAuthor')}</p>
				<p data-testid="book-details-counts" class="text-callout text-tertiary-foreground">{summary}</p>
			</div>
		</header>

		{#if total > 0}
			<Segmented
				class="self-start"
				label={$_('ui.segmented.label')}
				bind:value={() => active, (v) => (filter = v as Filter)}
				onValueChange={changeFilter}
				segments={[
					{ value: 'all', label: $_('ui.segmented.all'), count: total },
					{ value: 'new', label: $_('ui.segmented.new'), count: newCount, emptyReason: $_('ui.segmented.noNew') },
					{ value: 'withNotes', label: $_('ui.segmented.withNotes'), count: notesCount, emptyReason: $_('ui.segmented.noNotes') }
				]}
			/>
			<div data-testid="highlights-list" class="mt-4 flex flex-col gap-12">
				{#each shown as highlight (highlight.id)}
					<Highlight {highlight} isNew={library.viewingNewIds.has(highlight.id)} />
				{/each}
			</div>
		{/if}
	</div>
</div>
