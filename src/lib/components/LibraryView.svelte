<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Book, SortPreference } from '../types';
	import Button from './Button.svelte';
	import { _ } from '$lib/i18n';
	import { LibraryGrid } from './ui/library-grid';
	import { LibraryList } from './ui/library-list';

	interface Props {
		books: Book[];
		selectedBookIds: number[];
		viewMode: 'grid' | 'list';
		onSelectionChange: (selectedIds: number[]) => void;
		/** A click or Enter on a book, in the grid and in the list. */
		onBookOpen?: (book: Book) => void;
		/** The book whose option takes focus on arrival: the one just closed in the detail. */
		initialActiveId?: number | null;
		/** The Library header, at the top of the scrolling area. */
		header?: Snippet;
		/** A Sync is running: the cards hide their «N novos» badges. */
		hideNew?: boolean;
		/** The sort the list's column headers show, and the direction. */
		sort: SortPreference;
		reversed: boolean;
		onSortChange: (sort: SortPreference) => void;
		onBooksImport?: () => void;
		isImporting?: boolean;
		importProgress?: { currentBook: string; percentage: number };
	}

	let {
		books,
		selectedBookIds,
		viewMode,
		onSelectionChange,
		onBookOpen,
		initialActiveId = null,
		header,
		hideNew = false,
		sort,
		reversed,
		onSortChange,
		onBooksImport,
		isImporting = false,
		importProgress
	}: Props = $props();
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

<div class="flex-1 overflow-y-auto scroll-pt-7">
	<div class="flex flex-col gap-6 p-6">
		{@render header?.()}
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
		<LibraryGrid
			{books}
			{selectedBookIds}
			{onSelectionChange}
			{initialActiveId}
			{hideNew}
			onOpen={(book) => onBookOpen?.(book)}
		/>
	{:else}
		<LibraryList
			{books}
			{selectedBookIds}
			{onSelectionChange}
			{initialActiveId}
			{hideNew}
			{sort}
			{reversed}
			{onSortChange}
			onOpen={(book) => onBookOpen?.(book)}
		/>
	{/if}
</div>
</div>
