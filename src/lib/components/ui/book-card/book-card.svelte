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
		/** Some book of the grid is selected: every card shows its selection box, not only the hovered one. */
		selecting?: boolean;
		/** The «N novos» badge comes in with a fade: the grid says so only when a Sync ends. */
		badgeEnter?: boolean;
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
		selecting = false,
		badgeEnter = false,
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
	data-selecting={selecting ? '' : undefined}
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
			{badgeEnter}
			class={selected ? undefined : 'group-focus-visible/card:focus-ring'}
		/>
		{#if selected}
			<!-- Q-B: 2 px out from the cover, 3 px primary stroke outside; Q-J, F1: the focus ring sits flush outside it (radius 9). -->
			<span
				aria-hidden="true"
				data-slot="selection-frame"
				class="pointer-events-none absolute -inset-0.5 rounded-control ring-(length:--stroke-ring) ring-primary group-focus-visible/card:focus-ring group-focus-visible/card:outline-offset-(length:--stroke-ring)"
			></span>
		{/if}
		<!--
			Task 37: one 24 × 24 hit area (6 px in from the corner) draws the 20 disc at its centre: the check when selected,
			the E1 box otherwise. Not a button: the card is an option, so the grid reads the click (library-grid.svelte).
			Unchecked it is hidden, and click-through (the click lands on the cover), until hover, focus or a selection shows it.
			`group-[:hover]/card`, not `group-hover/card`: app.css redefines group-hover as a v3 variant that ignores the group name.
		-->
		<span
			aria-hidden="true"
			data-slot="selection-box"
			data-state={selected ? 'checked' : 'unchecked'}
			class={cn(
				'absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center',
				!selected &&
					'pointer-events-none opacity-0 transition-opacity duration-(--duration-out) ease-out group-[:hover]/card:pointer-events-auto group-[:hover]/card:opacity-100 group-focus-visible/card:pointer-events-auto group-focus-visible/card:opacity-100 group-data-[selecting]/card:pointer-events-auto group-data-[selecting]/card:opacity-100 motion-reduce:transition-none'
			)}
		>
			{#if selected}
				<span class="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
					<Icon icon={Check} size="sm" />
				</span>
			{:else}
				<span
					class="size-5 rounded-full bg-selection-box shadow-selection-box group-[:hover]/card:bg-selection-box-hover"
				></span>
			{/if}
		</span>
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
