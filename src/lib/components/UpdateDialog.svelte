<!--
  UpdateDialog: the update flow (Q-U · U3 and states 2–7), on the Janela modal (ui/dialog).
  One window from the first phase to the last (Q1): it opens and closes with Movimento 4, and between
  phases only its content changes, with no animation, and its width: 480 in the U3 (Figma 78:20401),
  380 in the others (78:23921…80:26508). Renders nothing while the updater is idle or waiting to restart.
-->
<script lang="ts">
	import type { Update } from '@tauri-apps/plugin-updater';
	import { _, locale } from '$lib/i18n';
	import { versionCountWord } from '$lib/version-count';
	import { updater, releasesSince, type UpdaterState } from '../stores/updater.svelte';
	import { Button } from './ui/button';
	import * as Dialog from './ui/dialog';
	import { Progress } from './ui/progress';

	interface Props {
		/** Whether an export or Sync is running: then the restart waits. */
		isBusy: () => boolean;
	}

	let { isBusy }: Props = $props();

	const visible = $derived(updater.state !== 'idle' && updater.state !== 'restartPending');

	// The window exists, and takes its Bits UI ids, only from the first phase until it has finished closing:
	// the page lives for hours and the update flow runs once a day at most
	let mounted = $state(false);
	$effect.pre(() => {
		if (visible) mounted = true;
	});

	// The window fades out after the updater has gone idle, which also empties it: it keeps showing the
	// phase it had, so the U3 does not shrink to 380 and show nothing while it closes
	let last = $state.raw<{ phase: UpdaterState; update: Update | null }>({ phase: 'checking', update: null });
	$effect.pre(() => {
		if (visible) last = { phase: updater.state, update: updater.update };
	});
	const phase = $derived(visible ? updater.state : last.phase);
	const update = $derived(visible ? updater.update : last.update);

	const lang = $derived($locale ?? 'en');
	const releases = $derived(update ? releasesSince(update.rawJson, update.currentVersion, lang) : []);
	const count = $derived(Math.max(releases.length, 1));
	// In English the number opens its sentence
	const number = $derived(versionCountWord(count, lang, { sentenceStart: lang === 'en' }));

	function formatDate(iso: string): string {
		const date = new Date(`${iso}T00:00:00`);
		if (isNaN(date.getTime())) return iso;
		return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
	}

	function formatMegabytes(bytes: number): string {
		return `${new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(bytes / 1_000_000)} MB`;
	}

	const percent = $derived(
		updater.progress.total ? Math.min(100, (updater.progress.done / updater.progress.total) * 100) : null
	);

	/** Esc, ⌘., Cancel and Later: «Installed» is answered as OK, and while it installs nothing closes. */
	function cancel() {
		if (phase === 'installing') return;
		if (phase === 'installed') updater.dismissInstalled();
		else updater.close();
	}
</script>

{#if mounted}
<Dialog.Root
	bind:open={() => visible, (isOpen) => !isOpen && cancel()}
	onOpenChangeComplete={(isOpen) => {
		if (!isOpen && !visible) mounted = false;
	}}
>
	<!-- As in macOS no button takes focus on opening (Q-E): Bits' focus scope puts it on the window itself, and
	     takes it back there when a phase removes the focused button (tested) -->
	<Dialog.Content
		data-testid="update-dialog"
		class={phase === 'available' ? 'w-120' : undefined}
		interactOutsideBehavior="ignore"
		onEscapeKeydown={(event) => phase === 'installing' && event.preventDefault()}
	>
		{#if phase === 'available' && update}
			<Dialog.Title id="update-title">{$_('updates.available.title', { version: update.version })}</Dialog.Title>
			<Dialog.Description>
				{$_('updates.available.body', { current: update.currentVersion, count, number })}
			</Dialog.Description>

			{#if releases.length > 0}
				<!-- Scrollable regions must be focusable so keyboard users can scroll them (axe: scrollable-region-focusable). -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div
					class="flex h-58 flex-col gap-4 overflow-y-auto rounded-group bg-muted p-4 outline-none focus-visible:focus-ring"
					data-testid="release-notes"
					role="region"
					aria-label={$_("updates.available.notesLabel")}
					tabindex="0"
				>
					{#each releases as release (release.version)}
						<section class="flex flex-col gap-2">
							<h3 class="m-0 flex items-baseline gap-2">
								<span class="text-body-semibold text-foreground">Khi {release.version}</span>
								{#if release.date}
									<span class="text-callout text-muted-foreground">{formatDate(release.date)}</span>
								{/if}
							</h3>
							{#each [{ title: $_('updates.available.whatsNew'), items: release.whatsNew }, { title: $_('updates.available.bugFixes'), items: release.bugFixes }] as group (group.title)}
								{#if group.items.length > 0}
									<div class="flex flex-col gap-1">
										<h4 class="m-0 text-subheadline-semibold text-muted-foreground">{group.title}</h4>
										<ul class="m-0 flex list-outside list-disc flex-col gap-1 pl-5 text-body text-foreground">
											{#each group.items as item}<li>{item}</li>{/each}
										</ul>
									</div>
								{/if}
							{/each}
						</section>
					{/each}
				</div>
			{/if}

			<Dialog.Footer class="justify-between">
				<Button variant="ligacao" onclick={() => updater.skip()}>{$_('updates.available.skip')}</Button>
				<div class="flex gap-2">
					<Dialog.Close>{$_('updates.available.later')}</Dialog.Close>
					<Dialog.Action onclick={() => updater.install(isBusy)}>{$_('updates.available.install')}</Dialog.Action>
				</div>
			</Dialog.Footer>
		{:else if phase === 'checking'}
			<Dialog.Title id="update-title">{$_('updates.checking.title')}</Dialog.Title>
			<Progress value={null} class="mt-3" aria-labelledby="update-title" />
			<Dialog.Footer>
				<Dialog.Close>{$_('updates.checking.cancel')}</Dialog.Close>
			</Dialog.Footer>
		{:else if phase === 'upToDate'}
			<Dialog.Title id="update-title">{$_('updates.upToDate.title')}</Dialog.Title>
			<Dialog.Description>{$_('updates.upToDate.body', { version: updater.currentVersion })}</Dialog.Description>
			<Dialog.Footer>
				<Dialog.Action onclick={() => updater.close()}>{$_('updates.upToDate.ok')}</Dialog.Action>
			</Dialog.Footer>
		{:else if (phase === 'downloading' || phase === 'installing') && update}
			<Dialog.Title id="update-title">{$_('updates.downloading.title', { version: update.version })}</Dialog.Title>
			<Progress value={percent} class="mt-3" aria-labelledby="update-title" />
			<p class="m-0 text-callout text-muted-foreground tabular-nums">
				{#if phase === 'installing'}
					{$_('updates.downloading.installing')}
				{:else if updater.progress.total}
					{$_('updates.downloading.progress', {
						done: formatMegabytes(updater.progress.done),
						total: formatMegabytes(updater.progress.total)
					})}
				{:else}
					{formatMegabytes(updater.progress.done)}
				{/if}
			</p>
			<Dialog.Footer>
				<Dialog.Close disabled={phase === 'installing'}>{$_('updates.downloading.cancel')}</Dialog.Close>
			</Dialog.Footer>
		{:else if phase === 'installed' && update}
			<Dialog.Title id="update-title">{$_('updates.installed.title', { version: update.version })}</Dialog.Title>
			<Dialog.Description>{$_('updates.installed.body')}</Dialog.Description>
			<Dialog.Footer>
				<Button variant="secundario" onclick={() => updater.restartNow()}>{$_('updates.installed.restartNow')}</Button>
				<Dialog.Action onclick={() => updater.dismissInstalled()}>{$_('updates.installed.ok')}</Dialog.Action>
			</Dialog.Footer>
		{:else if phase === 'error'}
			<Dialog.Title id="update-title">
				{updater.errorKind === 'install' ? $_('updates.installError.title') : $_('updates.error.title')}
			</Dialog.Title>
			<Dialog.Description>
				{updater.errorKind === 'install' && update
					? $_('updates.installError.body', { version: update.version })
					: $_('updates.error.body')}
			</Dialog.Description>
			<Dialog.Footer>
				<Dialog.Close>{$_('updates.error.cancel')}</Dialog.Close>
				<Dialog.Action onclick={() => updater.retry()}>{$_('updates.error.retry')}</Dialog.Action>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
{/if}
