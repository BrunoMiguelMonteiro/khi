<script lang="ts">
	import type { Book } from '$lib/types';
	import CustomCheckbox from './CustomCheckbox.svelte';

	interface Props {
		book: Book;
		gradient: string;
		isSelected: boolean;
		onToggleSelect: () => void;
		onClick: (e: MouseEvent) => void;
	}

	let { book, gradient, isSelected, onToggleSelect, onClick }: Props = $props();

	function handleCheckboxChange(newValue: boolean) {
		onToggleSelect();
	}
</script>

<div
	class="book-list-item"
	onclick={(e) => onClick(e)}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			// Criar MouseEvent sintético para keyboard events
			const syntheticEvent = new MouseEvent('click', {
				bubbles: true,
				cancelable: true
			});
			onClick(syntheticEvent);
		}
	}}
	role="button"
	tabindex="0"
>
	<!-- 1. Checkbox -->
	<div
		class="checkbox-container"
		onclick={(e) => e.stopPropagation()}
		role="none"
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.stopPropagation();
			}
		}}
	>
		<CustomCheckbox checked={isSelected} onChange={handleCheckboxChange} />
	</div>

	<!-- 2. Cover -->
	<div class="cover bg-gradient-to-br {gradient}">
		{#if book.coverPath}
			<img src={book.coverPath} alt="Capa de {book.title}" class="cover-image" />
		{/if}
	</div>

	<!-- 3. Book Info -->
	<div class="book-info">
		<h3 class="book-title">{book.title}</h3>
		<p class="book-author">{book.author}</p>
	</div>

	<!-- 4. Highlight Count -->
	<span class="highlight-count">
		{book.highlights.length} highlights
	</span>
</div>

<style>
	.book-list-item {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: var(--space-4); /* 16px */
		padding: var(--space-4); /* 16px */
		border-radius: var(--radius-lg); /* 8px */
		background: transparent;
		border: none;
		cursor: pointer;
		width: 100%;
		text-align: left;
		transition: background-color var(--transition-fast);
	}

	.book-list-item:hover {
		background: var(--color-neutral-50);
	}

	:global(.dark) .book-list-item:hover {
		background: var(--color-neutral-900);
	}

	.checkbox-container {
		flex: none;
	}

	.cover {
		width: 48px;
		height: 64px;
		border-radius: var(--radius-sm); /* 4px */
		flex-shrink: 0;
		overflow: hidden;
		position: relative;
	}

	.cover-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		position: absolute;
		top: 0;
		left: 0;
	}

	.book-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.book-title {
		font-size: var(--text-sm); /* 14px */
		font-weight: var(--font-medium); /* 500 */
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin: 0;
	}

	.book-author {
		font-size: var(--text-xs); /* 12px */
		color: var(--text-secondary);
		margin-top: var(--space-1); /* 4px */
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-bottom: 0;
	}

	.highlight-count {
		font-size: var(--text-xs); /* 12px */
		color: var(--text-tertiary);
		flex-shrink: 0;
		white-space: nowrap;
	}
</style>
