<!--
  Definições · Agentes (design B «Escolher o agente»). Two groups: the switch that lets agents read
  the Library (kept by Rust, off until turned on), and «Ligar um agente», where the user picks the
  agent and copies what it needs: the command or the JSON that points it at `khi-mcp`. The pick is
  only on screen, it is not stored. While the switch is off the second group and the footer are
  dimmed and cannot be used, but the snippet still shows.
-->
<script lang="ts">
	import Copy from 'lucide-svelte/icons/copy';
	import { onDestroy, onMount } from 'svelte';
	import { commands } from '$lib/bindings';
	import { _ } from '$lib/i18n';
	import { copyToClipboard } from '$lib/utils/clipboard';
	import { Button } from '../ui/button';
	import { FormGroup, FormRow } from '../ui/form';
	import { Select } from '../ui/select';
	import { Switch } from '../ui/switch';

	interface Props {
		onerror?: (message: string | null) => void;
	}

	let { onerror }: Props = $props();

	type Agent = 'claude-code' | 'claude-desktop' | 'other';

	const COPIED_MS = 1500;

	let allowed = $state(false);
	let agent = $state<Agent>('claude-code');
	let helperPath = $state('');
	let copied = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;

	const agentItems = $derived([
		{ value: 'claude-code', label: $_('settings.agents.claudeCode') },
		{ value: 'claude-desktop', label: $_('settings.agents.claudeDesktop') },
		{ value: 'other', label: $_('settings.agents.other') }
	]);

	const snippet = $derived.by(() => {
		if (agent === 'claude-code') return `claude mcp add --scope user khi -- "${helperPath}"`;
		if (agent === 'claude-desktop') {
			return JSON.stringify({ mcpServers: { khi: { command: helperPath, args: [] } } }, null, 2);
		}
		return helperPath;
	});

	const help = $derived(
		agent === 'claude-code'
			? $_('settings.agents.helpClaudeCode')
			: agent === 'claude-desktop'
				? $_('settings.agents.helpClaudeDesktop')
				: $_('settings.agents.helpOther')
	);

	onMount(() => {
		commands
			.agentsAllowed()
			.then((on) => (allowed = on))
			.catch(() => onerror?.($_('settings.errors.save')));
		commands
			.mcpHelperPath()
			.then((path) => (helperPath = path))
			.catch(() => onerror?.($_('settings.errors.save')));
	});
	onDestroy(() => clearTimeout(copiedTimer));

	function setAllowed(next: boolean) {
		allowed = next;
		onerror?.(null);
		commands.setAgentsAllowed(next).catch(() => {
			allowed = !next;
			onerror?.($_('settings.errors.save'));
		});
	}

	async function copy() {
		if (!(await copyToClipboard(snippet))) return;
		copied = true;
		clearTimeout(copiedTimer);
		copiedTimer = setTimeout(() => (copied = false), COPIED_MS);
	}
</script>

<div data-slot="settings-pane-agents" class="flex flex-col gap-6">
	<FormGroup>
		<FormRow label={$_('settings.agents.allow')} help={$_('settings.agents.allowHint')}>
			{#snippet control({ labelId, helpId })}
				<Switch
					bind:checked={() => allowed, setAllowed}
					aria-labelledby={labelId}
					aria-describedby={helpId}
				/>
			{/snippet}
		</FormRow>
	</FormGroup>

	<div
		data-slot="agents-connect"
		class={['flex flex-col gap-2', !allowed && 'opacity-50']}
	>
		<FormGroup heading={$_('settings.agents.connect')}>
			<FormRow label={$_('settings.agents.agent')}>
				{#snippet control({ labelId })}
					<Select
						items={agentItems}
						bind:value={() => agent, (value) => (agent = value as Agent)}
						disabled={!allowed}
						aria-labelledby={labelId}
					/>
				{/snippet}
			</FormRow>
			<div
				data-slot="form-row"
				class="flex min-h-form-row items-center gap-4 border-t-(length:--stroke-border) border-border px-4 py-2"
			>
				<pre
					data-testid="agents-snippet"
					class="m-0 min-w-0 flex-1 rounded-control border-(length:--stroke-border) border-input-strong bg-background px-2 py-1.5 font-mono text-[11px] leading-[15px] break-words whitespace-pre-wrap text-foreground select-all">{snippet}</pre>
				<Button variant="secundario" disabled={!allowed} onclick={copy}>
					<Copy aria-hidden="true" class="size-4" />
					{copied ? $_('settings.agents.copied') : $_('settings.agents.copy')}
				</Button>
				<span class="sr-only" aria-live="polite">{copied ? $_('settings.agents.copied') : ''}</span>
			</div>
			<div
				data-slot="form-row"
				class="flex min-h-form-row items-center border-t-(length:--stroke-border) border-border px-4 py-2"
			>
				<p class="text-callout text-tertiary-foreground">{help}</p>
			</div>
		</FormGroup>
		<p class="px-4 text-callout text-tertiary-foreground">{$_('settings.agents.footer')}</p>
	</div>
</div>
