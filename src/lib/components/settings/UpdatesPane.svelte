<!--
  Definições · Atualizações (Task 46, V2: Figma 78:25710). One group with no heading and two rows of
  51 px: the switch of the automatic check, and «Versão X» with «Procurar agora». The switch writes at
  the moment it changes. The updater lives in the main window: «Procurar agora» only asks it (the
  page emits `check-for-updates`), and `lastChecked` and `busy` are what the main window reports back.
-->
<script lang="ts">
	import { _, locale } from '$lib/i18n';
	import { settings } from '$lib/stores/settings.svelte';
	import { Button } from '../ui/button';
	import { FormGroup, FormRow } from '../ui/form';
	import { Switch } from '../ui/switch';

	interface Props {
		/** The installed version, shown in the second row. */
		version: string;
		/** When the main window last checked, if it ever did. */
		lastChecked: Date | null;
		/** The main window is checking or installing: «Procurar agora» waits. */
		busy?: boolean;
		onCheckNow: () => void;
		onerror?: (message: string | null) => void;
	}

	let { version, lastChecked, busy = false, onCheckNow, onerror }: Props = $props();

	const lang = $derived($locale ?? 'en');

	/** «Procurada hoje às 17:10.», or the date when it was another day. */
	const lastCheckedLabel = $derived.by(() => {
		if (!lastChecked) return $_('updates.settings.never');
		if (new Date().toDateString() === lastChecked.toDateString()) {
			return $_('updates.settings.lastCheckedToday', {
				time: new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(lastChecked)
			});
		}
		return $_('updates.settings.lastCheckedOn', {
			date: new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(lastChecked)
		});
	});

	function setCheckForUpdates(checked: boolean) {
		settings.setCheckForUpdates(checked);
		onerror?.(null);
		settings.commit(['uiPreferences.checkForUpdates']).catch(() => onerror?.($_('settings.errors.save')));
	}
</script>

<div data-slot="settings-pane-updates" class="flex flex-col gap-6">
	<FormGroup>
		<FormRow label={$_('updates.settings.auto')} help={$_('updates.settings.autoHint')}>
			{#snippet control({ labelId, helpId })}
				<Switch
					checked={settings.uiPreferences.checkForUpdates}
					onCheckedChange={setCheckForUpdates}
					aria-labelledby={labelId}
					aria-describedby={helpId}
				/>
			{/snippet}
		</FormRow>
		<FormRow label={$_('updates.settings.version', { version })} help={lastCheckedLabel} divider>
			{#snippet control({ labelId, helpId })}
				<Button variant="secundario" disabled={busy} onclick={onCheckNow} aria-describedby={helpId}>
					{$_('updates.settings.checkNow')}
				</Button>
			{/snippet}
		</FormRow>
	</FormGroup>
</div>
