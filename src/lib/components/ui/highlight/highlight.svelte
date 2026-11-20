<script lang="ts" module>
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Highlight as HighlightData } from '$lib/types';

	export type HighlightState = 'normal' | 'novo' | 'removido';

	export type HighlightProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'oncopy'> & {
		highlight: HighlightData;
		state?: HighlightState;
		/** Copies the quote and says whether it worked; the clipboard when omitted. */
		oncopy?: (highlight: HighlightData) => boolean | void | Promise<boolean | void>;
	};

	// Q-H: 4 px dash and 4 px gap, in the Normal line colour.
	const DASHED_LINE =
		'bg-[repeating-linear-gradient(to_bottom,var(--highlight-line)_0_4px,transparent_4px_8px)]';
</script>

<script lang="ts">
	import Check from 'lucide-svelte/icons/check';
	import Copy from 'lucide-svelte/icons/copy';
	import MessageSquare from 'lucide-svelte/icons/message-square';
	import Unlink from 'lucide-svelte/icons/unlink';
	import { onDestroy } from 'svelte';
	import { _, locale } from '$lib/i18n';
	import { cn } from '$lib/utils';
	import { copyToClipboard } from '$lib/utils/clipboard';
	import { Icon } from '../icon';

	let { highlight, state: tone = 'normal', oncopy, class: className, ...restProps }: HighlightProps =
		$props();

	type CopyState = 'idle' | 'success' | 'error';
	let copied = $state<CopyState>('idle');
	let timer: ReturnType<typeof setTimeout> | undefined;
	let pending = false;
	let alive = true;

	onDestroy(() => {
		alive = false;
		clearTimeout(timer);
	});

	// Kobo stores "" for highlights without a note.
	const note = $derived(highlight.annotation?.trim() ?? '');
	const chapter = $derived(highlight.chapterTitle?.trim() ?? '');
	const date = $derived.by(() => {
		const d = new Date(highlight.dateCreated);
		return Number.isNaN(d.getTime())
			? ''
			: new Intl.DateTimeFormat($locale, { day: 'numeric', month: 'long' }).format(d);
	});
	const meta = $derived([chapter, date].filter(Boolean).join(' · '));
	// VoiceOver: «Capítulo 2, 10 de novembro, novo, com nota» and then the text.
	const summary = $derived(
		[
			chapter,
			date,
			tone === 'novo' ? $_('highlight.new') : null,
			tone === 'removido' ? $_('highlight.removedFromKobo') : null,
			note ? $_('highlight.withNote') : null
		]
			.filter(Boolean)
			.join(', ')
	);
	const copyLabel = $derived(
		copied === 'success'
			? $_('highlight.copied')
			: copied === 'error'
				? $_('highlight.copyError')
				: $_('highlight.copy')
	);

	async function copy() {
		if (pending) return;
		pending = true;
		let ok = false;
		try {
			ok = (oncopy ? await oncopy(highlight) : await copyToClipboard(highlight.text)) !== false;
		} catch {
			ok = false;
		}
		pending = false;
		if (!alive) return;
		copied = ok ? 'success' : 'error';
		clearTimeout(timer);
		timer = setTimeout(() => (copied = 'idle'), 2000);
	}
</script>

<!--
	Componentes (D7) · 20 · Destaque (67:5072). Q-I: hover and focus share one 120 ms fade of the
	background (p-4 -m-4 grows it past the text), which Reduzir movimento keeps. The gap of 48
	between highlights belongs to the list (Q-H).
	`group-[:hover]/highlight`, not `group-hover/highlight`: app.css redefines group-hover as a v3 variant that ignores the group name.
-->
<div
	role="group"
	aria-label={summary || undefined}
	data-slot="highlight"
	data-state={tone}
	class={cn(
		'group/highlight relative -m-4 rounded-control p-4 transition-colors duration-(--duration-hover) ease-hover hover:bg-accent focus-within:bg-accent',
		className
	)}
	{...restProps}
>
	<span
		aria-hidden="true"
		data-slot="highlight-line"
		class={cn(
			'absolute top-4 bottom-4 left-4 w-(--stroke-highlight-line)',
			tone === 'novo' && 'bg-highlight-line-new',
			tone === 'normal' && 'bg-highlight-line',
			tone === 'removido' && DASHED_LINE
		)}
	></span>
	<div class="flex flex-col gap-2 pr-8 pl-4">
		{#if meta}
			<p data-slot="highlight-meta" class="text-callout text-muted-foreground">{meta}</p>
		{/if}
		<p data-slot="highlight-text" class="text-reading text-foreground">{highlight.text}</p>
		{#if note}
			<p
				data-slot="highlight-note"
				class="flex items-start gap-2 text-body whitespace-pre-line text-muted-foreground"
			>
				<Icon icon={MessageSquare} size="md" label={$_('highlight.note')} />
				<span>{note}</span>
			</p>
		{/if}
		{#if tone === 'removido'}
			<p
				data-slot="highlight-removed"
				class="flex items-center gap-1 text-callout text-tertiary-foreground"
			>
				<Icon icon={Unlink} size="sm" />
				<span>{$_('highlight.removedFromKobo')}</span>
			</p>
		{/if}
	</div>
	<button
		type="button"
		data-slot="highlight-copy"
		aria-label={copyLabel}
		class="absolute top-4 right-4 flex size-6 items-center justify-center rounded-control text-muted-foreground opacity-0 transition-opacity duration-(--duration-hover) ease-hover outline-none group-[:hover]/highlight:opacity-100 group-focus-within/highlight:opacity-100 focus-visible:focus-ring"
		onclick={copy}
	>
		<Icon icon={copied === 'success' ? Check : Copy} size="md" />
	</button>
</div>
