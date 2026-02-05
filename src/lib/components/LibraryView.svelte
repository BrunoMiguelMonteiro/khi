<script lang="ts">
	import type { Book } from '../types';
	import BookCard from './BookCard.svelte';
	import BookListItem from './BookListItem.svelte';
	import Button from './Button.svelte';
	import { _ } from '$lib/i18n';
	import { getBookGradient } from '$lib/utils/gradients';

	interface Props {
		books: Book[];
		selectedBookIds: string[];
		viewMode: 'grid' | 'list';
		onSelectionChange: (selectedIds: string[]) => void;
		onBookClick?: (book: Book, event: MouseEvent) => void;
		onBooksImport?: () => void;
		isImporting?: boolean;
		importProgress?: { currentBook: string; percentage: number };
	}

	let {
		books,
		selectedBookIds,
		viewMode,
		onSelectionChange,
		onBookClick,
		onBooksImport,
		isImporting = false,
		importProgress
	}: Props = $props();

	let lastSelectedIndex = $state(-1);
	let hoveredBookId = $state<string | null>(null);

	function isSelected(bookId: string): boolean {
		return selectedBookIds.includes(bookId);
	}

	function handleBookClick(book: Book, index: number, event: MouseEvent) {
		event.preventDefault();

		const isCtrlOrCmd = event.ctrlKey || event.metaKey;
		const isShift = event.shiftKey;

		if (isShift && lastSelectedIndex !== -1) {
			// Range selection
			const start = Math.min(lastSelectedIndex, index);
			const end = Math.max(lastSelectedIndex, index);
			const rangeIds = books.slice(start, end + 1).map((b) => b.contentId);

			// Merge with existing selection if Ctrl/Cmd is held
			if (isCtrlOrCmd) {
				const newSelection = [...new Set([...selectedBookIds, ...rangeIds])];
				onSelectionChange(newSelection);
			} else {
				onSelectionChange(rangeIds);
			}
		} else if (isCtrlOrCmd) {
			// Toggle selection
			toggleSelection(book, index);
		} else {
			// Single selection / Open details
			if (onBookClick) {
				onBookClick(book, event);
			} else {
				onSelectionChange([book.contentId]);
			}
			lastSelectedIndex = index;
		}
	}

	function toggleSelection(book: Book, index: number) {
		if (isSelected(book.contentId)) {
			onSelectionChange(selectedBookIds.filter((id) => id !== book.contentId));
		} else {
			onSelectionChange([...selectedBookIds, book.contentId]);
		}
		lastSelectedIndex = index;
	}
</script>

{#if isImporting && importProgress}
	<div
		class="flex items-center gap-3 px-6 py-3 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700"
		role="status"
		aria-live="polite"
		aria-label={$_('screens.library.importProgress')}
	>
		<div class="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden" data-testid="import-progress">
			<div
				class="h-full bg-neutral-900 dark:bg-neutral-100 rounded-full transition-all duration-300"
				style="width: {importProgress.percentage}%"
				aria-hidden="true"
			></div>
		</div>
		<span class="text-sm text-neutral-600 dark:text-neutral-400 truncate max-w-[300px] max-sm:max-w-[150px]">{importProgress.currentBook}</span>
		<span class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 min-w-[48px] text-right">{importProgress.percentage}%</span>
	</div>
{/if}

<div class="flex-1 overflow-y-auto">
	<div class="mx-auto px-6 py-8 transition-all {viewMode === 'list' ? 'w-full' : 'max-w-7xl'} max-sm:px-4">
		{#if books.length === 0}
		<div class="flex flex-col items-center justify-center gap-4 py-16 px-8 text-center" data-testid="empty-state">
			<div class="w-16 h-16 text-neutral-300 dark:text-neutral-600">
				<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
					<path
						d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</div>
			<h3 class="m-0 text-xl font-semibold text-neutral-900 dark:text-neutral-100">{$_('screens.library.noBooks')}</h3>
			<p class="m-0 text-base text-neutral-500 dark:text-neutral-400 max-w-sm">{$_('screens.library.noBooksSubtitle')}</p>
			{#if onBooksImport}
				<Button onclick={onBooksImport} class="mt-4">
					{#snippet icon()}
						<svg
							class="w-4 h-4"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
							aria-hidden="true"
						>
							<path
								d="M12 4v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					{/snippet}
					{$_('screens.library.importTitle')}
				</Button>
			{/if}
		</div>
	{:else if viewMode === 'grid'}
		<div
			class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
			data-testid="books-grid"
			role="list"
			aria-label="Lista de livros"
		>
			{#each books as book, index (book.contentId)}
				<div role="listitem">
					<BookCard
						{book}
						gradient={getBookGradient(book.contentId)}
						isSelected={isSelected(book.contentId)}
						isHovered={hoveredBookId === book.contentId}
						onClick={(e) => handleBookClick(book, index, e)}
						onToggleSelection={() => toggleSelection(book, index)}
						onMouseEnter={() => (hoveredBookId = book.contentId)}
						onMouseLeave={() => (hoveredBookId = null)}
					/>
				</div>
			{/each}
		</div>
	{:else}
		<!-- List view -->
		<div class="flex flex-col gap-2" data-testid="books-list" role="list" aria-label="Lista de livros">
			{#each books as book, index (book.contentId)}
				<div role="listitem">
					<BookListItem
						{book}
						gradient={getBookGradient(book.contentId)}
						isSelected={isSelected(book.contentId)}
						onToggleSelect={() => toggleSelection(book, index)}
						onClick={(e) => handleBookClick(book, index, e)}
					/>
				</div>
			{/each}
		</div>
	{/if}
</div>
</div>
