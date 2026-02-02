<script lang="ts">
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

<div class="toolbar">
	<div class="left-actions">
		<button class="btn btn-ghost" onclick={onExportAll}>
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
			Export All
		</button>

		<button class="btn btn-ghost" disabled={selectedCount === 0} onclick={onExportSelected}>
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
			Export Selected {#if selectedCount > 0}({selectedCount}){/if}
		</button>

		{#if selectedCount > 0}
			<button class="btn btn-ghost" onclick={onClearSelection}> Clear Selection </button>
		{/if}
	</div>

	<div class="right-actions">
		<!-- Sort Dropdown -->
		<div class="dropdown">
			<select class="sort-select" value={sortBy} onchange={(e) => onSortChange(e.currentTarget.value)}>
				{#each sortOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>

		<!-- View Mode Toggle -->
		<div class="view-toggle" role="group" aria-label="View mode">
			<button
				class="toggle-btn"
				class:active={viewMode === 'grid'}
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
				class="toggle-btn"
				class:active={viewMode === 'list'}
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
		<button class="btn btn-icon" onclick={onOpenSettings} aria-label="Settings">
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
		</button>
	</div>
</div>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 24px;
		background-color: var(--surface-secondary);
		border-bottom: 1px solid var(--border-default);
	}

	.left-actions,
	.right-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	/* Buttons */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px 16px;
		font-size: 14px;
		font-weight: 500;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn-ghost {
		background-color: transparent;
		color: var(--text-primary);
	}

	.btn-ghost:hover:not(:disabled) {
		background-color: var(--surface-hover);
	}

	.btn-ghost svg {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}

	.btn-icon {
		padding: 8px;
		background-color: var(--surface-primary);
		color: var(--text-secondary);
		border: 1px solid var(--border-default);
	}

	.btn-icon:hover {
		background-color: var(--surface-secondary);
		color: var(--text-primary);
	}

	/* Sort Dropdown */
	.dropdown {
		position: relative;
	}

	.sort-select {
		appearance: none;
		padding: 8px 32px 8px 12px;
		font-size: 14px;
		font-weight: 500;
		background-color: var(--surface-primary);
		color: var(--text-primary);
		border: 1px solid var(--border-default);
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 8px center;
		background-size: 16px;
	}

	.sort-select:hover {
		background-color: var(--surface-secondary);
	}

	.sort-select:focus {
		outline: 2px solid var(--accent-primary);
		outline-offset: 2px;
	}

	/* View Toggle */
	.view-toggle {
		display: flex;
		gap: 0;
		background-color: var(--surface-primary);
		border: 1px solid var(--border-default);
		border-radius: 8px;
		padding: 2px;
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 6px;
		background-color: transparent;
		color: var(--text-secondary);
		border: none;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.toggle-btn:hover {
		background-color: var(--surface-secondary);
		color: var(--text-primary);
	}

	.toggle-btn.active {
		background-color: var(--surface-secondary);
		color: var(--text-primary);
	}

	/* Responsive */
	@media (max-width: 640px) {
		.toolbar {
			flex-direction: column;
			align-items: stretch;
			gap: 12px;
			padding: 12px 16px;
		}

		.left-actions,
		.right-actions {
			flex-wrap: wrap;
		}

		.btn {
			flex: 1;
			min-width: fit-content;
		}
	}
</style>
