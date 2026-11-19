<!--
  SettingsPanel Component

  Provides a settings interface for:
  - Export configuration (path, metadata options, date format)
  - UI preferences (theme, view mode, sort)
  - Updates (automatic check, version, check now)

  Uses the settings store for state management.
-->

<script lang="ts">
	import { commands } from '$lib/bindings';
	import { _ } from '$lib/i18n';
	import {
		settings,
		getViewModeLabel,
		getThemeLabel,
		getDateFormatLabel
	} from '../stores/settings.svelte';
	import { library } from '../stores/library.svelte';
	import type { ExportConfig, Language, ThemePreference, ViewMode, SortPreference } from '../types';
	import CustomCheckbox from './CustomCheckbox.svelte';
	import CustomRadio from './CustomRadio.svelte';
	import Button from './Button.svelte';
	import { updater } from '../stores/updater.svelte';

	// Props
	interface Props {
		onClose?: () => void;
		onSave?: () => void;
	}

	let { onClose, onSave }: Props = $props();

	// Local state for unsaved changes
	let hasChanges = $state(false);
	let saveError = $state<string | null>(null);
	let activeTab = $state<'export' | 'appearance' | 'updates'>('export');

	// Get current values from store
	const exportConfig = $derived(settings.exportConfig);
	const uiPreferences = $derived(settings.uiPreferences);
	const language = $derived(settings.language);
	const isLoading = $derived(settings.isLoading);
	const activeReader = $derived(library.readers.find((r) => r.id === library.activeReaderId));

	/** Renames the active Reader straight away: the name lives in the
	 * Library, not in settings.json, so it does not wait for Save (R3). */
	async function handleRenameReader(event: Event) {
		const name = (event.currentTarget as HTMLInputElement).value.trim();
		if (!activeReader || name === '' || name === activeReader.name) return;
		try {
			await library.renameReader(activeReader.id, name);
		} catch (error) {
			console.error('Failed to rename the reader:', error);
			saveError = $_('settings.errors.renameReader');
		}
	}

	// With a Reader open, the folder field is that Reader's folder (R21);
	// the base folder only seeds the default «base/Reader name».
	const defaultReaderFolder = $derived(
		activeReader ? `${exportConfig.exportPath}/${activeReader.name}` : ''
	);
	let readerFolderDraft = $state<string | null>(null);
	const readerFolder = $derived(
		readerFolderDraft ?? activeReader?.exportPath ?? defaultReaderFolder
	);

	function setFolder(path: string) {
		if (activeReader) readerFolderDraft = path;
		else settings.setExportPath(path);
		hasChanges = true;
	}

	/** Saves the Reader's folder; the default folder is stored as null so it
	 * follows the base folder and the Reader's name. */
	async function saveReaderFolder() {
		if (!activeReader || readerFolderDraft === null) return;
		const path = readerFolderDraft.trim();
		await library.setReaderExportPath(
			activeReader.id,
			path === '' || path === defaultReaderFolder ? null : path
		);
		readerFolderDraft = null;
	}

	// Metadata options configuration
	const metadataOptions: (keyof ExportConfig['metadata'])[] = [
		'author',
		'isbn',
		'publisher',
		'dateLastRead',
		'language',
		'description'
	];

	// Date format options
	const dateFormats: ExportConfig['dateFormat'][] = ['dd_month_yyyy', 'dd_mm_yyyy', 'iso8601'];

	// Language options, each named in its own language
	const languages: Language[] = ['en', 'pt'];

	// Theme options
	const themes: ThemePreference[] = ['system', 'light', 'dark'];

	// View mode options
	const viewModes: ViewMode[] = ['grid', 'list'];

	const themeLabelKeys: Record<ThemePreference, string> = {
		system: 'settings.appearance.themeSystem',
		light: 'settings.appearance.themeLight',
		dark: 'settings.appearance.themeDark'
	};

	const viewModeLabelKeys: Record<ViewMode, string> = {
		grid: 'settings.appearance.viewModeGrid',
		list: 'settings.appearance.viewModeList'
	};

	// Handlers
	function handleExportPathChange(event: Event) {
		setFolder((event.target as HTMLInputElement).value);
	}

	async function handleBrowseFolder() {
		try {
			const current = activeReader ? readerFolder : exportConfig.exportPath;
			const selectedPath = await commands.pickExportFolder(current);

			if (selectedPath) setFolder(selectedPath);
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

	function handleLanguageChange(choice: Language) {
		settings.setLanguage(choice);
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
		settings.setSyncOnConnect(!uiPreferences.syncOnConnect);
		hasChanges = true;
	}

	function handleCheckForUpdatesToggle() {
		settings.setCheckForUpdates(!uiPreferences.checkForUpdates);
		hasChanges = true;
	}

	/** «Procurada hoje às 17:10.», or the date when it was another day. */
	function lastCheckedLabel(date: Date | null, lang: string): string {
		if (!date) return $_('updates.settings.never');
		const today = new Date().toDateString() === date.toDateString();
		return today
			? $_('updates.settings.lastCheckedToday', {
					time: new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(date)
				})
			: $_('updates.settings.lastCheckedOn', {
					date: new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(date)
				});
	}

	async function handleSave() {
		saveError = null;
		try {
			await saveReaderFolder();
			await settings.save();
			hasChanges = false;
			onSave?.();
			onClose?.();
		} catch (err) {
			console.error('Save error:', err);
			saveError = $_('settings.errors.save');
		}
	}

	async function handleReset() {
		if (confirm($_('settings.confirm.reset'))) {
			try {
				await settings.resetAndSave();
				hasChanges = false;
				onSave?.();
			} catch (err) {
				console.error('Reset error:', err);
				saveError = $_('settings.errors.reset');
			}
		}
	}

	function handleCancel() {
		if (hasChanges) {
			if (confirm($_('settings.confirm.unsaved'))) {
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
		<h2 id="settings-title" class="text-xl font-semibold text-neutral-900 dark:text-neutral-100 m-0">{$_('settings.title')}</h2>
		<Button
			variant="icon"
			onclick={handleCancel}
			ariaLabel={$_('settings.close')}
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
	<div class="flex gap-2 px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50" role="tablist" aria-label={$_('settings.tabs')}>
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
			{$_('settings.export.tab')}
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
			{$_('settings.appearance.tab')}
		</button>
		<button
			class="flex items-center gap-3 px-4 py-2 border-b-2 font-medium text-sm transition-all duration-150 {activeTab === 'updates' ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white' : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'}"
			onclick={() => (activeTab = 'updates')}
			role="tab"
			aria-selected={activeTab === 'updates'}
			aria-controls="updates-panel"
			id="updates-tab"
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
				<circle cx="12" cy="12" r="10"></circle>
				<path d="M12 8v8"></path>
				<path d="m8 12 4 4 4-4"></path>
			</svg>
			{$_('updates.settings.tab')}
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
				{#if activeReader}
					<!-- Active Reader -->
					<section class="flex flex-col gap-4">
						<h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100 m-0">{$_('settings.reader.title')}</h3>
						<div class="flex flex-col gap-2">
							<label for="reader-name" class="text-sm font-medium text-neutral-600 dark:text-neutral-400">{$_('settings.reader.name')}</label>
							<input
								id="reader-name"
								data-testid="reader-name"
								type="text"
								value={activeReader.name}
								onchange={handleRenameReader}
								class="px-3 py-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
							/>
						</div>
					</section>
				{/if}

				<!-- Export Path -->
				<section class="flex flex-col gap-4">
					<h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100 m-0">{$_('settings.export.exportPath')}</h3>
					<div class="flex flex-col gap-2">
						<label for="export-path" class="text-sm font-medium text-neutral-600 dark:text-neutral-400">{$_('settings.export.path')}</label>
						<div class="flex gap-2 items-center">
							<input
								id="export-path"
								type="text"
								class="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-neutral-700 transition-all"
								value={activeReader ? readerFolder : exportConfig.exportPath}
								oninput={handleExportPathChange}
								placeholder="~/Documents/Kobo Highlights"
							/>
							<Button
								variant="secondary"
								onclick={handleBrowseFolder}
								ariaLabel={$_('settings.export.browseLabel')}
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
								{$_('settings.export.browse')}
							</Button>
						</div>
						<p class="text-xs text-neutral-500 dark:text-neutral-400 m-0">
							{activeReader
								? $_('settings.export.readerFolderHint', { name: activeReader.name })
								: $_('settings.export.folderHint')}
						</p>
					</div>
				</section>

				<!-- Metadata Options -->
				<section class="flex flex-col gap-4">
					<h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100 m-0">{$_('settings.export.metadataTitle')}</h3>
					<p class="text-sm text-neutral-500 dark:text-neutral-400 m-0 -mt-2">
						{$_('settings.export.metadataHint')}
					</p>
					<div class="grid grid-cols-2 gap-x-4 gap-y-0.5">
						{#each metadataOptions as option}
							<label class="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
								<CustomCheckbox
									checked={exportConfig.metadata[option]}
									onChange={() =>
										handleMetadataToggle(option)}
								/>
								<span class="text-sm text-neutral-900 dark:text-neutral-100">{$_(`settings.export.metadata.${option}`)}</span
								>
							</label>
						{/each}
					</div>
				</section>

				<!-- Date Format -->
				<section class="flex flex-col gap-4">
					<h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100 m-0">{$_('settings.export.dateFormat')}</h3>
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
									>{$_(`settings.export.dateFormats.${format}`)}</span
								>
							</label>
						{/each}
					</div>
				</section>
			</div>
		{:else if activeTab === 'appearance'}
			<div
				id="appearance-panel"
				role="tabpanel"
				aria-labelledby="appearance-tab"
				class="flex flex-col gap-8"
			>
				<!-- Language: the interface's and the exported Markdown's -->
				<section class="flex flex-col gap-4">
					<h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100 m-0">{$_('settings.appearance.language')}</h3>
					<p class="text-sm text-neutral-500 dark:text-neutral-400 m-0 -mt-2">
						{$_('settings.appearance.languageHint')}
					</p>
					<div class="flex rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden w-fit">
						{#each languages as choice}
							<button
								class="px-3 py-2 text-sm transition-colors border-r last:border-r-0 border-neutral-200 dark:border-neutral-700 {language === choice ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black' : 'bg-white text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'}"
								onclick={() => handleLanguageChange(choice)}
								aria-pressed={language === choice}
								lang={choice}
							>
								{$_(`settings.appearance.languages.${choice}`)}
							</button>
						{/each}
					</div>
				</section>

				<!-- Theme -->
				<section class="flex flex-col gap-4">
					<h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100 m-0">{$_('settings.appearance.theme')}</h3>
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
								{$_(themeLabelKeys[theme])}
							</button>
						{/each}
					</div>
				</section>

				<!-- View Mode -->
				<section class="flex flex-col gap-4">
					<h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100 m-0">{$_('settings.appearance.viewModeTitle')}</h3>
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
								{$_(viewModeLabelKeys[mode])}
							</button>
						{/each}
					</div>
				</section>

				<!-- Auto-import on connect -->
				<section class="flex flex-col gap-4">
					<h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100 m-0">{$_('settings.device.title')}</h3>
					<p class="text-sm text-neutral-500 dark:text-neutral-400 m-0 -mt-2">
						{$_('settings.device.syncOnConnectHint')}
					</p>
					<label class="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
						<input
							type="checkbox"
							checked={uiPreferences.syncOnConnect}
							onchange={handleAutoImportToggle}
							class="w-4 h-4 rounded-sm border-neutral-300 text-blue-600 focus:ring-blue-500"
						/>
						<span class="text-sm text-neutral-900 dark:text-neutral-100"
							>{$_('settings.device.syncOnConnect')}</span
						>
					</label>
				</section>
			</div>
		{:else}
			<div
				id="updates-panel"
				role="tabpanel"
				aria-labelledby="updates-tab"
				class="flex flex-col gap-8"
			>
				<section class="flex flex-col gap-1">
					<label class="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
						<input
							type="checkbox"
							role="switch"
							data-testid="check-for-updates"
							checked={uiPreferences.checkForUpdates}
							onchange={handleCheckForUpdatesToggle}
							aria-describedby="check-for-updates-hint"
							class="w-4 h-4 rounded-sm border-neutral-300 text-blue-600 focus:ring-blue-500"
						/>
						<span class="text-sm text-neutral-900 dark:text-neutral-100">{$_('updates.settings.auto')}</span>
					</label>
					<p id="check-for-updates-hint" class="m-0 pl-9 text-sm text-neutral-500 dark:text-neutral-400">
						{$_('updates.settings.autoHint')}
					</p>
				</section>

				<section class="flex items-center justify-between gap-4 p-2">
					<div class="flex flex-col gap-1">
						<span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
							{$_('updates.settings.version', { version: updater.currentVersion })}
						</span>
						<span class="text-sm text-neutral-500 dark:text-neutral-400" data-testid="last-checked">
							{lastCheckedLabel(updater.lastChecked, language)}
						</span>
					</div>
					<Button variant="secondary" disabled={updater.state === 'checking'} onclick={() => updater.checkNow()}>
						{$_('updates.settings.checkNow')}
					</Button>
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
			{$_('settings.actions.reset')}
		</Button>
		<div class="flex gap-3 max-sm:flex-col">
			<Button
				variant="secondary"
				onclick={handleCancel}
				disabled={isLoading}
			>
				{$_('settings.actions.cancel')}
			</Button>
			<Button
				variant="primary"
				onclick={handleSave}
				disabled={isLoading || !hasChanges}
				loading={isLoading}
			>
				{$_('settings.actions.saveChanges')}
			</Button>
		</div>
	</div>
</div>