<script lang="ts">
	import Button from './Button.svelte';

	interface Props {
		selectedCount: number;
		viewMode: 'grid' | 'list';
		sortBy: string;
		onExportAll: () => void;
		onExportSelected: () => void;
		onClearSelection: () => void;
		onSortChange: (sort: string) => void;
		onViewModeChange: (mode: 'grid' | 'list') => void;
		onOpenSettings: () => void;
	}

	let {
		selectedCount,
		viewMode,
		sortBy,
		onExportAll,
		onExportSelected,
		onClearSelection,
		onSortChange,
		onViewModeChange,
		onOpenSettings
	}: Props = $props();

	const sortOptions = [
		{ value: 'title-asc', label: 'Title (A-Z)' },
		{ value: 'title-desc', label: 'Title (Z-A)' },
		{ value: 'author-asc', label: 'Author (A-Z)' },
		{ value: 'author-desc', label: 'Author (Z-A)' },
		{ value: 'recent', label: 'Recently Read' }
	];
</script>

<div class="flex items-center justify-between gap-4 px-6 py-3 bg-neutral-100 dark:bg-neutral-800 border-t border-b border-neutral-200 dark:border-neutral-700 max-sm:flex-col max-sm:items-stretch max-sm:px-4">
	<div class="flex items-center gap-2 flex-wrap">
		<Button variant="ghost" onclick={onExportAll}>
			{#snippet icon()}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="7 10 12 15 17 10" />
					<line x1="12" y1="15" x2="12" y2="3" />
				</svg>
			{/snippet}
			Export All
		</Button>

		<Button variant="ghost" disabled={selectedCount === 0} onclick={onExportSelected}>
			{#snippet icon()}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="7 10 12 15 17 10" />
					<line x1="12" y1="15" x2="12" y2="3" />
				</svg>
			{/snippet}
			Export Selected {#if selectedCount > 0}({selectedCount}){/if}
		</Button>

		{#if selectedCount > 0}
			<Button variant="ghost" onclick={onClearSelection}> Clear Selection </Button>
		{/if}
	</div>

	<div class="flex items-center gap-2 flex-wrap max-sm:justify-between">
		<!-- Sort Dropdown -->
		<div class="relative">
			<select 
				class="appearance-none pl-3 pr-8 py-2 text-sm font-medium bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700 rounded-md cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
				value={sortBy} 
				onchange={(e) => onSortChange(e.currentTarget.value)}
				style="background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E&quot;); background-repeat: no-repeat; background-position: right 8px center; background-size: 16px;"
			>
				{#each sortOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>

		<!-- View Mode Toggle -->
		<div class="flex bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md p-0.5" role="group" aria-label="View mode">
			<button
				class="flex items-center justify-center p-1.5 transition-colors rounded-sm {viewMode === 'grid' ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'}"
				onclick={() => onViewModeChange('grid')}
				aria-label="Grid view"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<rect width="7" height="7" x="3" y="3" rx="1" />
					<rect width="7" height="7" x="14" y="3" rx="1" />
					<rect width="7" height="7" x="14" y="14" rx="1" />
					<rect width="7" height="7" x="3" y="14" rx="1" />
				</svg>
			</button>
			<button
				class="flex items-center justify-center p-1.5 transition-colors rounded-sm {viewMode === 'list' ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'}"
				onclick={() => onViewModeChange('list')}
				aria-label="List view"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="8" x2="21" y1="6" y2="6" />
					<line x1="8" x2="21" y1="12" y2="12" />
					<line x1="8" x2="21" y1="18" y2="18" />
					<line x1="3" x2="3.01" y1="6" y2="6" />
					<line x1="3" x2="3.01" y1="12" y2="12" />
					<line x1="3" x2="3.01" y1="18" y2="18" />
				</svg>
			</button>
		</div>

		<!-- Settings Button -->
		<Button 
			variant="secondary" 
			size="sm"
			onclick={onOpenSettings} 
			ariaLabel="Settings"
			class="p-2"
		>
			{#snippet icon()}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
					/>
					<circle cx="12" cy="12" r="3" />
				</svg>
			{/snippet}
		</Button>
	</div>
</div>
