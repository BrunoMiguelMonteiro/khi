/**
 * Settings Store - Svelte 5 runes-based store for application settings
 *
 * Provides reactive state management for:
 * - Export configuration (path, metadata options, date format)
 * - UI preferences (theme, window size, view mode, sort)
 * - Last import record
 *
 * Integrates with Tauri commands for persistence.
 * This store uses the Backend (Rust) as the Single Source of Truth for defaults.
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { commands, type SettingsPatch_Deserialize as SettingsPatch } from "../bindings";
import { locale } from "$lib/i18n";
import { applyAccent, getSystemAccent, listenSystemAccent, type SystemAccent } from "$lib/accent/accent";
import { currentWindowLabel } from "$lib/window";
import type {
  AppSettings,
  ExportConfig,
  Language,
  UiPreferences,
  ThemePreference,
  ViewMode,
  SortPreference,
} from "../types";
import type { AccentChoice, SettingsPane } from "../bindings";

/**
 * What the Settings window edits (the fields of `SettingsPanel`), by leaf:
 * the rest of the file belongs to the main window (view, sort, window size).
 * Every leaf it writes is here, so a `settings-changed` from the main window
 * cannot undo a choice still on its way to Rust.
 */
export const SETTINGS_WINDOW_FIELDS = [
  "exportConfig.exportPath",
  "exportConfig.metadata",
  "exportConfig.dateFormat",
  "language",
  "uiPreferences.theme",
  "uiPreferences.accentColor",
  "uiPreferences.settingsPane",
  "uiPreferences.syncOnConnect",
  "uiPreferences.checkForUpdates",
] as const;

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function read(settings: AppSettings, path: string): unknown {
  return path.split(".").reduce<any>((node, key) => node?.[key], settings);
}

function write(settings: AppSettings, path: string, value: unknown) {
  const keys = path.split(".");
  const last = keys.pop()!;
  const parent = keys.reduce<any>((node, key) => node[key], settings);
  parent[last] = copy(value);
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => same((a as any)[key], (b as any)[key]))
  );
}

/** A copy of `target` with `fields` taken from `source`. */
function withFields(
  target: AppSettings,
  source: AppSettings,
  fields: readonly string[],
): AppSettings {
  const out = copy(target);
  for (const path of fields) write(out, path, read(source, path));
  return out;
}

/**
 * The patch that writes `fields` as they are in `source`. Each leaf goes by
 * its own name (`uiPreferences.theme` → `theme`), as `SettingsPatch` in Rust.
 */
export function patchOf(source: AppSettings, fields: readonly string[]): SettingsPatch {
  const patch: Record<string, unknown> = {};
  for (const path of fields) {
    const value = read(source, path);
    // A leaf the settings do not have is left out, as Rust's `None`
    if (value !== undefined) patch[path.split(".").pop()!] = copy(value);
  }
  return patch as SettingsPatch;
}

/**
 * Initial empty state to satisfy TypeScript before Rust provides actual values.
 * Values here are placeholders and should be overwritten by initialize() or load().
 */
function createInitialState(): AppSettings {
  return {
    exportConfig: {
      exportPath: "",
      metadata: {
        author: true,
        isbn: true,
        publisher: true,
        dateLastRead: true,
        language: true,
        description: false,
      },
      dateFormat: "iso8601",
    },
    uiPreferences: {
      theme: "system",
      windowWidth: 1200,
      windowHeight: 800,
      isMaximized: false,
      showOnboarding: true,
      libraryViewMode: "grid",
      librarySort: "title",
      librarySortReversed: false,
      syncOnConnect: true,
      checkForUpdates: true,
      settingsPane: "kobo",
      accentColor: "system",
    },
    language: "en",
    version: "0.1.0",
  };
}

/** Sync macOS native titlebar theme (fire-and-forget). Pass null to follow system. */
function syncTitlebar(theme: "light" | "dark" | null) {
  import("@tauri-apps/api/window")
    .then(({ getCurrentWindow }) => getCurrentWindow().setTheme(theme))
    .catch(() => {});
}

/**
 * Apply theme to the document root and configure system theme listener if needed.
 * Extracted as a standalone function so it can be tested independently of Svelte's
 * effect scheduler.
 *
 * Returns a cleanup function that removes the matchMedia listener (if one was added).
 */
export function applyTheme(
  theme: ThemePreference,
  root: HTMLElement = document.documentElement,
): (() => void) | void {
  root.classList.remove("light", "dark");

  if (theme === "system") {
    // syncTitlebar(null) is fire-and-forget: the Tauri setTheme(null) may
    // not take effect before the matchMedia read below. In practice this is
    // fine because matchMedia reflects the OS preference independently of
    // Tauri's window theme, and the listener corrects any mismatch later.
    syncTitlebar(null);

    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";
    root.classList.add(systemTheme);

    // Local listener + cleanup — mirrors the astro-editor pattern
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      const newTheme = mediaQuery.matches ? "dark" : "light";
      if (root.classList.contains(newTheme)) return;
      root.classList.remove("light", "dark");
      root.classList.add(newTheme);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  } else {
    root.classList.add(theme);
    syncTitlebar(theme);
  }
}

class SettingsStore {
  state = $state<AppSettings>(createInitialState());
  isLoading = $state(false);
  /** The settings have been read once, from the file or from Rust's defaults. */
  loaded = $state(false);
  /** The accent chosen in System Settings, for the «Sistema» accent. */
  systemAccent = $state<SystemAccent>({ name: "multicolor", light: "#007AFF", dark: "#007AFF" });
  /** The OS is dark, for the theme that follows it. */
  private systemDark = $state(false);
  /** `main` or `settings`: each window has its own store (see initialize). */
  private windowLabel = "main";
  /** The file as this window last knew it: loaded, saved or announced. */
  private saved: AppSettings | null = null;
  private unlistenChanges: UnlistenFn | null = null;
  private unlistenAccent: (() => void) | null = null;
  error = $state<string | null>(null);

  // Derived state for easier access
  exportConfig = $derived(this.state.exportConfig);
  uiPreferences = $derived(this.state.uiPreferences);
  language = $derived(this.state.language);

  constructor() {
    // $effect.root() needed because this class is instantiated at module scope,
    // outside any Svelte component initialization context
    $effect.root(() => {
      $effect(() => {
        if (typeof window === "undefined") return;
        const theme = this.state.uiPreferences?.theme;
        if (!theme) return;
        return applyTheme(theme);
      });
      // The interface speaks the settings' language, however they changed
      $effect(() => {
        const language = this.state.language;
        if (language) locale.set(language);
      });
      // The OS appearance, for the accent of a theme that follows it
      $effect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;
        const query = window.matchMedia("(prefers-color-scheme: dark)");
        this.systemDark = query.matches;
        const update = (event: { matches: boolean }) => (this.systemDark = event.matches);
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
      });
      // The accent's tones, for Claro or Escuro: inline values beat `.dark`, so
      // they are written again whenever the mode, the choice or macOS changes
      $effect(() => {
        if (typeof document === "undefined") return;
        const prefs = this.state.uiPreferences;
        if (!prefs?.accentColor) return;
        const dark = prefs.theme === "dark" || (prefs.theme !== "light" && this.systemDark);
        applyAccent(prefs.accentColor, this.systemAccent, dark ? "escuro" : "claro");
      });
    });
  }

  // ============================================
  // Actions - Settings Management
  // ============================================

  setSettings(newSettings: AppSettings) {
    this.state = newSettings;
  }

  updateSettings(updates: Partial<AppSettings>) {
    this.state = { ...this.state, ...updates };
  }

  /**
   * Pede ao Rust os valores por defeito e atualiza o estado local.
   */
  async resetSettings() {
    this.isLoading = true;
    try {
      const defaults = await commands.getDefaultSettings();
      this.state = defaults;
    } catch (err) {
      console.error("Failed to fetch default settings:", err);
    } finally {
      this.isLoading = false;
    }
  }

  // ============================================
  // Actions - Export Config
  // ============================================

  setExportPath(path: string) {
    this.state.exportConfig.exportPath = path;
  }

  setMetadataOption(option: keyof ExportConfig["metadata"], value: boolean) {
    this.state.exportConfig.metadata[option] = value;
  }

  setDateFormat(format: ExportConfig["dateFormat"]) {
    this.state.exportConfig.dateFormat = format;
  }

  updateExportConfig(config: Partial<ExportConfig>) {
    this.state.exportConfig = { ...this.state.exportConfig, ...config };
  }

  // ============================================
  // Actions - UI Preferences
  // ============================================

  /** Interface and exported Markdown language; saved with the settings. */
  setLanguage(language: Language) {
    this.state.language = language;
  }

  setTheme(theme: ThemePreference) {
    this.state.uiPreferences.theme = theme;
  }

  setAccentColor(accent: AccentChoice) {
    this.state.uiPreferences.accentColor = accent;
  }

  /** The Settings pane open last, reopened with the window. */
  setSettingsPane(pane: SettingsPane) {
    this.state.uiPreferences.settingsPane = pane;
  }

  setViewMode(mode: ViewMode) {
    this.state.uiPreferences.libraryViewMode = mode;
  }

  /** A new criterion starts in its natural direction. */
  setSortPreference(sort: SortPreference) {
    this.state.uiPreferences.librarySort = sort;
    this.state.uiPreferences.librarySortReversed = false;
  }

  setSortReversed(reversed: boolean) {
    this.state.uiPreferences.librarySortReversed = reversed;
  }

  setWindowSize(width: number, height: number) {
    this.state.uiPreferences.windowWidth = width;
    this.state.uiPreferences.windowHeight = height;
  }

  setWindowMaximized(isMaximized: boolean) {
    this.state.uiPreferences.isMaximized = isMaximized;
  }

  setShowOnboarding(show: boolean) {
    this.state.uiPreferences.showOnboarding = show;
  }

  setSyncOnConnect(enabled: boolean) {
    this.state.uiPreferences.syncOnConnect = enabled;
  }

  setCheckForUpdates(enabled: boolean) {
    this.state.uiPreferences.checkForUpdates = enabled;
  }

  updateUiPreferences(prefs: Partial<UiPreferences>) {
    this.state.uiPreferences = { ...this.state.uiPreferences, ...prefs };
  }

  // ============================================
  // Tauri Integration
  // ============================================

  /**
   * Load settings from disk via Tauri
   */
  async load() {
    this.isLoading = true;
    this.error = null;

    try {
      const loadedSettings = await commands.loadSettings();
      this.state = loadedSettings;
      this.saved = copy(loadedSettings);
      // $effect will apply theme automatically when state changes
    } catch (err) {
      console.error("Failed to load settings:", err);
      this.error =
        err instanceof Error ? err.message : "Failed to load settings";
      // Fallback to defaults from Rust if load fails
      await this.resetSettings();
    } finally {
      this.isLoading = false;
      this.loaded = true;
    }
  }

  /**
   * Writes only `patch` over the file, in Rust and under its lock; every
   * window then gets the file as `settings-changed`, the writer included.
   * The answer is only for the error and the file it returns: it is not
   * applied, because it can arrive after a newer event (the events leave Rust
   * under the lock, so they arrive in order; an answer has no such order).
   */
  async persist(patch: SettingsPatch): Promise<AppSettings> {
    return commands.updateSettings(patch);
  }

  /**
   * Writes `fields` as they are in the state now, at the moment a control
   * changes them (the Settings window has no Save). The state is never taken
   * from the answer: a second choice made meanwhile is the newer one, and
   * Rust's lock keeps the writes in order. If Rust refuses, the fields go
   * back to what the file has and the error is kept.
   */
  async commit(fields: readonly string[]): Promise<void> {
    this.error = null;
    try {
      await this.persist(patchOf(this.state, fields));
    } catch (err) {
      console.error("Failed to save settings:", err);
      this.error = typeof err === "string" ? err : err instanceof Error ? err.message : "Failed to save settings";
      if (this.saved) for (const path of fields) write(this.state, path, read(this.saved, path));
      throw err;
    }
  }

  /**
   * Initialize settings on app startup
   */
  async initialize() {
    this.windowLabel = currentWindowLabel();
    await this.load();
    // $effect in constructor will handle theme setup automatically
    await this.listenForChanges();
    await this.followSystemAccent();
  }

  /** «Sistema» is the accent in System Settings, now and when it changes. */
  private async followSystemAccent() {
    try {
      const current = await getSystemAccent();
      if (current) this.systemAccent = current;
      this.unlistenAccent?.();
      this.unlistenAccent = await listenSystemAccent((accent) => (this.systemAccent = accent));
    } catch (err) {
      console.error("Failed to follow the system accent:", err);
    }
  }

  /** Rust emits `settings-changed` with the file after every save. */
  private async listenForChanges() {
    this.unlistenChanges?.();
    try {
      this.unlistenChanges = await listen<AppSettings>("settings-changed", (event) =>
        this.applySaved(event.payload),
      );
    } catch (err) {
      console.error("Failed to listen for settings changes:", err);
    }
  }

  /**
   * The main window takes only the Settings fields this save changed, so its
   * own view mode and sort stay. The Settings window keeps its unsaved draft
   * and takes the rest.
   */
  private applySaved(saved: AppSettings) {
    const base = this.saved;
    if (this.windowLabel === "settings") {
      const touched = base
        ? SETTINGS_WINDOW_FIELDS.filter((path) => !same(read(this.state, path), read(base, path)))
        : [];
      this.state = withFields(saved, this.state, touched);
    } else {
      for (const path of SETTINGS_WINDOW_FIELDS) {
        if (!base || !same(read(saved, path), read(base, path))) write(this.state, path, read(saved, path));
      }
    }
    this.saved = copy(saved);
  }

}

export const settings = new SettingsStore();

// Export helper functions for UI labels (stateless)
export function getSortLabel(sort: SortPreference): string {
  const labels: Record<SortPreference, string> = {
    title: "Title",
    author: "Author",
    date_last_read: "Date Read",
    highlight_count: "Highlight Count",
  };
  return labels[sort];
}

export function getViewModeLabel(mode: ViewMode): string {
  const labels: Record<ViewMode, string> = {
    grid: "Grid",
    list: "List",
  };
  return labels[mode];
}

export function getThemeLabel(theme: ThemePreference): string {
  const labels: Record<ThemePreference, string> = {
    system: "System",
    light: "Light",
    dark: "Dark",
  };
  return labels[theme];
}

export function getDateFormatLabel(format: ExportConfig["dateFormat"]): string {
  const labels: Record<string, string> = {
    dd_mm_yyyy: "DD/MM/YYYY (24/01/2025)",
    dd_month_yyyy: "24 January 2025",
    iso8601: "ISO 8601 (2025-01-24)",
  };
  return labels[format] || format;
}
