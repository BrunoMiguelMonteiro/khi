<script lang="ts" module>
	import type { HTMLAttributes } from 'svelte/elements';

	/** What the card shows of a book: a view of the library's book, so the card needs no Tauri types. */
	export type BookCardBook = {
		id: number | string;
		title: string;
		author?: string;
		coverSrc?: string;
		highlightCount: number;
		newCount?: number;
	};

	export type BookCardProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
		book: BookCardBook;
		selected?: boolean;
	};
</script>

<script lang="ts">
	import Check from 'lucide-svelte/icons/check';
	import Highlighter from 'lucide-svelte/icons/highlighter';
	import { _ } from '$lib/i18n';
	import { cn } from '$lib/utils';
	import { Cover } from '../cover';
	import { Icon } from '../icon';

	let {
		book,
		selected = false,
		tabindex = 0,
		class: className,
		...restProps
	}: BookCardProps = $props();

	const author = $derived(book.author?.trim() || $_('book.unknownAuthor'));
	const newCount = $derived(book.newCount ?? 0);
	// VoiceOver: «Os Maias, Eça de Queirós, 58 destaques, 11 novos»; «selecionado» comes from aria-selected.
	const label = $derived(
		[
			book.title,
			author,
			$_('book.highlightsCount', { count: book.highlightCount }),
			newCount > 0 ? $_('book.newCount', { count: newCount }) : null
		]
			.filter(Boolean)
			.join(', ')
	);
</script>

<!--
	Componentes (D7) · 18 · Cartão do livro (65:4268); the grid, arrows and multiple selection belong to the screen.
	The card is 171 wide (w-42.75), so the selection frame, 2 px out of the 2:3 cover, is 175 × 260.
-->
<div
	role="gridcell"
	aria-selected={selected}
	aria-label={label}
	{tabindex}
	data-slot="book-card"
	class={cn('group/card flex w-42.75 flex-col gap-2 outline-none', className)}
	{...restProps}
>
	<div aria-hidden="true" class="relative">
		<Cover
			src={book.coverSrc}
			title={book.title}
			author={book.author?.trim() || undefined}
			bookId={book.id}
			{newCount}
			class={selected ? undefined : 'group-focus-visible/card:focus-ring'}
		/>
		{#if selected}
			<!-- Q-B: 2 px out from the cover, 3 px primary stroke outside; Q-J, F1: the focus ring sits flush outside it (radius 9). -->
			<span
				aria-hidden="true"
				data-slot="selection-frame"
				class="pointer-events-none absolute -inset-0.5 rounded-control ring-(length:--stroke-ring) ring-primary group-focus-visible/card:focus-ring group-focus-visible/card:outline-offset-(length:--stroke-ring)"
			></span>
			<span
				aria-hidden="true"
				data-slot="selection-check"
				class="absolute right-2 bottom-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background"
			>
				<Icon icon={Check} size="sm" />
			</span>
		{/if}
	</div>
	<div aria-hidden="true" class="flex min-w-0 flex-col gap-1">
		<p data-slot="book-card-title" class="line-clamp-2 text-body-medium text-foreground">
			{book.title}
		</p>
		<p data-slot="book-card-author" class="truncate text-callout text-muted-foreground">
			{author}
		</p>
		<p
			data-slot="book-card-highlights"
			class="flex items-center gap-1 text-callout text-tertiary-foreground tabular-nums"
		>
			<Icon icon={Highlighter} size="sm" />
			<span>{book.highlightCount}</span>
		</p>
	</div>
</div>
