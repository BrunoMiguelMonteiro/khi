<script lang="ts" module>
	import type { Book } from '$lib/types';

	export type LibraryGridProps = {
		books: Book[];
		selectedBookIds: number[];
		onSelectionChange: (selectedIds: number[]) => void;
		/** A click or Enter on a book. The page opens it through `openBook`. */
		onOpen: (book: Book) => void;
		/** The book that holds the tab stop and the focus when the grid appears: the one the user came back from. */
		initialActiveId?: number | null;
		/** A Sync is running: no card shows its «N novos» badge until it ends. */
		hideNew?: boolean;
		class?: string;
	};
</script>

<script lang="ts">
	import { convertFileSrc } from '@tauri-apps/api/core';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { _ } from '$lib/i18n';
	import { newHighlightCount } from '$lib/stores/library.svelte';
	import { cn } from '$lib/utils';
	import { BookCard } from '../book-card';

	let { books, selectedBookIds, onSelectionChange, onOpen, initialActiveId = null, hideNew = false, class: className }: LibraryGridProps = $props();

	// The badges come in with a fade only when a Sync ends (hideNew true → false), together with the header:
	// never when the grid is merely shown again. The books a Sync brings in fade too: the store loads them before the Sync ends, while `hideNew` is still true.
	let badgeEnter = $state(false);
	let wasHidden = untrack(() => hideNew);
	let enterTimer: ReturnType<typeof setTimeout> | undefined;
	// Only the books that were in the grid while the badges were hidden fade: another reader's books, shown within the window, do not.
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

	let list: HTMLDivElement;
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
		if (index !== -1) cards()[index]?.focus();
	});

	const isSelected = (bookId: number) => selectedBookIds.includes(bookId);
	/** Some book of this grid is selected (a stale id does not count): every card then shows its selection box. */
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

	const cards = () => [...list.querySelectorAll<HTMLElement>('[role="option"]')];

	/** Cards per row, measured: the first card that starts a new row ends the first one. */
	function columns(): number {
		const items = cards();
		if (items.length === 0) return 1;
		const top = items[0].offsetTop;
		const wrapped = items.findIndex((item) => item.offsetTop !== top);
		return Math.max(1, wrapped === -1 ? items.length : wrapped);
	}

	/** Moves the focus; with ⇧ the selection becomes the range from the anchor (the book focused before, if none) to the new one. */
	function focusAt(index: number, from: number, extend = false) {
		if (index < 0 || index >= books.length) return;
		cards()[index]?.focus();
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
		const target = (event.target as HTMLElement).closest<HTMLElement>('[role="option"]');
		if (!target) return;
		const index = cards().indexOf(target);
		if (index === -1) return;

		switch (event.key) {
			case 'ArrowRight':
				focusAt(index + 1, index, event.shiftKey);
				break;
			case 'ArrowLeft':
				focusAt(index - 1, index, event.shiftKey);
				break;
			case 'ArrowDown':
				focusAt(index + columns(), index, event.shiftKey);
				break;
			case 'ArrowUp':
				focusAt(index - columns(), index, event.shiftKey);
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
		const target = (event.target as HTMLElement).closest<HTMLElement>('[role="option"]');
		const index = target ? cards().indexOf(target) : -1;
		if (index !== -1) {
			activeId = books[index].id;
			activeAt = index;
		}
	}
</script>

<!--
	Ecrã 1 · grelha. A listbox with multiple selection and one tab stop (W3C APG, Listbox): the arrows
	move the focus without selecting, Space toggles, Enter opens. The columns are 171 at 1000 wide
	(minmax(160px, 1fr), no maximum) and the gaps 24 × 24. The cards are options, not gridcells.
-->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
	bind:this={list}
	role="listbox"
	aria-multiselectable="true"
	aria-label={$_('screens.library.booksListLabel')}
	data-testid="books-grid"
	class={cn('grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-6', className)}
	onkeydown={handleKeydown}
	onfocusin={handleFocusin}
>
	{#each books as book, index (book.id)}
		<BookCard
			role="option"
			data-testid="book-card"
			class="w-full"
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
				newCount: hideNew ? 0 : newHighlightCount(book)
			}}
			onclick={(event) => handleClick(book, event)}
		/>
	{/each}
</div>
