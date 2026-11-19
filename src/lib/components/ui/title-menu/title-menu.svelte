<script lang="ts" module>
	/** What the title needs of a reader, so it takes no Tauri types. */
	export type TitleMenuReader = { id: number | string; name: string };

	export type TitleMenuProps = {
		readers: TitleMenuReader[];
		activeReaderId: number | string | null | undefined;
		onselect?: (id: number | string) => void;
		class?: string;
	};
</script>

<script lang="ts">
	import ChevronDown from 'lucide-svelte/icons/chevron-down';
	import { _ } from '$lib/i18n';
	import { cn } from '$lib/utils';
	import * as DropdownMenu from '../dropdown-menu';
	import { Icon } from '../icon';

	let { readers, activeReaderId, onselect, class: className }: TitleMenuProps = $props();

	const active = $derived(readers.find((reader) => reader.id === activeReaderId));
</script>

<!--
	Componentes (D7) · 22 · Título-menu (68:6124). With one reader the title is plain text; with
	several it is a menu button, and the menu (200 wide, 4 px below) lists only the readers.
-->
{#if readers.length > 1}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			data-slot="title-menu-trigger"
			class={cn(
				'inline-flex h-toolbar-button items-center gap-1 rounded-control px-2 text-title-3 text-foreground',
				'outline-none select-none focus-visible:focus-ring',
				'transition-[background-color] duration-(--duration-hover) ease-hover',
				'hover:bg-accent active:bg-accent-pressed active:transition-none data-open:bg-accent-pressed',
				className
			)}
		>
			{active ? $_('screens.library.titleOf', { reader: active.name }) : $_('screens.library.title')}
			<Icon icon={ChevronDown} size="md" class="text-muted-foreground" />
		</DropdownMenu.Trigger>
		<DropdownMenu.Content sideOffset={4} align="start">
			{#each readers as reader (reader.id)}
				<DropdownMenu.Item
					bind:checked={() => reader.id === activeReaderId, () => {}}
					onSelect={() => onselect?.(reader.id)}
				>
					{reader.name}
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{:else}
	<h1 data-slot="title-menu-title" class={cn('text-title-3 text-foreground', className)}>
		{$_('screens.library.title')}
	</h1>
{/if}
