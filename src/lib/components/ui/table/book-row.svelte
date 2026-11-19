<script lang="ts" module>
	import type { HTMLAttributes } from 'svelte/elements';
	import type { BookCardBook } from '../book-card';

	/** The card's book, plus when it was last read, already formatted by the screen. */
	export type BookRowBook = BookCardBook & { lastRead?: string };

	export type BookRowProps = Omit<HTMLAttributes<HTMLTableRowElement>, 'children'> & {
		book: BookRowBook;
		selected?: boolean;
	};

	/** Column widths (Linha da lista, 66:4618), shared with the column headers. */
	export const BOOK_ROW_COLUMNS = {
		title: 'min-w-0 flex-1',
		author: 'w-50 shrink-0',
		highlights: 'w-22 shrink-0',
		lastRead: 'w-30 shrink-0'
	} as const;

	// Whole classes per state. Unselected: a 1 px border separator at the bottom, hidden on hover, on the last row and on the row above a selected or hovered one,
	// and an accent hover. Selected (and focused, Componentes 4): primary, no ring, no animation.
	const ROW = {
		idle: 'text-foreground transition-[background-color] duration-(--duration-hover) ease-hover hover:bg-accent after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border hover:after:hidden last:after:hidden has-[+[aria-selected=true]]:after:hidden has-[+:hover]:after:hidden',
		selected: 'bg-primary text-primary-foreground'
	} as const;
	const STRONG = { idle: 'text-foreground', selected: 'text-primary-foreground' } as const;
	const MUTED = { idle: 'text-muted-foreground', selected: 'text-primary-foreground' } as const;
</script>

<script lang="ts">
	import { _ } from '$lib/i18n';
	import { cn } from '$lib/utils';
	import { Badge } from '../badge';
	import { Thumbnail } from '../cover';
	import Cell from './table-cell.svelte';
	import Row from './table-row.svelte';

	let { book, selected = false, class: className, ...restProps }: BookRowProps = $props();

	const state = $derived(selected ? 'selected' : 'idle');
	const newCount = $derived(book.newCount ?? 0);
</script>

<!-- Componentes (D7) · 19 · Linha da lista (66:4618). role="row": a flex tr can lose its table role in WebKit. -->
<Row
	role="row"
	aria-selected={selected}
	data-slot="book-row"
	class={cn(
		'relative flex h-11 items-center gap-4 rounded-control border-b-0 px-2',
		ROW[state],
		className
	)}
	{...restProps}
>
	<Cell
		data-slot="book-row-title"
		class={cn('flex items-center gap-2 px-0', BOOK_ROW_COLUMNS.title, STRONG[state])}
	>
		<Thumbnail src={book.coverSrc} bookId={book.id} />
		<span data-slot="book-row-title-text" class="min-w-0 truncate text-body-medium">
			{book.title}
		</span>
		{#if newCount > 0}
			<Badge class="shrink-0">{$_('book.newCount', { count: newCount })}</Badge>
		{/if}
	</Cell>
	<Cell
		data-slot="book-row-author"
		class={cn('truncate px-0 text-body', BOOK_ROW_COLUMNS.author, MUTED[state])}
	>
		{book.author?.trim() || $_('book.unknownAuthor')}
	</Cell>
	<Cell
		data-slot="book-row-highlights"
		class={cn(
			'px-0 text-right text-body tabular-nums',
			BOOK_ROW_COLUMNS.highlights,
			STRONG[state]
		)}
	>
		{book.highlightCount}
	</Cell>
	<Cell
		data-slot="book-row-last-read"
		class={cn('truncate px-0 text-body', BOOK_ROW_COLUMNS.lastRead, MUTED[state])}
	>
		{book.lastRead ?? ''}
	</Cell>
</Row>
