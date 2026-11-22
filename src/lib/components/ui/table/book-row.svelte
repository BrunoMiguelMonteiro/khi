<script lang="ts" module>
	import type { HTMLAttributes } from 'svelte/elements';
	import type { BookCardBook } from '../book-card';

	/** The card's book, plus when it was last read, already formatted by the screen. */
	export type BookRowBook = BookCardBook & { lastRead?: string };

	export type BookRowProps = Omit<HTMLAttributes<HTMLTableRowElement>, 'children'> & {
		book: BookRowBook;
		selected?: boolean;
		/** A narrow window: no «Última leitura» cell, and the Autor column is 160 wide. */
		narrow?: boolean;
		/** The «N novos» badge comes in with a fade: the list says so only when a Sync ends. */
		badgeEnter?: boolean;
	};

	/** Column widths (Linha da lista, 66:4618), shared with the column headers. */
	export const BOOK_ROW_COLUMNS = {
		title: 'min-w-0 flex-1',
		author: 'w-50 shrink-0',
		authorNarrow: 'w-40 shrink-0',
		highlights: 'w-22 shrink-0',
		lastRead: 'w-30 shrink-0'
	} as const;

	// Whole classes per state. Unselected: a 1 px border separator at the bottom, hidden on hover, on the last row and on the row above a selected or hovered one,
	// and an accent hover. Selected: primary, no animation; focused, a 2 px primary-foreground border recessed 2 px (M2), drawn on ::after.
	const ROW = {
		idle: 'text-foreground outline-none focus-visible:focus-ring transition-[background-color] duration-(--duration-hover) ease-hover hover:bg-accent after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border hover:after:hidden last:after:hidden has-[+[aria-selected=true]]:after:hidden has-[+:hover]:after:hidden',
		selected:
			'bg-primary text-primary-foreground outline-none after:pointer-events-none after:absolute after:inset-0.5 after:hidden after:rounded-[calc(var(--radius-control)-2px)] after:border-2 after:border-primary-foreground focus-visible:after:block'
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

	let { book, selected = false, narrow = false, badgeEnter = false, class: className, ...restProps }: BookRowProps = $props();

	const state = $derived(selected ? 'selected' : 'idle');
	const newCount = $derived(book.newCount ?? 0);
</script>

<!-- Componentes (D7) · 19 · Linha da lista (66:4618), at the M2 density (127:32889). role="row": a flex tr can lose its table role in WebKit. -->
<Row
	role="row"
	aria-selected={selected}
	data-slot="book-row"
	class={cn(
		'group/row relative flex h-14 items-center gap-4 rounded-control border-b-0 pl-0 pr-2',
		ROW[state],
		className
	)}
	{...restProps}
>
	<Cell
role="gridcell"
		data-slot="book-row-title"
		class={cn('flex items-center px-0', BOOK_ROW_COLUMNS.title, STRONG[state])}
	>
		<!--
			M2: the box is always visible, in every row. The 36 × 56 strip is its hit area (an absolute overlay over this 36 spacer); not a button:
			the list reads the click (library-list.svelte). The cover sits 4 after the strip and the title 16 after the cover.
			`group-[:hover]/row`, not `group-hover/row`: app.css redefines group-hover as a v3 variant that ignores the group name.
		-->
		<span aria-hidden="true" class="w-9 shrink-0"></span>
		<span
			aria-hidden="true"
			data-slot="selection-box"
			data-state={selected ? 'checked' : 'unchecked'}
			class="absolute inset-y-0 left-0 flex w-9 items-center pl-2.5"
		>
			{#if selected}
				<span class="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
					<Icon icon={Check} size="xs" />
				</span>
			{:else}
				<span class="size-4 rounded-full border-[1.5px] border-selection-outline group-[:hover]/row:border-selection-outline-hover"></span>
			{/if}
		</span>
		<Thumbnail class="mr-4 ml-1" src={book.coverSrc} bookId={book.id} />
		<span data-slot="book-row-title-text" class="min-w-0 truncate text-body-medium">
			{book.title}
		</span>
		{#if newCount > 0}
			<Badge class={cn('ml-2 shrink-0', badgeEnter && 'animate-in fade-in-0 duration-(--duration-reveal) ease-out')}>{$_('book.newCount', { count: newCount })}</Badge>
		{/if}
	</Cell>
	<Cell
role="gridcell"
		data-slot="book-row-author"
		class={cn('truncate px-0 text-body', narrow ? BOOK_ROW_COLUMNS.authorNarrow : BOOK_ROW_COLUMNS.author, MUTED[state])}
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
	{#if !narrow}
		<Cell
	role="gridcell"
			data-slot="book-row-last-read"
			class={cn('truncate px-0 text-body', BOOK_ROW_COLUMNS.lastRead, MUTED[state])}
		>
			{book.lastRead ?? ''}
		</Cell>
	{/if}
</Row>
