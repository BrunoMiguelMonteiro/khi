<!--
  UpdateDialog: the update flow (Q-U · U3 and states 2–6).
  Renders nothing while the updater is idle or waiting to restart.
-->
<script lang="ts">
	import { _, locale } from '$lib/i18n';
	import Button from './Button.svelte';
	import { updater, releasesSince } from '../stores/updater.svelte';

	interface Props {
		/** Whether an export or Sync is running: then the restart waits. */
		isBusy: () => boolean;
	}

	let { isBusy }: Props = $props();

	const phase = $derived(updater.state);
	const update = $derived(updater.update);
	const lang = $derived($locale ?? 'en');
	const releases = $derived(update ? releasesSince(update.rawJson, update.currentVersion, lang) : []);
	const visible = $derived(phase !== 'idle' && phase !== 'restartPending');

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

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		// Settings may be open underneath: Escape closes only this dialog
		event.stopPropagation();
		if (phase === 'checking' || phase === 'upToDate' || phase === 'available' || phase === 'error' || phase === 'downloading') {
			updater.close();
		} else if (phase === 'installed') {
			updater.dismissInstalled();
		}
	}

	/** Moves focus to the default button inside `node`. */
	function autofocus(node: HTMLElement) {
		node.querySelector('button')?.focus();
	}
</script>

<svelte:window onkeydowncapture={visible ? handleKeydown : undefined} />

{#if visible}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="update-title"
		aria-describedby={phase === 'checking' ? undefined : 'update-body'}
		data-testid="update-dialog"
	>
		{#if phase === 'available' && update}
			<div class="w-full max-w-lg rounded-xl bg-white dark:bg-neutral-900 p-6 shadow-xl flex flex-col gap-4">
				<div class="flex flex-col gap-2">
					<h2 id="update-title" class="m-0 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
						{$_('updates.available.title', { version: update.version })}
					</h2>
					<p id="update-body" class="m-0 text-sm text-neutral-700 dark:text-neutral-300">
						{$_('updates.available.body', { current: update.currentVersion, count: Math.max(releases.length, 1) })}
					</p>
				</div>

				{#if releases.length > 0}
					<!-- Scrollable regions must be focusable so keyboard users can scroll them (axe: scrollable-region-focusable). -->
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div
						class="max-h-72 overflow-y-auto rounded-lg bg-neutral-100 dark:bg-neutral-800 px-5 py-4 flex flex-col gap-5"
						data-testid="release-notes"
						role="region"
						aria-labelledby="update-title"
						tabindex="0"
					>
						{#each releases as release (release.version)}
							<section class="flex flex-col gap-3">
								<h3 class="m-0 flex items-baseline gap-2 text-sm">
									<span class="font-semibold text-neutral-900 dark:text-neutral-100">Khi {release.version}</span>
									{#if release.date}
										<span class="font-normal text-neutral-500 dark:text-neutral-400">{formatDate(release.date)}</span>
									{/if}
								</h3>
								{#if release.whatsNew.length > 0}
									<div class="flex flex-col gap-1">
										<h4 class="m-0 text-xs font-semibold text-neutral-600 dark:text-neutral-400">{$_('updates.available.whatsNew')}</h4>
										<ul class="m-0 pl-5 list-disc text-sm text-neutral-800 dark:text-neutral-200 flex flex-col gap-1">
											{#each release.whatsNew as item}<li>{item}</li>{/each}
										</ul>
									</div>
								{/if}
								{#if release.bugFixes.length > 0}
									<div class="flex flex-col gap-1">
										<h4 class="m-0 text-xs font-semibold text-neutral-600 dark:text-neutral-400">{$_('updates.available.bugFixes')}</h4>
										<ul class="m-0 pl-5 list-disc text-sm text-neutral-800 dark:text-neutral-200 flex flex-col gap-1">
											{#each release.bugFixes as item}<li>{item}</li>{/each}
										</ul>
									</div>
								{/if}
							</section>
						{/each}
					</div>
				{/if}

				<div class="flex items-center justify-between gap-3 pt-2">
					<Button variant="ghost" onclick={() => updater.skip()}>{$_('updates.available.skip')}</Button>
					<div class="flex gap-3">
						<Button variant="secondary" onclick={() => updater.close()}>{$_('updates.available.later')}</Button>
						<span use:autofocus class="contents">
							<Button onclick={() => updater.install(isBusy)}>{$_('updates.available.install')}</Button>
						</span>
					</div>
				</div>
			</div>
		{:else}
			<div class="w-full max-w-sm rounded-xl bg-white dark:bg-neutral-900 p-5 shadow-xl flex flex-col gap-4">
				{#if phase === 'checking'}
					<h2 id="update-title" class="m-0 text-base font-semibold text-neutral-900 dark:text-neutral-100">
						{$_('updates.checking.title')}
					</h2>
					<div class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700" role="progressbar" aria-labelledby="update-title">
						<div class="h-full w-1/3 rounded-full bg-blue-600 animate-pulse"></div>
					</div>
					<div class="flex justify-end">
						<Button variant="secondary" onclick={() => updater.close()}>{$_('updates.checking.cancel')}</Button>
					</div>
				{:else if phase === 'upToDate'}
					<div class="flex flex-col gap-1">
						<h2 id="update-title" class="m-0 text-base font-semibold text-neutral-900 dark:text-neutral-100">
							{$_('updates.upToDate.title')}
						</h2>
						<p id="update-body" class="m-0 text-sm text-neutral-700 dark:text-neutral-300">
							{$_('updates.upToDate.body', { version: updater.currentVersion })}
						</p>
					</div>
					<div class="flex justify-end">
						<span use:autofocus class="contents">
							<Button onclick={() => updater.close()}>{$_('updates.upToDate.ok')}</Button>
						</span>
					</div>
				{:else if (phase === 'downloading' || phase === 'installing') && update}
					<h2 id="update-title" class="m-0 text-base font-semibold text-neutral-900 dark:text-neutral-100">
						{$_('updates.downloading.title', { version: update.version })}
					</h2>
					<div class="flex flex-col gap-1">
						<div
							class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"
							role="progressbar"
							aria-labelledby="update-title"
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={percent !== null ? Math.round(percent) : undefined}
						>
							<div
								class="h-full rounded-full bg-blue-600 transition-[width] duration-200 {percent === null ? 'w-1/3 animate-pulse' : ''}"
								style={percent !== null ? `width: ${percent}%` : undefined}
							></div>
						</div>
						<p id="update-body" class="m-0 text-xs text-neutral-600 dark:text-neutral-400 tabular-nums">
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
					</div>
					<div class="flex justify-end">
						<Button variant="secondary" disabled={phase === 'installing'} onclick={() => updater.close()}>
							{$_('updates.downloading.cancel')}
						</Button>
					</div>
				{:else if phase === 'installed' && update}
					<div class="flex flex-col gap-1">
						<h2 id="update-title" class="m-0 text-base font-semibold text-neutral-900 dark:text-neutral-100">
							{$_('updates.installed.title', { version: update.version })}
						</h2>
						<p id="update-body" class="m-0 text-sm text-neutral-700 dark:text-neutral-300">
							{$_('updates.installed.body')}
						</p>
					</div>
					<div class="flex justify-end gap-3">
						<Button variant="secondary" onclick={() => updater.restartNow()}>{$_('updates.installed.restartNow')}</Button>
						<span use:autofocus class="contents">
							<Button onclick={() => updater.dismissInstalled()}>{$_('updates.installed.ok')}</Button>
						</span>
					</div>
				{:else if phase === 'error'}
					<div class="flex flex-col gap-1">
						<h2 id="update-title" class="m-0 text-base font-semibold text-neutral-900 dark:text-neutral-100">
							{$_('updates.error.title')}
						</h2>
						<p id="update-body" class="m-0 text-sm text-neutral-700 dark:text-neutral-300">
							{$_('updates.error.body')}
						</p>
					</div>
					<div class="flex justify-end gap-3">
						<Button variant="secondary" onclick={() => updater.close()}>{$_('updates.error.cancel')}</Button>
						<span use:autofocus class="contents">
							<Button onclick={() => updater.retry()}>{$_('updates.error.retry')}</Button>
						</span>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
