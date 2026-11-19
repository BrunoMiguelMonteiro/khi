<script lang="ts" module>
	import type { HTMLAttributes } from 'svelte/elements';

	type When = Date | string | number;

	export type LibraryHeaderState =
		| { kind: 'novos'; highlights: number; books: number; since?: When | null }
		| { kind: 'aSincronizar'; done: number; total: number }
		| { kind: 'semNovidades'; syncedAt?: When | null }
		| { kind: 'erro'; message: string };

	export type LibraryHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
		state: LibraryHeaderState;
		/** «Mostrar só estes» shows only when this is passed: the filtered state is not designed yet. */
		onShowOnly?: () => void;
		onExport?: () => void;
		onRetry?: () => void;
		/** The export is running; the button reads «A exportar…» and ignores the click. */
		exporting?: boolean;
		/** The export finished; the button reads «✓ Exportado» for 2 s. */
		exported?: boolean;
	};
</script>

<script lang="ts">
	import CircleAlert from 'lucide-svelte/icons/circle-alert';
	import { onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import { _, locale } from '$lib/i18n';
	import { cn } from '$lib/utils';
	import { Button } from '../button';
	import { Icon } from '../icon';

	let {
		state: current,
		onShowOnly,
		onExport,
		onRetry,
		exporting = false,
		exported = false,
		class: className,
		...restProps
	}: LibraryHeaderProps = $props();

	// «Exportado» holds for 2 s from the moment `exported` turns true (Movimento 3).
	let showExported = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		clearTimeout(timer);
		if (exported && !exporting) {
			showExported = true;
			timer = setTimeout(() => (showExported = false), 2000);
		} else showExported = false;
	});
	onDestroy(() => clearTimeout(timer));

	const shortDate = (when: When) =>
		new Intl.DateTimeFormat($locale, { day: 'numeric', month: 'short' })
			.formatToParts(new Date(when))
			.filter((part) => part.type === 'day' || part.type === 'month')
			.map((part) => part.value)
			.join(' ');
	const time = (when: When) =>
		new Intl.DateTimeFormat($locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(when));

	const message = $derived(
		current.kind === 'novos'
			? `${$_('screens.library.header.newHighlights', { count: current.highlights })} ${$_('screens.library.header.inBooks', { count: current.books })}`
			: current.kind === 'aSincronizar'
				? $_('screens.library.header.syncing')
				: current.kind === 'semNovidades'
					? $_('screens.library.header.noNews')
					: $_('notifications.syncError')
	);
	const detail = $derived(
		current.kind === 'novos'
			? current.since
				? $_('screens.library.header.since', { date: shortDate(current.since) })
				: ''
			: current.kind === 'aSincronizar'
				? `· ${$_('screens.library.header.syncProgress', { done: current.done, count: current.total })}`
				: current.kind === 'semNovidades'
					? current.syncedAt
						? $_('screens.library.header.syncedAt', { time: time(current.syncedAt) })
						: ''
					: current.message
	);
	// The alert region always exists, so the change to an error is announced; the Retry button stays outside it.
	const alertText = $derived(current.kind === 'erro' ? `${message} ${detail}`.trim() : '');
	// Only the start and the end are announced: the progress changes on screen, not here.
	const announcement = $derived(current.kind === 'erro' ? '' : message);

	const exportLabel = $derived(
		exporting
			? $_('screens.library.header.exporting')
			: exported && showExported
				? $_('screens.library.header.exported')
				: current.kind === 'novos'
					? $_('screens.library.header.exportBooks', { count: current.books })
					: ''
	);
</script>

<!--
	Componentes (D7) · 21 · Cabeçalho da Biblioteca (67:5835); Movimento 2 e 3: the strip enters over
	duration/reveal with ease/out and leaves in a 150 ms fade;
	with Reduzir movimento the strip enters with the fade alone (no slide) and leaves at once.
-->
<div
	data-slot="library-header"
	data-state={current.kind}
	out:fade={{ duration: prefersReducedMotion.current ? 0 : 150 }}
	class={cn(
		'flex min-h-control flex-wrap items-center justify-between gap-x-4 gap-y-2',
		'animate-in fade-in-0 slide-in-from-top-(length:--distance-enter) duration-(--duration-reveal) ease-out motion-reduce:slide-in-from-top-0',
		className
	)}
	{...restProps}
>
	<div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
		<p data-slot="library-header-message" class="text-title-3 text-foreground">
			{#if current.kind === 'erro'}<Icon
					icon={CircleAlert}
					size="md"
					class="mr-2 inline align-text-bottom text-destructive"
				/>{/if}{message}
		</p>
		{#if detail}
			<p
				data-slot="library-header-detail"
				class={cn(
					'text-body',
					current.kind === 'erro' ? 'text-muted-foreground' : 'text-tertiary-foreground'
				)}
			>
				{detail}
			</p>
		{/if}
	</div>
	{#if current.kind === 'novos'}
		<div class="flex items-center gap-2">
			{#if onShowOnly}
				<Button variant="secundario" onclick={() => onShowOnly()}>
					{$_('screens.library.header.showOnly')}
				</Button>
			{/if}
			<Button variant="principal" disabled={exporting} onclick={() => onExport?.()}>
				{exportLabel}
			</Button>
		</div>
	{:else if current.kind === 'erro' && onRetry}
		<Button variant="secundario" onclick={() => onRetry()}>
			{$_('screens.library.header.retry')}
		</Button>
	{/if}
</div>

<div aria-live="polite" class="sr-only">{announcement}</div>
<div role="alert" class="sr-only">{alertText}</div>
