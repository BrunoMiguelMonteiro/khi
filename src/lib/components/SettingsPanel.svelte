<!--
  SettingsPanel Component

  Provides a settings interface for:
  - Export configuration (path, metadata options, date format)
  - UI preferences (theme, view mode, sort)

  Uses the settings store for state management.
-->

<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import {
		settings,
		getViewModeLabel,
		getThemeLabel,
		getDateFormatLabel
	} from '../stores/settings.svelte';
	import type { ExportConfig, ThemePreference, ViewMode, SortPreference } from '../types';
	import CustomCheckbox from './CustomCheckbox.svelte';
	import CustomRadio from './CustomRadio.svelte';
	import Button from './Button.svelte';

	// Props
	interface Props {
		onClose?: () => void;
		onSave?: () => void;
	}

	let { onClose, onSave }: Props = $props();

	// Local state for unsaved changes
	let hasChanges = $state(false);
	let saveError = $state<string | null>(null);
	let activeTab = $state<'export' | 'appearance'>('export');

	// Get current values from store
	const exportConfig = $derived(settings.exportConfig);
	const uiPreferences = $derived(settings.uiPreferences);
	const isLoading = $derived(settings.isLoading);

	// Metadata options configuration
	const metadataOptions: {
		key: keyof ExportConfig['metadata'];
		label: string;
	}[] = [
		{ key: 'author', label: 'Author' },
		{ key: 'isbn', label: 'ISBN' },
		{ key: 'publisher', label: 'Publisher' },
		{ key: 'dateLastRead', label: 'Last Read Date' },
		{ key: 'language', label: 'Language' },
		{ key: 'description', label: 'Description' }
	];

	// Date format options
	const dateFormats: ExportConfig['dateFormat'][] = ['dd_month_yyyy', 'dd_mm_yyyy', 'iso8601'];

	// Theme options
	const themes: ThemePreference[] = ['system', 'light', 'dark'];

	// View mode options
	const viewModes: ViewMode[] = ['grid', 'list'];

	function getEnglishThemeLabel(theme: ThemePreference): string {
		switch (theme) {
			case 'system':
				return 'System';
			case 'light':
				return 'Light';
			case 'dark':
				return 'Dark';
			default:
				return theme;
		}
	}

	function getEnglishViewModeLabel(mode: ViewMode): string {
		switch (mode) {
			case 'grid':
				return 'Grid';
			case 'list':
				return 'List';
			default:
				return mode;
		}
	}

	function getEnglishDateFormatLabel(format: ExportConfig['dateFormat']): string {
		const labels: Record<string, string> = {
			dd_mm_yyyy: 'DD/MM/YYYY (24/01/2025)',
			dd_month_yyyy: '24 January 2025',
			iso8601: 'ISO 8601 (2025-01-24)'
		};
		return labels[format] || format;
	}

	// Handlers
	function handleExportPathChange(event: Event) {
		const target = event.target as HTMLInputElement;
		settings.setExportPath(target.value);
		hasChanges = true;
	}

	async function handleBrowseFolder() {
		try {
			const selectedPath = await invoke<string | null>('pick_export_folder', {
				defaultPath: exportConfig.exportPath
			});

			if (selectedPath) {
				settings.setExportPath(selectedPath);
				hasChanges = true;
			}
		} catch (error) {
			console.error('Failed to pick folder:', error);
		}
	}

	function handleMetadataToggle(key: keyof ExportConfig['metadata']) {
		settings.setMetadataOption(key, !exportConfig.metadata[key]);
		hasChanges = true;
	}

	function handleDateFormatChange(format: ExportConfig['dateFormat']) {
		settings.setDateFormat(format);
		hasChanges = true;
	}

	async function handleThemeChange(theme: ThemePreference) {
		await settings.setTheme(theme);
		hasChanges = true;
	}

	function handleViewModeChange(mode: ViewMode) {
		settings.setViewMode(mode);
		hasChanges = true;
	}

	function handleAutoImportToggle() {
		settings.setAutoImportOnConnect(!uiPreferences.autoImportOnConnect);
		hasChanges = true;
	}

	async function handleSave() {
		saveError = null;
		try {
			await settings.save();
			hasChanges = false;
			onSave?.();
			onClose?.();
		} catch (err) {
			console.error('Save error:', err);
			if (err instanceof Error) {
				saveError = err.message;
			} else if (typeof err === 'string') {
				saveError = err;
			} else {
				saveError = 'Error saving settings: ' + JSON.stringify(err);
			}
		}
	}

	async function handleReset() {
		if (confirm('Are you sure you want to reset to default settings?')) {
			try {
				await settings.resetAndSave();
				hasChanges = false;
				onSave?.();
			} catch (err) {
				saveError = err instanceof Error ? err.message : 'Error resetting settings';
			}
		}
	}

	function handleCancel() {
		if (hasChanges) {
			if (confirm('You have unsaved changes. Do you want to exit without saving?')) {
				onClose?.();
			}
		} else {
			onClose?.();
		}
	}
</script>

<div
	class="flex flex-col bg-white dark:bg-neutral-900 rounded-lg min-w-[700px] max-w-[900px] max-h-[80vh] overflow-hidden shadow-xl"
	role="dialog"
	aria-labelledby="settings-title"
	aria-modal="true"
>
	<div class="flex justify-between items-center p-6 border-b border-neutral-200 dark:border-neutral-800">
		<h2 id="settings-title" class="text-xl font-semibold text-neutral-900 dark:text-neutral-100 m-0">Settings</h2>
		<Button
			variant="icon"
			onclick={handleCancel}
			ariaLabel="Close settings"
		>
			{#snippet icon()}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			{/snippet}
		</Button>
	</div>

	<!-- Tabs -->
	<div class="flex gap-2 px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50" role="tablist" aria-label="Settings tabs">
		<button
			class="flex items-center gap-3 px-4 py-2 border-b-2 font-medium text-sm transition-all duration-150 {activeTab === 'export' ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white' : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'}"
			onclick={() => (activeTab = 'export')}
			role="tab"
			aria-selected={activeTab === 'export'}
			aria-controls="export-panel"
			id="export-tab"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
				<polyline points="7 10 12 15 17 10"></polyline>
				<line x1="12" y1="15" x2="12" y2="3"></line>
			</svg>
			Export
		</button>
		<button
			class="flex items-center gap-3 px-4 py-2 border-b-2 font-medium text-sm transition-all duration-150 {activeTab === 'appearance' ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white' : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'}"
			onclick={() => (activeTab = 'appearance')}
			role="tab"
			aria-selected={activeTab === 'appearance'}
			aria-controls="appearance-panel"
			id="appearance-tab"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<circle cx="12" cy="12" r="5"></circle>
				<line x1="12" y1="1" x2="12" y2="3"></line>
				<line x1="12" y1="21" x2="12" y2="23"></line>
				<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
				<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
				<line x1="1" y1="12" x2="3" y2="12"></line>
				<line x1="21" y1="12" x2="23" y2="12"></line>
				<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
				<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
			</svg>
			Appearance
		</button>
	</div>

	<!-- Tab Panels -->
	<div class="flex-1 overflow-y-auto p-6">
		{#if activeTab === 'export'}
			<div
				id="export-panel"
				role="tabpanel"
				aria-labelledby="export-tab"
				class="flex flex-col gap-8"
			>
				<!-- Export Path -->
				<section class="flex flex-col gap-4">
					<h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100 m-0">Export Folder</h3>
					<div class="flex flex-col gap-2">
						<label for="export-path" class="text-sm font-medium text-neutral-600 dark:text-neutral-400">Path</label>
						<div class="flex gap-2 items-center">
							<input
								id="export-path"
								type="text"
								class="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
								value={exportConfig.exportPath}
								oninput={handleExportPathChange}
								placeholder="~/Documents/Kobo Highlights"
							/>
							<Button
								variant="secondary"
								onclick={handleBrowseFolder}
								ariaLabel="Browse for export folder"
								class="whitespace-nowrap"
							>
								{#snippet icon()}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path
											d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
										></path>
									</svg>
								{/snippet}
								Browse
							</Button>
						</div>
						<p class="text-xs text-neutral-500 dark:text-neutral-400 m-0">
							Markdown files will be saved in this folder.
						</p>
					</div>
				</section>

				<!-- Metadata Options -->
				<section class="flex flex-col gap-4">
					<h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100 m-0">Metadata to Include</h3>
					<p class="text-sm text-neutral-500 dark:text-neutral-400 m-0 -mt-2">
						Select which metadata to include in the exported files.
					</p>
					<div class="grid grid-cols-2 gap-x-4 gap-y-0.5">
						{#each metadataOptions as option}
							<label class="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
								<CustomCheckbox
									checked={exportConfig.metadata[option.key]}
									onChange={() =>
										handleMetadataToggle(option.key)}
								/>
								<span class="text-sm text-neutral-900 dark:text-neutral-100">{option.label}</span
								>
							</label>
						{/each}
					</div>
				</section>

				<!-- Date Format -->
				<section class="flex flex-col gap-4">
					<h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100 m-0">Date Format</h3>
					<div class="flex flex-col gap-0.5">
						{#each dateFormats as format}
							<label class="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
								<CustomRadio
									name="date-format"
									value={format}
									checked={exportConfig.dateFormat === format}
									onChange={() =>
										handleDateFormatChange(format)}
								/>
								<span class="text-sm text-neutral-900 dark:text-neutral-100"
									>{getEnglishDateFormatLabel(format)}</span
								>
							</label>
						{/each}
					</div>
				</section>
			</div>
		{:else}
			<div
				id="appearance-panel"
				role="tabpanel"
				aria-labelledby="appearance-tab"
				class="flex flex-col gap-8"
			>
				<!-- Theme -->
				<section class="flex flex-col gap-4">
					<h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100 m-0">Theme</h3>
					<div class="flex rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden w-fit">
						{#each themes as theme}
							<button
								class="flex items-center gap-2 px-3 py-2 text-sm transition-colors border-r last:border-r-0 border-neutral-200 dark:border-neutral-700 {uiPreferences.theme === theme ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black' : 'bg-white text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'}"
								onclick={() => handleThemeChange(theme)}
								aria-pressed={uiPreferences.theme === theme}
							>
								{#if theme === 'system'}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="20"
										height="20"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<rect
											x="2"
											y="3"
											width="20"
											height="14"
											rx="2"
											ry="2"
										></rect>
										<line x1="8" y1="21" x2="16" y2="21"
										></line>
										<line x1="12" y1="17" x2="12" y2="21"
										></line>
									</svg>
								{:else if theme === 'light'}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="20"
										height="20"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<circle cx="12" cy="12" r="5"></circle>
										<line x1="12" y1="1" x2="12" y2="3"
										></line>
										<line x1="12" y1="21" x2="12" y2="23"
										></line>
										<line
											x1="4.22"
											y1="4.22"
											x2="5.64"
											y2="5.64"
										></line>
										<line
											x1="18.36"
											y1="18.36"
											x2="19.78"
											y2="19.78"
										></line>
										<line x1="1" y1="12" x2="3" y2="12"
										></line>
										<line x1="21" y1="12" x2="23" y2="12"
										></line>
										<line
											x1="4.22"
											y1="19.78"
											x2="5.64"
											y2="18.36"
										></line>
										<line
											x1="18.36"
											y1="5.64"
											x2="19.78"
											y2="4.22"
										></line>
									</svg>
								{:else}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="20"
										height="20"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path
											d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
										></path>
									</svg>
								{/if}
								{getEnglishThemeLabel(theme)}
							</button>
						{/each}
					</div>
				</section>

				<!-- View Mode -->
				<section class="flex flex-col gap-4">
					<h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100 m-0">Library View Mode</h3>
					<div class="flex rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden w-fit">
						{#each viewModes as mode}
							<button
								class="flex items-center gap-2 px-3 py-2 text-sm transition-colors border-r last:border-r-0 border-neutral-200 dark:border-neutral-700 {uiPreferences.libraryViewMode === mode ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black' : 'bg-white text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'}"
								onclick={() => handleViewModeChange(mode)}
								aria-pressed={uiPreferences.libraryViewMode ===
									mode}
							>
								{#if mode === 'grid'}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="20"
										height="20"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<rect x="3" y="3" width="7" height="7"
										></rect>
										<rect x="14" y="3" width="7" height="7"
										></rect>
										<rect x="14" y="14" width="7" height="7"
										></rect>
										<rect x="3" y="14" width="7" height="7"
										></rect>
									</svg>
								{:else}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="20"
										height="20"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<line x1="8" y1="6" x2="21" y2="6"
										></line>
										<line x1="8" y1="12" x2="21" y2="12"
										></line>
										<line x1="8" y1="18" x2="21" y2="18"
										></line>
										<line x1="3" y1="6" x2="3.01" y2="6"
										></line>
										<line x1="3" y1="12" x2="3.01" y2="12"
										></line>
										<line x1="3" y1="18" x2="3.01" y2="18"
										></line>
									</svg>
								{/if}
								{getEnglishViewModeLabel(mode)}
							</button>
						{/each}
					</div>
				</section>

				<!-- Auto-import on connect -->
				<section class="flex flex-col gap-4">
					<h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100 m-0">Device Connection</h3>
					<p class="text-sm text-neutral-500 dark:text-neutral-400 m-0 -mt-2">
						Automatically import highlights when a Kobo device is
						connected.
					</p>
					<label class="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
						<input
							type="checkbox"
							checked={uiPreferences.autoImportOnConnect}
							onchange={handleAutoImportToggle}
							class="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
						/>
						<span class="text-sm text-neutral-900 dark:text-neutral-100"
							>Auto-import on device connect</span
						>
					</label>
				</section>
			</div>
		{/if}
	</div>

	<!-- Error Message -->
	{#if saveError}
		<div class="flex items-center gap-2 mx-6 my-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-md text-sm" role="alert">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<circle cx="12" cy="12" r="10"></circle>
				<line x1="12" y1="8" x2="12" y2="12"></line>
				<line x1="12" y1="16" x2="12.01" y2="16"></line>
			</svg>
			{saveError}
		</div>
	{/if}

	<!-- Footer -->
	<div class="flex justify-between items-center p-6 border-t border-neutral-200 dark:border-neutral-800 gap-4 max-sm:flex-col max-sm:items-stretch">
		<Button
			variant="secondary"
			onclick={handleReset}
			disabled={isLoading}
		>
			Reset Defaults
		</Button>
		<div class="flex gap-3 max-sm:flex-col">
			<Button
				variant="secondary"
				onclick={handleCancel}
				disabled={isLoading}
			>
				Cancel
			</Button>
			<Button
				variant="primary"
				onclick={handleSave}
				disabled={isLoading || !hasChanges}
				loading={isLoading}
			>
				Save Changes
			</Button>
		</div>
	</div>
</div>