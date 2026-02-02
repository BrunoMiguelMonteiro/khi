<!--
  SettingsPanel Component

  Provides a settings interface for:
  - Export configuration (path, metadata options, date format)
  - UI preferences (theme, view mode, sort)

  Uses the settings store for state management.
-->

<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import {
        getSettings,
        getExportConfig,
        getUiPreferences,
        getIsLoading,
        setExportPath,
        setMetadataOption,
        setDateFormat,
        setTheme,
        setViewMode,
        setSortPreference,
        setAutoImportOnConnect,
        saveSettings,
        resetAndSaveSettings,
        getSortLabel,
        getViewModeLabel,
        getThemeLabel,
        getDateFormatLabel,
    } from "../stores/settings.svelte";
    import type {
        ExportConfig,
        ThemePreference,
        ViewMode,
        SortPreference,
    } from "../types";
    import CustomCheckbox from "./CustomCheckbox.svelte";
    import CustomRadio from "./CustomRadio.svelte";

    // Props
    interface Props {
        onClose?: () => void;
        onSave?: () => void;
    }

    let { onClose, onSave }: Props = $props();

    // Local state for unsaved changes
    let hasChanges = $state(false);
    let saveError = $state<string | null>(null);
    let activeTab = $state<"export" | "appearance">("export");

    // Get current values from store
    const exportConfig = $derived(getExportConfig());
    const uiPreferences = $derived(getUiPreferences());
    const isLoading = $derived(getIsLoading());

    // Metadata options configuration
    const metadataOptions: {
        key: keyof ExportConfig["metadata"];
        label: string;
    }[] = [
        { key: "author", label: "Author" },
        { key: "isbn", label: "ISBN" },
        { key: "publisher", label: "Publisher" },
        { key: "dateLastRead", label: "Last Read Date" },
        { key: "language", label: "Language" },
        { key: "description", label: "Description" },
    ];

    // Date format options
    const dateFormats: ExportConfig["dateFormat"][] = [
        "dd_mm_yyyy",
        "dd_month_yyyy",
        "iso8601",
    ];

    // Theme options
    const themes: ThemePreference[] = ["system", "light", "dark"];

    // View mode options
    const viewModes: ViewMode[] = ["grid", "list"];

    // Sort options
    const sortOptions: SortPreference[] = [
        "title",
        "author",
        "date_last_read",
        "highlight_count",
    ];

    // Helper to translate labels that come from store (if they are not already localized there)
    // For now, assuming store returns generic or English labels, or we map them here.
    // The store functions getSortLabel etc might return Portuguese. I should override or update store.
    // Since I cannot easily update store without checking it, I will map them here if possible,
    // or just use the English labels directly if I know the values.

    function getEnglishSortLabel(sort: SortPreference): string {
        switch (sort) {
            case "title":
                return "Title";
            case "author":
                return "Author";
            case "date_last_read":
                return "Last Read";
            case "highlight_count":
                return "Highlight Count";
            default:
                return sort;
        }
    }

    function getEnglishThemeLabel(theme: ThemePreference): string {
        switch (theme) {
            case "system":
                return "System";
            case "light":
                return "Light";
            case "dark":
                return "Dark";
            default:
                return theme;
        }
    }

    function getEnglishViewModeLabel(mode: ViewMode): string {
        switch (mode) {
            case "grid":
                return "Grid";
            case "list":
                return "List";
            default:
                return mode;
        }
    }

    function getEnglishDateFormatLabel(
        format: ExportConfig["dateFormat"],
    ): string {
        const labels: Record<string, string> = {
            dd_mm_yyyy: "DD/MM/YYYY (24/01/2025)",
            dd_month_yyyy: "24 January 2025",
            iso8601: "ISO 8601 (2025-01-24)",
        };
        return labels[format] || format;
    }

    // Handlers
    function handleExportPathChange(event: Event) {
        const target = event.target as HTMLInputElement;
        setExportPath(target.value);
        hasChanges = true;
    }

    async function handleBrowseFolder() {
        try {
            const selectedPath = await invoke<string | null>(
                "pick_export_folder",
                {
                    defaultPath: exportConfig.exportPath,
                },
            );

            if (selectedPath) {
                setExportPath(selectedPath);
                hasChanges = true;
            }
        } catch (error) {
            console.error("Failed to pick folder:", error);
        }
    }

    function handleMetadataToggle(key: keyof ExportConfig["metadata"]) {
        setMetadataOption(key, !exportConfig.metadata[key]);
        hasChanges = true;
    }

    function handleDateFormatChange(format: ExportConfig["dateFormat"]) {
        setDateFormat(format);
        hasChanges = true;
    }

    function handleThemeChange(theme: ThemePreference) {
        setTheme(theme);
        hasChanges = true;
    }

    function handleViewModeChange(mode: ViewMode) {
        setViewMode(mode);
        hasChanges = true;
    }

    function handleSortChange(sort: SortPreference) {
        setSortPreference(sort);
        hasChanges = true;
    }

    function handleAutoImportToggle() {
        setAutoImportOnConnect(!uiPreferences.autoImportOnConnect);
        hasChanges = true;
    }

    async function handleSave() {
        saveError = null;
        try {
            await saveSettings();
            hasChanges = false;
            onSave?.();
            onClose?.();
        } catch (err) {
            console.error("Save error:", err);
            if (err instanceof Error) {
                saveError = err.message;
            } else if (typeof err === "string") {
                saveError = err;
            } else {
                saveError = "Error saving settings: " + JSON.stringify(err);
            }
        }
    }

    async function handleReset() {
        if (confirm("Are you sure you want to reset to default settings?")) {
            try {
                await resetAndSaveSettings();
                hasChanges = false;
                onSave?.();
            } catch (err) {
                saveError =
                    err instanceof Error
                        ? err.message
                        : "Error resetting settings";
            }
        }
    }

    function handleCancel() {
        if (hasChanges) {
            if (
                confirm(
                    "You have unsaved changes. Do you want to exit without saving?",
                )
            ) {
                onClose?.();
            }
        } else {
            onClose?.();
        }
    }
</script>

<div
    class="settings-panel"
    role="dialog"
    aria-labelledby="settings-title"
    aria-modal="true"
>
    <div class="settings-header">
        <h2 id="settings-title" class="settings-title">Settings</h2>
        <button
            class="close-button"
            onclick={handleCancel}
            aria-label="Close settings"
        >
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
        </button>
    </div>

    <!-- Tabs -->
    <div class="settings-tabs" role="tablist" aria-label="Settings tabs">
        <button
            class="tab-button"
            class:active={activeTab === "export"}
            onclick={() => (activeTab = "export")}
            role="tab"
            aria-selected={activeTab === "export"}
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
            class="tab-button"
            class:active={activeTab === "appearance"}
            onclick={() => (activeTab = "appearance")}
            role="tab"
            aria-selected={activeTab === "appearance"}
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
    <div class="settings-content">
        {#if activeTab === "export"}
            <div
                id="export-panel"
                role="tabpanel"
                aria-labelledby="export-tab"
                class="tab-panel"
            >
                <!-- Export Path -->
                <section class="settings-section">
                    <h3 class="section-title">Export Folder</h3>
                    <div class="form-group">
                        <label for="export-path" class="form-label">Path</label>
                        <div class="input-with-button">
                            <input
                                id="export-path"
                                type="text"
                                class="form-input"
                                value={exportConfig.exportPath}
                                oninput={handleExportPathChange}
                                placeholder="~/Documents/Kobo Highlights"
                            />
                            <button
                                type="button"
                                class="browse-button"
                                onclick={handleBrowseFolder}
                                aria-label="Browse for export folder"
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
                                    <path
                                        d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                                    ></path>
                                </svg>
                                Browse
                            </button>
                        </div>
                        <p class="form-hint">
                            Markdown files will be saved in this folder.
                        </p>
                    </div>
                </section>

                <!-- Metadata Options -->
                <section class="settings-section">
                    <h3 class="section-title">Metadata to Include</h3>
                    <p class="section-description">
                        Select which metadata to include in the exported files.
                    </p>
                    <div class="checkbox-group">
                        {#each metadataOptions as option}
                            <label class="checkbox-label">
                                <CustomCheckbox
                                    checked={exportConfig.metadata[option.key]}
                                    onChange={() =>
                                        handleMetadataToggle(option.key)}
                                />
                                <span class="checkbox-text">{option.label}</span
                                >
                            </label>
                        {/each}
                    </div>
                </section>

                <!-- Date Format -->
                <section class="settings-section">
                    <h3 class="section-title">Date Format</h3>
                    <div class="radio-group">
                        {#each dateFormats as format}
                            <label class="radio-label">
                                <CustomRadio
                                    name="date-format"
                                    value={format}
                                    checked={exportConfig.dateFormat === format}
                                    onChange={() =>
                                        handleDateFormatChange(format)}
                                />
                                <span class="radio-text"
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
                class="tab-panel"
            >
                <!-- Theme -->
                <section class="settings-section">
                    <h3 class="section-title">Theme</h3>
                    <div class="button-group">
                        {#each themes as theme}
                            <button
                                class="theme-button"
                                class:active={uiPreferences.theme === theme}
                                onclick={() => handleThemeChange(theme)}
                                aria-pressed={uiPreferences.theme === theme}
                            >
                                {#if theme === "system"}
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
                                {:else if theme === "light"}
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
                <section class="settings-section">
                    <h3 class="section-title">Library View Mode</h3>
                    <div class="button-group">
                        {#each viewModes as mode}
                            <button
                                class="view-mode-button"
                                class:active={uiPreferences.libraryViewMode ===
                                    mode}
                                onclick={() => handleViewModeChange(mode)}
                                aria-pressed={uiPreferences.libraryViewMode ===
                                    mode}
                            >
                                {#if mode === "grid"}
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

                <!-- Sort Preference -->
                <section class="settings-section">
                    <h3 class="section-title">
                        <label for="sort-preference">Default Sort</label>
                    </h3>
                    <div class="select-wrapper">
                        <select
                            id="sort-preference"
                            class="form-select"
                            value={uiPreferences.librarySort}
                            onchange={(e) =>
                                handleSortChange(
                                    (e.target as HTMLSelectElement)
                                        .value as SortPreference,
                                )}
                            aria-label="Default library sort"
                        >
                            {#each sortOptions as sort}
                                <option value={sort}
                                    >{getEnglishSortLabel(sort)}</option
                                >
                            {/each}
                        </select>
                    </div>
                </section>

                <!-- Auto-import on connect -->
                <section class="settings-section">
                    <h3 class="section-title">Device Connection</h3>
                    <p class="section-description">
                        Automatically import highlights when a Kobo device is
                        connected.
                    </p>
                    <label class="checkbox-label">
                        <input
                            type="checkbox"
                            checked={uiPreferences.autoImportOnConnect}
                            onchange={handleAutoImportToggle}
                            class="checkbox-input"
                        />
                        <span class="checkbox-text"
                            >Auto-import on device connect</span
                        >
                    </label>
                </section>
            </div>
        {/if}
    </div>

    <!-- Error Message -->
    {#if saveError}
        <div class="error-message" role="alert">
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
    <div class="settings-footer">
        <button
            class="button button-secondary"
            onclick={handleReset}
            disabled={isLoading}
        >
            Reset Defaults
        </button>
        <div class="footer-actions">
            <button
                class="button button-secondary"
                onclick={handleCancel}
                disabled={isLoading}
            >
                Cancel
            </button>
            <button
                class="button button-primary"
                onclick={handleSave}
                disabled={isLoading || !hasChanges}
            >
                {#if isLoading}
                    <span class="spinner"></span>
                    Saving...
                {:else}
                    Save Changes
                {/if}
            </button>
        </div>
    </div>
</div>

<style>
    .settings-panel {
        display: flex;
        flex-direction: column;
        background: var(--surface-primary);
        border-radius: var(--radius-lg);
        max-width: 720px;
        width: 100%;
        max-height: 80vh;
        overflow: hidden;
    }

    .settings-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--space-6);
        border-bottom: 1px solid var(--border-default);
    }

    .settings-title {
        font-size: var(--text-xl);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
        margin: 0;
    }

    .close-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border: none;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all var(--transition-fast);
    }

    .close-button:hover {
        background: var(--surface-tertiary);
        color: var(--text-primary);
    }

    .close-button:focus-visible {
        outline: 2px solid var(--color-primary-500);
        outline-offset: 2px;
    }

    /* Tabs */
    .settings-tabs {
        display: flex;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-6);
        border-bottom: 1px solid var(--border-default);
        background: var(--surface-secondary);
    }

    .tab-button {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-2) var(--space-4);
        border: none;
        border-bottom: 2px solid transparent;
        border-radius: 0;
        background: transparent;
        color: var(--text-secondary);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        cursor: pointer;
        transition: all var(--transition-fast);
    }

    .tab-button:hover {
        color: var(--text-primary);
    }

    .tab-button.active {
        border-bottom-color: rgb(10, 10, 10);
        color: var(--text-primary);
    }

    :global(.dark) .tab-button.active {
        border-bottom-color: white;
    }

    .tab-button:focus-visible {
        outline: 2px solid var(--color-primary-500);
        outline-offset: 2px;
    }

    /* Content */
    .settings-content {
        flex: 1;
        overflow-y: auto;
        padding: var(--space-6);
    }

    .tab-panel {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
    }

    .settings-section {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }

    .section-title {
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
        margin: 0;
    }

    .section-description {
        font-size: var(--text-sm);
        color: var(--text-secondary);
        margin: 0;
        margin-top: calc(-1 * var(--space-2));
    }

    /* Form Elements */
    .form-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }

    .form-label {
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--text-secondary);
    }

    .form-input {
        padding: var(--space-2) var(--space-4);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: var(--surface-primary);
        color: var(--text-primary);
        font-size: var(--text-sm);
        transition: border-color var(--transition-fast);
    }

    .form-input:focus {
        outline: none;
        border-color: var(--color-primary-500);
        box-shadow: 0 0 0 3px var(--color-primary-100);
    }

    .form-hint {
        font-size: var(--text-xs);
        color: var(--text-tertiary);
        margin: 0;
    }

    /* Checkbox Group */
    .checkbox-group {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: var(--space-3);
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-2);
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: background var(--transition-fast);
    }

    .checkbox-label:hover {
        background: var(--surface-secondary);
    }

    .checkbox-text {
        font-size: var(--text-sm);
        color: var(--text-primary);
    }

    /* Radio Group */
    .radio-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
    }

    .radio-label {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-2);
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: background var(--transition-fast);
    }

    .radio-label:hover {
        background: var(--surface-secondary);
    }

    .radio-text {
        font-size: var(--text-sm);
        color: var(--text-primary);
    }

    /* Button Group */
    .button-group {
        display: flex;
        gap: var(--space-3);
        flex-wrap: wrap;
    }

    .theme-button,
    .view-mode-button {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-2) var(--space-4);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: var(--surface-primary);
        color: var(--text-secondary);
        font-size: var(--text-sm);
        cursor: pointer;
        transition: all var(--transition-fast);
    }

    .theme-button:hover,
    .view-mode-button:hover {
        border-color: var(--color-primary-500);
        color: var(--text-primary);
    }

    .theme-button.active,
    .view-mode-button.active {
        border-color: var(--color-primary-500);
        background: var(--color-primary-50);
        color: var(--color-primary-700);
    }

    .theme-button:focus-visible,
    .view-mode-button:focus-visible {
        outline: 2px solid var(--color-primary-500);
        outline-offset: 2px;
    }

    /* Select */
    .select-wrapper {
        position: relative;
    }

    .form-select {
        width: 100%;
        padding: var(--space-2) var(--space-4);
        padding-right: var(--space-8);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: var(--surface-primary);
        color: var(--text-primary);
        font-size: var(--text-sm);
        cursor: pointer;
        appearance: none;
        transition: border-color var(--transition-fast);
    }

    .form-select:focus {
        outline: none;
        border-color: var(--color-primary-500);
        box-shadow: 0 0 0 3px var(--color-primary-100);
    }

    .select-wrapper::after {
        content: "";
        position: absolute;
        right: var(--space-4);
        top: 50%;
        transform: translateY(-50%);
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 5px solid var(--text-secondary);
        pointer-events: none;
    }

    /* Error Message */
    .error-message {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0 var(--space-6);
        padding: var(--space-3) var(--space-4);
        background: var(--color-error-50);
        color: var(--color-error-700);
        border-radius: var(--radius-md);
        font-size: var(--text-sm);
    }

    /* Footer */
    .settings-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--space-6);
        border-top: 1px solid var(--border-default);
        gap: var(--space-4);
    }

    .footer-actions {
        display: flex;
        gap: var(--space-3);
    }

    .button {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-4);
        border: 1px solid transparent;
        border-radius: var(--radius-md);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        cursor: pointer;
        transition: all var(--transition-fast);
    }

    .button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .button-primary {
        background: var(--color-primary-600);
        color: white;
        border-color: var(--color-primary-600);
    }

    .button-primary:hover:not(:disabled) {
        background: var(--color-primary-700);
        border-color: var(--color-primary-700);
    }

    .button-primary:focus-visible {
        outline: 2px solid var(--color-primary-500);
        outline-offset: 2px;
    }

    .button-secondary {
        background: var(--surface-secondary);
        color: var(--text-primary);
        border-color: var(--border-default);
    }

    .button-secondary:hover:not(:disabled) {
        background: var(--surface-tertiary);
        border-color: var(--border-hover);
    }

    .button-secondary:focus-visible {
        outline: 2px solid var(--color-primary-500);
        outline-offset: 2px;
    }

    /* Spinner */
    .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* Input with Button */
    .input-with-button {
        display: flex;
        gap: var(--space-2);
        align-items: center;
    }

    .input-with-button .form-input {
        flex: 1;
    }

    .browse-button {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: var(--surface-secondary);
        color: var(--text-primary);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        cursor: pointer;
        transition: all var(--transition-fast);
        white-space: nowrap;
    }

    .browse-button:hover {
        background: var(--surface-tertiary);
        border-color: var(--color-primary-500);
        color: var(--color-primary-600);
    }

    .browse-button:focus-visible {
        outline: 2px solid var(--color-primary-500);
        outline-offset: 2px;
    }

    /* Responsive */
    @media (max-width: 640px) {
        .settings-panel {
            max-width: 100%;
            max-height: 100vh;
            border-radius: 0;
        }

        .checkbox-group {
            grid-template-columns: 1fr;
        }

        .settings-footer {
            flex-direction: column;
            align-items: stretch;
        }

        .footer-actions {
            justify-content: stretch;
        }

        .footer-actions .button {
            flex: 1;
            justify-content: center;
        }
    }
</style>
