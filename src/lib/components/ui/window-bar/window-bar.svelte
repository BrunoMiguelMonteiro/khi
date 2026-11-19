<script lang="ts" module>
	import type { SortPreference_Serialize } from '$lib/bindings';
	import type { TitleMenuReader } from '../title-menu';
	import type { ViewMode } from '../view-group';

	export type WindowBarProps = {
		screen: 'library' | 'detail';
		/** Library: the readers behind the title menu. */
		readers?: TitleMenuReader[];
		activeReaderId?: number | string | null;
		onselectReader?: (id: number | string) => void;
		view?: ViewMode;
		onview?: (view: ViewMode) => void;
		sort?: SortPreference_Serialize;
		onsort?: (sort: SortPreference_Serialize) => void;
		/** Sync turns while true; it stops at the end of the lap. */
		syncing?: boolean;
		/** When set, Sync is disabled and explains why. */
		syncDisabledReason?: string;
		onsync?: () => void;
		/** The N in «Exportar N livros». */
		exportCount?: number;
		onexport?: () => void;
		/** Detail: show Apagar. */
		canDelete?: boolean;
		ondelete?: () => void;
		onback?: () => void;
		class?: string;
	};
</script>

<script lang="ts">
	import ArrowUpDown from 'lucide-svelte/icons/arrow-up-down';
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import Download from 'lucide-svelte/icons/download';
	import RefreshCw from 'lucide-svelte/icons/refresh-cw';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import { _ } from '$lib/i18n';
	import { cn } from '$lib/utils';
	import * as DropdownMenu from '../dropdown-menu';
	import { TitleMenu } from '../title-menu';
	import { ToolbarButton } from '../toolbar-button';
	import { ViewGroup } from '../view-group';

	let {
		screen,
		readers = [],
		activeReaderId,
		onselectReader,
		view = $bindable<ViewMode>('grid'),
		onview,
		sort = 'date_last_read',
		onsort,
		syncing = false,
		syncDisabledReason,
		onsync,
		exportCount = 0,
		onexport,
		canDelete = false,
		ondelete,
		onback,
		class: className
	}: WindowBarProps = $props();

	// Sync keeps turning after `syncing` ends, until the lap is over, so it stops straight.
	let turning = $state(false);
	let reducedMotion = $state(false);
	$effect(() => {
		const query = window.matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = query.matches;
		const update = (event: { matches: boolean }) => (reducedMotion = event.matches);
		query.addEventListener('change', update);
		return () => query.removeEventListener('change', update);
	});
	// Nothing animates with Reduzir movimento or off the library, so there is no lap to wait for.
	$effect(() => {
		if (reducedMotion || screen !== 'library') turning = false;
		else if (syncing) turning = true;
	});

	const sorts: { value: SortPreference_Serialize; label: string }[] = $derived([
		{ value: 'title', label: $_('screens.library.sort.title') },
		{ value: 'author', label: $_('screens.library.sort.author') },
		{ value: 'date_last_read', label: $_('screens.library.sort.recent') },
		{ value: 'highlight_count', label: $_('screens.library.sort.count') }
	]);
	const exportLabel = $derived($_('ui.windowBar.export', { count: exportCount }));
</script>

{#snippet exportButton()}
	<ToolbarButton icon={Download} label={exportLabel} shortcut="⌘E" onclick={onexport} />
{/snippet}

<!--
	Componentes (D7) · Barra de janela. The drag zone, the traffic lights and the shortcuts are
	Phase 4; this is the content between the traffic lights and the edge.
-->
<header
	data-slot="window-bar"
	class={cn(
		'flex h-toolbar items-center justify-between gap-4 border-b border-border bg-background px-4',
		className
	)}
>
	{#if screen === 'library'}
		<div class="flex items-center gap-1">
			<TitleMenu {readers} {activeReaderId} onselect={onselectReader} />
		</div>
		<div class="flex items-center gap-4">
			<div class="flex items-center gap-1">
				<ViewGroup bind:value={view} onValueChange={onview} />
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<ToolbarButton
								{...props}
								icon={ArrowUpDown}
								label={$_('ui.windowBar.sort')}
							/>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content sideOffset={4} align="end">
						{#each sorts as option (option.value)}
							<DropdownMenu.Item
								bind:checked={() => option.value === sort, () => {}}
								onSelect={() => onsort?.(option.value)}
							>
								{option.label}
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
			<div class="flex items-center gap-1">
				<ToolbarButton
					icon={RefreshCw}
					label={$_('ui.windowBar.sync')}
					shortcut="⌘R"
					disabled={Boolean(syncDisabledReason)}
					disabledReason={syncDisabledReason}
					onclick={onsync}
					onanimationiteration={() => {
						if (!syncing) turning = false;
					}}
					class={cn(turning && '[&_svg]:animate-spin motion-reduce:[&_svg]:animate-none')}
				/>
				{@render exportButton()}
			</div>
		</div>
	{:else}
		<div class="flex items-center gap-1">
			<ToolbarButton
				icon={ChevronLeft}
				label={$_('ui.windowBar.back')}
				shortcut="⌘["
				onclick={onback}
			/>
		</div>
		<div class="flex items-center gap-1">
			{#if canDelete}
				<ToolbarButton
					icon={Trash2}
					label={$_('ui.windowBar.delete')}
					shortcut="⌘⌫"
					onclick={ondelete}
				/>
			{/if}
			{@render exportButton()}
		</div>
	{/if}
</header>
