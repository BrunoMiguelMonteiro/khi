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
		/** The title menu cannot open, e.g. while a Sync runs. */
		titleMenuDisabled?: boolean;
		view?: ViewMode;
		onview?: (view: ViewMode) => void;
		sort?: SortPreference_Serialize;
		onsort?: (sort: SortPreference_Serialize) => void;
		/** No Reader open (the first start): the five controls stay in view and greyed, Sync and Export included. */
		disabled?: boolean;
		/** With `disabled`, Sync is still up to its own `syncDisabledReason`: a Kobo to be asked about (Q2). */
		syncExempt?: boolean;
		/** Sync turns while true; it stops at the end of the lap. */
		syncing?: boolean;
		/** While syncing: «A sincronizar · N de M livros» replaces the tooltip, without the shortcut. */
		syncProgress?: { done: number; total: number } | null;
		/** When set, Sync is disabled and explains why. */
		syncDisabledReason?: string;
		onsync?: () => void;
		/** The N in «Exportar N livros». */
		exportCount?: number;
		/** When set, Export is disabled and explains why (library and detail). */
		exportDisabledReason?: string;
		onexport?: () => void;
		/** Detail: show Apagar. */
		canDelete?: boolean;
		ondelete?: () => void;
		onback?: () => void;
		/** The width left for the traffic lights, measured by the page; 0 in full screen, where they are hidden. */
		trafficLightsWidth?: number;
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
		titleMenuDisabled = false,
		disabled = false,
		syncExempt = false,
		view = $bindable<ViewMode>('grid'),
		onview,
		sort = 'date_last_read',
		onsort,
		syncing = false,
		syncProgress = null,
		syncDisabledReason,
		onsync,
		exportCount = 0,
		exportDisabledReason,
		onexport,
		canDelete = false,
		ondelete,
		onback,
		trafficLightsWidth = 52,
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
	// Controlled, so a disabled Sort refuses to open (pointer, Enter, Space and arrows alike), as the title menu
	let sortOpen = $state(false);
	$effect.pre(() => {
		if (disabled) sortOpen = false;
	});
	const exportLabel = $derived($_('ui.windowBar.export', { count: exportCount }));
	// Without the total (Rust has not counted the books yet) the tooltip only says «A sincronizar»
	const syncTooltip = $derived(
		!syncing
			? undefined
			: syncProgress && syncProgress.total > 0
				? $_('ui.windowBar.syncingProgress', { done: syncProgress.done, count: syncProgress.total })
				: $_('ui.windowBar.syncing')
	);
</script>

{#snippet exportButton()}
	<ToolbarButton
		icon={Download}
		label={exportLabel}
		shortcut="⌘E"
		disabled={disabled || Boolean(exportDisabledReason)}
		disabledReason={exportDisabledReason}
		onclick={onexport}
	/>
{/snippet}

<!--
	Componentes (D7) · Barra de janela. The shortcuts are Phase 4; this is the content between the
	traffic lights and the edge. `deep` drags from anywhere in the bar except the buttons and other
	interactive elements (Tauri's drag.js), so every control here must stay semantic.
-->
<header
	data-slot="window-bar"
	data-tauri-drag-region="deep"
	class={cn(
		'flex h-toolbar items-center justify-between gap-4 border-b border-border bg-background px-4',
		className
	)}
>
	<!-- The macOS traffic lights sit here under the Overlay title bar: 52 x 12 in the Figma, measured at runtime (Task 36b), so the first control starts 16 after the zoom button. With no width (full screen) the block is not rendered, so it leaves no gap-4 either. The left group takes `mr-auto` because the block is a third flex item. -->
	{#if trafficLightsWidth > 0}
		<div data-traffic-lights aria-hidden="true" class="h-3 shrink-0" style:width="{trafficLightsWidth}px"></div>
	{/if}
	{#if screen === 'library'}
		<div class="flex items-center gap-1 mr-auto">
			<TitleMenu {readers} {activeReaderId} onselect={onselectReader} disabled={titleMenuDisabled} />
		</div>
		<div class="flex items-center gap-4">
			<div class="flex items-center gap-1">
				<ViewGroup bind:value={view} onValueChange={onview} {disabled} />
				<DropdownMenu.Root bind:open={() => sortOpen, (value) => (sortOpen = value && !disabled)}>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<ToolbarButton
								{...props}
								icon={ArrowUpDown}
								label={$_('ui.windowBar.sort')}
								{disabled}
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
					tooltip={syncTooltip}
					shortcut={syncing ? undefined : '⌘R'}
					disabled={(disabled && !syncExempt) || Boolean(syncDisabledReason)}
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
		<div class="flex items-center gap-1 mr-auto">
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
