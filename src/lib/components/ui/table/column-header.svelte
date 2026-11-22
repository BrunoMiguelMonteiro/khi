<script lang="ts" module>
	export type ColumnSort = 'none' | 'asc' | 'desc';

	export type ColumnHeaderProps = {
		label: string;
		sort?: ColumnSort;
		align?: 'start' | 'end';
		/** No inner padding: the label starts at the column's edge, as the row's cell text does. */
		flush?: boolean;
		onclick?: (event: MouseEvent) => void;
		class?: string;
	};

	const ARIA_SORT = { none: 'none', asc: 'ascending', desc: 'descending' } as const;
	// Whole classes: the active column in foreground, the others muted (Cabeçalho de coluna, 66:4649).
	const TONE = {
		none: 'text-muted-foreground',
		asc: 'text-foreground',
		desc: 'text-foreground'
	} as const;
	const ALIGN = { start: 'justify-start text-left', end: 'justify-end text-right' } as const;
</script>

<script lang="ts">
	import ArrowDown from 'lucide-svelte/icons/arrow-down';
	import ArrowUp from 'lucide-svelte/icons/arrow-up';
	import { cn } from '$lib/utils';
	import { Icon } from '../icon';
	import Head from './table-head.svelte';

	let { label, sort = 'none', align = 'start', flush = false, onclick, class: className }: ColumnHeaderProps =
		$props();
</script>

{#snippet arrow()}
	{#if sort !== 'none'}
		<Icon icon={sort === 'asc' ? ArrowUp : ArrowDown} size="sm" />
	{/if}
{/snippet}

<!-- The caller sorts: a click only reports it. aria-sort tells VoiceOver the column's order. -->
<Head
	role="columnheader"
	aria-sort={ARIA_SORT[sort]}
	data-slot="column-header"
	class={cn('h-9 p-0', className)}
>
	<button
		type="button"
		class={cn(
			'flex h-9 w-full items-center gap-1 rounded-control text-callout-medium outline-none focus-visible:focus-ring',
			flush ? 'px-0' : 'px-2',
			ALIGN[align],
			TONE[sort]
		)}
		{onclick}
	>
		{#if align === 'end'}{@render arrow()}{/if}
		<span class="truncate">{label}</span>
		{#if align === 'start'}{@render arrow()}{/if}
	</button>
</Head>
