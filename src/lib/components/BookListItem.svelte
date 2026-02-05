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
	class="flex flex-row items-center gap-4 p-4 rounded-lg bg-transparent border-none cursor-pointer w-full text-left transition-colors duration-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
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
		class="flex-none"
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
	<div class="relative w-12 h-16 rounded-sm shrink-0 overflow-hidden bg-gradient-to-br {gradient}">
		{#if book.coverPath}
			<img src={book.coverPath} alt="Capa de {book.title}" class="absolute inset-0 w-full h-full object-cover" />
		{/if}
	</div>

	<!-- 3. Book Info -->
	<div class="flex-1 min-w-0 flex flex-col">
		<h3 class="m-0 text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{book.title}</h3>
		<p class="m-0 mt-1 text-xs text-neutral-600 dark:text-neutral-400 truncate">{book.author}</p>
	</div>

	<!-- 4. Highlight Count -->
	<span class="text-xs text-neutral-500 dark:text-neutral-500 shrink-0 whitespace-nowrap">
		{book.highlights.length} highlights
	</span>
</div>
