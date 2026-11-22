<script lang="ts">
	// Test fixture for dropdown-menu.test.ts: a menu as a screen builds it, with a checked item, a
	// shortcut, a separator and a disabled item.
	import * as DropdownMenu from './index';

	let {
		open = $bindable(false),
		onexport,
		onremove,
		contentClass
	}: {
		open?: boolean;
		onexport?: () => void;
		onremove?: () => void;
		contentClass?: string;
	} = $props();

	let grouped = $state(true);
</script>

<DropdownMenu.Root bind:open>
	<DropdownMenu.Trigger>Ações</DropdownMenu.Trigger>
	<DropdownMenu.Content class={contentClass}>
		<DropdownMenu.Item shortcut="⌘E" onSelect={onexport}>Exportar…</DropdownMenu.Item>
		<DropdownMenu.Item bind:checked={grouped}>Agrupar por série</DropdownMenu.Item>
		<DropdownMenu.Separator />
		<DropdownMenu.Item shortcut="⌫" disabled onSelect={onremove}>Remover</DropdownMenu.Item>
		<DropdownMenu.Item>Mostrar no Finder</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
