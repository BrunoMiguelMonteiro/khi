<script lang="ts" module>
	import type { Book, SortPreference } from '$lib/types';

	export type LibraryListProps = {
		books: Book[];
		selectedBookIds: number[];
		onSelectionChange: (selectedIds: number[]) => void;
		/** A click or Enter on a book. The page opens it through `openBook`. */
		onOpen: (book: Book) => void;
		/** The book that holds the tab stop and the focus when the list appears: the one the user came back from. */
		initialActiveId?: number | null;
		/** A Sync is running: no row shows its «N novos» badge until it ends. */
		hideNew?: boolean;
		/** The criterion the books are in, and whether they run against its natural direction. */
		sort: SortPreference;
		reversed: boolean;
		/** A column header was clicked; the page decides between flipping the direction and a new criterion. */
		onSortChange: (sort: SortPreference) => void;
		class?: string;
	};

	/** Whether each criterion's natural direction is ascending: names A to Z, dates and counts the largest first. */
	const NATURAL_ASC: Record<SortPreference, boolean> = {
		title: true,
		author: true,
		date_last_read: false,
		highlight_count: false
	};
</script>

<script lang="ts">
	import { convertFileSrc } from '@tauri-apps/api/core';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { _, locale } from '$lib/i18n';
	import { newHighlightCount } from '$lib/stores/library.svelte';
	import { cn } from '$lib/utils';
	import { formatRelativeDate } from '$lib/utils/relative-date';
	import { BOOK_ROW_COLUMNS, BookRow, ColumnHeader, type ColumnSort } from '../table';
	import Body from '../table/table-body.svelte';
	import Header from '../table/table-header.svelte';
	import HeaderRow from '../table/table-row.svelte';

	let {
		books,
		selectedBookIds,
		onSelectionChange,
		onOpen,
		initialActiveId = null,
		hideNew = false,
		sort,
		reversed,
		onSortChange,
		class: className
	}: LibraryListProps = $props();

	// The badges come in with a fade only when a Sync ends (hideNew true → false), never when the list is merely shown again;
	// and only the books that were in the list while the badges were hidden fade (see library-grid.svelte).
	let badgeEnter = $state(false);
	let wasHidden = untrack(() => hideNew);
	let enterTimer: ReturnType<typeof setTimeout> | undefined;
	let hiddenIds = new Set<number>(untrack(() => (hideNew ? books.map((book) => book.id) : [])));
	let enterIds = $state.raw(new Set<number>());
	$effect.pre(() => {
		const hidden = hideNew;
		if (hidden) hiddenIds = new Set(books.map((book) => book.id));
		untrack(() => {
			if (wasHidden && !hidden) {
				enterIds = hiddenIds;
				badgeEnter = true;
				clearTimeout(enterTimer);
				enterTimer = setTimeout(() => (badgeEnter = false), 1000);
			}
			wasHidden = hidden;
		});
	});
	onDestroy(() => clearTimeout(enterTimer));

	let grid: HTMLTableElement;
	/** The book that holds the single tab stop; follows the focus (roving tabindex). */
	let activeId = $state<number | null>(untrack(() => initialActiveId));
	/** Where the tab stop was last: if its book goes away, the stop stays here, on the neighbour that took its place. */
	let activeAt = $state(0);
	/** The book a ⇧-range starts from. An id, so a new sort order does not move it. */
	let anchorId = $state<number | null>(null);

	const activeIndex = $derived.by(() => {
		const found = books.findIndex((book) => book.id === activeId);
		return found !== -1 ? found : Math.max(0, Math.min(activeAt, books.length - 1));
	});

	onMount(() => {
		if (initialActiveId == null) return;
		const index = books.findIndex((book) => book.id === initialActiveId);
		if (index !== -1) rows()[index]?.focus();
	});

	const isSelected = (bookId: number) => selectedBookIds.includes(bookId);
	/** Some book of this list is selected (a stale id does not count): every row then shows its selection box. */
	const selecting = $derived(books.some((book) => selectedBookIds.includes(book.id)));

	function toggle(book: Book) {
		onSelectionChange(
			isSelected(book.id) ? selectedBookIds.filter((id) => id !== book.id) : [...selectedBookIds, book.id]
		);
		anchorId = book.id;
	}

	function handleClick(book: Book, event: MouseEvent) {
		event.preventDefault();
		const cmd = event.ctrlKey || event.metaKey;

		// The selection box counts as a modifier click; ⇧ and ⌘ never open a book
		const onBox = event.target instanceof Element && event.target.closest('[data-slot="selection-box"]') !== null;
		if (event.shiftKey || cmd || onBox) {
			const anchor = books.findIndex((b) => b.id === anchorId);
			if (event.shiftKey && anchor !== -1) {
				const index = books.indexOf(book);
				const range = books.slice(Math.min(anchor, index), Math.max(anchor, index) + 1).map((b) => b.id);
				onSelectionChange(cmd ? [...new Set([...selectedBookIds, ...range])] : range);
			} else toggle(book);
		} else {
			anchorId = book.id;
			onOpen(book);
		}
	}

	const rows = () => [...grid.querySelectorAll<HTMLElement>('[data-slot="book-row"]')];

	/** Moves the focus; with ⇧ the selection becomes the range from the anchor (the book focused before, if none) to the new one. */
	function focusAt(index: number, from: number, extend = false) {
		if (index < 0 || index >= books.length) return;
		rows()[index]?.focus();
		if (!extend) return;
		let anchor = books.findIndex((b) => b.id === anchorId);
		if (anchor === -1) {
			anchor = from;
			anchorId = books[from].id;
		}
		onSelectionChange(books.slice(Math.min(anchor, index), Math.max(anchor, index) + 1).map((b) => b.id));
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		const target = (event.target as HTMLElement).closest<HTMLElement>('[data-slot="book-row"]');
		if (!target) return;
		const index = rows().indexOf(target);
		if (index === -1) return;

		switch (event.key) {
			case 'ArrowDown':
				focusAt(index + 1, index, event.shiftKey);
				break;
			case 'ArrowUp':
				focusAt(index - 1, index, event.shiftKey);
				break;
			case 'Home':
				focusAt(0, index);
				break;
			case 'End':
				focusAt(books.length - 1, index);
				break;
			case 'Enter':
				onOpen(books[index]);
				break;
			case ' ':
				toggle(books[index]);
				break;
			case 'Escape':
				// Nothing to clear: leave Esc to whoever else wants it
				if (selectedBookIds.length === 0) return;
				onSelectionChange([]);
				break;
			default:
				return;
		}
		event.preventDefault();
	}

	function handleFocusin(event: FocusEvent) {
		const target = (event.target as HTMLElement).closest<HTMLElement>('[data-slot="book-row"]');
		const index = target ? rows().indexOf(target) : -1;
		if (index !== -1) {
			activeId = books[index].id;
			activeAt = index;
		}
	}

	const direction = (column: SortPreference): ColumnSort =>
		column !== sort ? 'none' : NATURAL_ASC[column] !== reversed ? 'asc' : 'desc';

	// VoiceOver: «Os Maias, Eça de Queirós, 58 destaques, 11 novos»; «selecionado» comes from aria-selected.
	function labelOf(book: Book, newCount: number) {
		return [
			book.title,
			book.author?.trim() || $_('book.unknownAuthor'),
			$_('book.highlightsCount', { count: book.highlights.length }),
			newCount > 0 ? $_('book.newCount', { count: newCount }) : null
		]
			.filter(Boolean)
			.join(', ');
	}
</script>

<!--
	Ecrã 4 · lista. A grid with multiple selection and one tab stop (W3C APG, Grid): the arrows move the focus
	without selecting, Space toggles, Enter opens. Not `Table`: its wrapper scrolls, and the column headers
	stick to the top of the Library's own scrolling area. The rows are flex, so the header row shares their widths.
-->
<!-- Explicit table roles throughout: the rows and groups are display:block/flex, which can drop implicit roles in WebKit. -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<table
	bind:this={grid}
	role="grid"
	aria-multiselectable="true"
	aria-label={$_('screens.library.booksListLabel')}
	data-testid="books-list"
	class={cn('block w-full text-body', className)}
	onkeydown={handleKeydown}
	onfocusin={handleFocusin}
>
	<Header role="rowgroup" class="sticky top-0 z-10 block bg-background">
		<HeaderRow role="row" class="flex h-7 items-center gap-4 border-b-0 px-2">
			<ColumnHeader
				flush
				class={cn(BOOK_ROW_COLUMNS.title, 'pl-8')}
				label={$_('screens.library.columns.title')}
				sort={direction('title')}
				onclick={() => onSortChange('title')}
			/>
			<ColumnHeader
				flush
				class={BOOK_ROW_COLUMNS.author}
				label={$_('screens.library.columns.author')}
				sort={direction('author')}
				onclick={() => onSortChange('author')}
			/>
			<ColumnHeader
				flush
				align="end"
				class={BOOK_ROW_COLUMNS.highlights}
				label={$_('screens.library.columns.highlights')}
				sort={direction('highlight_count')}
				onclick={() => onSortChange('highlight_count')}
			/>
			<ColumnHeader
				flush
				class={BOOK_ROW_COLUMNS.lastRead}
				label={$_('screens.library.columns.lastRead')}
				sort={direction('date_last_read')}
				onclick={() => onSortChange('date_last_read')}
			/>
		</HeaderRow>
	</Header>
	<Body role="rowgroup" class="block">
		{#each books as book, index (book.id)}
			{@const newCount = hideNew ? 0 : newHighlightCount(book)}
			<BookRow
				data-testid="book-row"
				aria-label={labelOf(book, newCount)}
				tabindex={index === activeIndex ? 0 : -1}
				selected={isSelected(book.id)}
				{selecting}
				badgeEnter={badgeEnter && enterIds.has(book.id)}
				book={{
					id: book.id,
					title: book.title,
					author: book.author,
					coverSrc: book.coverPath ? convertFileSrc(book.coverPath) : undefined,
					highlightCount: book.highlights.length,
					newCount,
					lastRead: formatRelativeDate(book.dateLastRead, $locale)
				}}
				onclick={(event) => handleClick(book, event)}
			/>
		{/each}
	</Body>
</table>
