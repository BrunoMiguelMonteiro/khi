<!--
  Definições · Aparência (Task 45): theme, accent colour and language, in one group with no heading.
  Every control writes at the moment it changes, and the windows follow at once.
-->
<script lang="ts">
	import { _ } from '$lib/i18n';
	import { settings } from '$lib/stores/settings.svelte';
	import type { Language, ThemePreference } from '$lib/types';
	import { FormGroup, FormRow } from '../ui/form';
	import { Select } from '../ui/select';
	import { SwatchGroup, type SwatchValue } from '../ui/swatch';

	let { onerror }: { onerror?: (message: string | null) => void } = $props();

	const uiPreferences = $derived(settings.uiPreferences);

	const themes: ThemePreference[] = ['system', 'light', 'dark'];
	const themeKeys: Record<ThemePreference, string> = {
		system: 'settings.appearance.themeSystem',
		light: 'settings.appearance.themeLight',
		dark: 'settings.appearance.themeDark'
	};
	const themeItems = $derived(themes.map((value) => ({ value, label: $_(themeKeys[value]) })));

	// Each language in its own, whatever the interface speaks
	const languages: Language[] = ['en', 'es', 'fr', 'pt'];
	const languageItems = $derived(
		languages.map((value) => ({ value, label: $_(`settings.appearance.languages.${value}`) }))
	);

	const failed = () => onerror?.($_('settings.errors.save'));
	/** A new write: the error of the last one is old news. */
	const writing = () => onerror?.(null);

	function setTheme(value: string) {
		settings.setTheme(value as ThemePreference);
		writing();
		settings.commit(['uiPreferences.theme']).catch(failed);
	}

	function setAccent(value: SwatchValue) {
		settings.setAccentColor(value);
		writing();
		settings.commit(['uiPreferences.accentColor']).catch(failed);
	}

	function setLanguage(value: string) {
		settings.setLanguage(value as Language);
		writing();
		settings.commit(['language']).catch(failed);
	}
</script>

<div data-slot="settings-pane-appearance" class="flex flex-col gap-6">
	<FormGroup>
		<FormRow label={$_('settings.appearance.theme')}>
			{#snippet control({ labelId })}
				<Select items={themeItems} value={uiPreferences.theme} onValueChange={setTheme} aria-labelledby={labelId} />
			{/snippet}
		</FormRow>
		<FormRow label={$_('settings.accent.label')} help={$_('settings.accent.hint')} divider>
			{#snippet control({ labelId, helpId })}
				<SwatchGroup
					value={uiPreferences.accentColor}
					onValueChange={setAccent}
					aria-labelledby={labelId}
					aria-describedby={helpId}
					aria-label={undefined}
				/>
			{/snippet}
		</FormRow>
		<FormRow label={$_('settings.appearance.language')} help={$_('settings.appearance.languageHint')} divider>
			{#snippet control({ labelId, helpId })}
				<Select
					items={languageItems}
					value={settings.language}
					onValueChange={setLanguage}
					aria-labelledby={labelId}
					aria-describedby={helpId}
				/>
			{/snippet}
		</FormRow>
	</FormGroup>
</div>
