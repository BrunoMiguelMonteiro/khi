<script lang="ts">
	import type { Book } from '../types';
	import BookCard from './BookCard.svelte';
	import BookListItem from './BookListItem.svelte';
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
		class="progress-container"
		role="status"
		aria-live="polite"
		aria-label={$_('screens.library.importProgress')}
	>
		<div class="progress-bar" data-testid="import-progress">
			<div
				class="progress-fill"
				style="width: {importProgress.percentage}%"
				aria-hidden="true"
			></div>
		</div>
		<span class="progress-text">{importProgress.currentBook}</span>
		<span class="progress-percentage">{importProgress.percentage}%</span>
	</div>
{/if}

<div class="library-container" class:list-mode={viewMode === 'list'}>
	{#if books.length === 0}
		<div class="empty-state" data-testid="empty-state">
			<div class="empty-icon">
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
			<h3 class="empty-title">{$_('screens.library.noBooks')}</h3>
			<p class="empty-description">{$_('screens.library.noBooksSubtitle')}</p>
			{#if onBooksImport}
				<button type="button" class="action-btn import" onclick={onBooksImport}>
					<svg
						class="btn-icon"
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
					{$_('screens.library.importTitle')}
				</button>
			{/if}
		</div>
	{:else if viewMode === 'grid'}
		<div
			class="books-grid"
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
		<div class="books-list" data-testid="books-list" role="list" aria-label="Lista de livros">
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

<style>
	.progress-container {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 24px;
		background-color: var(--surface-secondary);
		border-bottom: 1px solid var(--border-default);
	}

	.progress-bar {
		flex: 1;
		height: 8px;
		background-color: var(--border-default);
		border-radius: 9999px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background-color: var(--accent-primary);
		border-radius: 9999px;
		transition: width 0.3s ease;
	}

	.progress-text {
		font-size: 14px;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 300px;
	}

	.progress-percentage {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
		min-width: 48px;
		text-align: right;
	}

	.library-container {
		max-width: 1280px;
		margin: 0 auto;
		padding: 32px 24px;
	}

	.library-container.list-mode {
		max-width: none;
		width: 100%;
	}

	/* Books Grid */
	.books-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 24px;
	}

	@media (min-width: 768px) {
		.books-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.books-grid {
			grid-template-columns: repeat(5, 1fr);
		}
	}

	@media (min-width: 1280px) {
		.books-grid {
			grid-template-columns: repeat(6, 1fr);
		}
	}

	/* Books List */
	.books-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2); /* 8px - Conforme UI-SPEC linha 80 */
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		padding: 64px 32px;
		text-align: center;
	}

	.empty-icon {
		width: 64px;
		height: 64px;
		color: var(--text-tertiary);
	}

	.empty-icon svg {
		width: 100%;
		height: 100%;
	}

	.empty-title {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.empty-description {
		margin: 0;
		font-size: 16px;
		color: var(--text-secondary);
		max-width: 400px;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px 24px;
		font-size: 14px;
		font-weight: 500;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		background-color: var(--accent-primary);
		color: white;
	}

	.action-btn:hover {
		background-color: var(--accent-primary-hover);
	}

	.btn-icon {
		width: 16px;
		height: 16px;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.library-container {
			padding: 16px;
		}

		.books-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 16px;
		}

		.progress-text {
			max-width: 150px;
		}
	}
</style>
