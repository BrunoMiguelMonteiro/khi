<script lang="ts" module>
	import type { HTMLAttributes } from 'svelte/elements';
	import type { BookCardBook } from '../book-card';

	/** The card's book, plus when it was last read, already formatted by the screen. */
	export type BookRowBook = BookCardBook & { lastRead?: string };

	export type BookRowProps = Omit<HTMLAttributes<HTMLTableRowElement>, 'children'> & {
		book: BookRowBook;
		selected?: boolean;
		/** Some row of the list is selected: every row shows its selection box, not only the hovered one. */
		selecting?: boolean;
		/** The «N novos» badge comes in with a fade: the list says so only when a Sync ends. */
		badgeEnter?: boolean;
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
		idle: 'text-foreground outline-none focus-visible:focus-ring transition-[background-color] duration-(--duration-hover) ease-hover hover:bg-accent after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border hover:after:hidden last:after:hidden has-[+[aria-selected=true]]:after:hidden has-[+:hover]:after:hidden',
		selected: 'bg-primary text-primary-foreground outline-none'
	} as const;
	const STRONG = { idle: 'text-foreground', selected: 'text-primary-foreground' } as const;
	const MUTED = { idle: 'text-muted-foreground', selected: 'text-primary-foreground' } as const;
</script>

<script lang="ts">
	import Check from 'lucide-svelte/icons/check';
	import { _ } from '$lib/i18n';
	import { cn } from '$lib/utils';
	import { Badge } from '../badge';
	import { Thumbnail } from '../cover';
	import { Icon } from '../icon';
	import Cell from './table-cell.svelte';
	import Row from './table-row.svelte';

	let { book, selected = false, selecting = false, badgeEnter = false, class: className, ...restProps }: BookRowProps = $props();

	const state = $derived(selected ? 'selected' : 'idle');
	const newCount = $derived(book.newCount ?? 0);
</script>

<!-- Componentes (D7) · 19 · Linha da lista (66:4618). role="row": a flex tr can lose its table role in WebKit. -->
<Row
	role="row"
	aria-selected={selected}
	data-slot="book-row"
	data-selecting={selecting ? '' : undefined}
	class={cn(
		'group/row relative flex h-11 items-center gap-4 rounded-control border-b-0 px-2',
		ROW[state],
		className
	)}
	{...restProps}
>
	<Cell
role="gridcell"
		data-slot="book-row-title"
		class={cn('flex items-center gap-2 px-0', BOOK_ROW_COLUMNS.title, STRONG[state])}
	>
		<!--
			Q-L, L1: a 24 slot, always reserved, and 8 of gap (the cell's) before the thumbnail. The box is the grid card's, drawn in the slot;
			its hit area is the row's leading strip, 36 × 44 (8 in, 24 slot, 4 more). Not a button: the list reads the click (library-list.svelte).
			Rule B: hidden, and click-through (the click opens the book), until hover, focus or a selection shows it.
			`group-[:hover]/row`, not `group-hover/row`: app.css redefines group-hover as a v3 variant that ignores the group name.
		-->
		<span aria-hidden="true" class="size-6 shrink-0"></span>
		<span
			aria-hidden="true"
			data-slot="selection-box"
			data-state={selected ? 'checked' : 'unchecked'}
			class={cn(
				'absolute inset-y-0 left-0 flex w-9 items-center pl-2',
				!selected &&
					'pointer-events-none opacity-0 transition-opacity duration-(--duration-out) ease-out group-[:hover]/row:pointer-events-auto group-[:hover]/row:opacity-100 group-focus-visible/row:pointer-events-auto group-focus-visible/row:opacity-100 group-data-[selecting]/row:pointer-events-auto group-data-[selecting]/row:opacity-100 motion-reduce:transition-none'
			)}
		>
			<span class="flex size-6 items-center justify-center">
				{#if selected}
					<span class="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
						<Icon icon={Check} size="sm" />
					</span>
				{:else}
					<span class="size-5 rounded-full bg-selection-box shadow-selection-box group-[:hover]/row:bg-selection-box-hover"></span>
				{/if}
			</span>
		</span>
		<Thumbnail src={book.coverSrc} bookId={book.id} />
		<span data-slot="book-row-title-text" class="min-w-0 truncate text-body-medium">
			{book.title}
		</span>
		{#if newCount > 0}
			<Badge class={cn('shrink-0', badgeEnter && 'animate-in fade-in-0 duration-(--duration-reveal) ease-out')}>{$_('book.newCount', { count: newCount })}</Badge>
		{/if}
	</Cell>
	<Cell
role="gridcell"
		data-slot="book-row-author"
		class={cn('truncate px-0 text-body', BOOK_ROW_COLUMNS.author, MUTED[state])}
	>
		{book.author?.trim() || $_('book.unknownAuthor')}
	</Cell>
	<Cell
role="gridcell"
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
role="gridcell"
		data-slot="book-row-last-read"
		class={cn('truncate px-0 text-body', BOOK_ROW_COLUMNS.lastRead, MUTED[state])}
	>
		{book.lastRead ?? ''}
	</Cell>
</Row>
