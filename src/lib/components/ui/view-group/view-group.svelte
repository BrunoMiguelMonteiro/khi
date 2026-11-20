<script lang="ts" module>
	import type { RadioGroup as RadioGroupPrimitive } from 'bits-ui';

	export type ViewMode = 'grid' | 'list';

	export type ViewGroupProps = Omit<
		RadioGroupPrimitive.RootProps,
		'children' | 'child' | 'value' | 'onValueChange' | 'orientation' | 'loop' | 'type'
	> & {
		value?: ViewMode;
		onValueChange?: (value: ViewMode) => void;
		/** Greyed and out of reach (no Reader open): the buttons are natively disabled, so they leave the Tab order. */
		disabled?: boolean;
		/** The group's accessible name; «Vista» when omitted. */
		'aria-label'?: string;
	};
</script>

<script lang="ts">
	import { RadioGroup as Primitive } from 'bits-ui';
	import LayoutGrid from 'lucide-svelte/icons/layout-grid';
	import List from 'lucide-svelte/icons/list';
	import { _ } from '$lib/i18n';
	import { cn } from '$lib/utils.js';
	import { buttonVariants, withTrigger } from '../button';
	import { Icon, type LucideIcon } from '../icon';
	import { toolbarButtonVariants } from '../toolbar-button';
	import { Tooltip } from '../tooltip';

	const uid = $props.id();

	let {
		ref = $bindable(null),
		value = $bindable<ViewMode>('grid'),
		onValueChange,
		disabled = false,
		'aria-label': ariaLabel,
		class: className,
		...restProps
	}: ViewGroupProps = $props();

	const items: { value: ViewMode; icon: LucideIcon; label: string; tooltip: string; shortcut: string }[] =
		$derived([
			{ value: 'grid', icon: LayoutGrid, label: $_('ui.viewGroup.grid'), tooltip: $_('ui.viewGroup.gridTooltip'), shortcut: '⌘1' },
			{ value: 'list', icon: List, label: $_('ui.viewGroup.list'), tooltip: $_('ui.viewGroup.listTooltip'), shortcut: '⌘2' }
		]);
</script>

<!--
	Componentes (D7) · 8 · Grupo de vista (55:2440): two Botão de toolbar (55:1346), gap spacing/1.
	A Bits UI radio group: one Tab stop, arrows select, clicking the selected one keeps it. The
	selected button is the toolbar button's Selecionado, the other its Normal, with its hover and
	press. Nothing slides between them: the change is the buttons' own fill.
-->
<Primitive.Root
	bind:ref
	bind:value={
		() => value,
		(v) => {
			value = v as ViewMode;
			onValueChange?.(value);
		}
	}
	{...restProps}
	{disabled}
	orientation="horizontal"
	loop
	data-slot="view-group"
	aria-label={ariaLabel ?? $_('ui.viewGroup.label')}
	class={cn('inline-flex items-center gap-1', className)}
>
	{#each items as item (item.value)}
		{@const id = `view-group-${uid}-${item.value}`}
		<Tooltip text={item.tooltip} shortcut={item.shortcut} {id}>
			{#snippet children({ props: trigger })}
				<Primitive.Item value={item.value} {id}>
					{#snippet child({ props, checked })}
						{@const merged = withTrigger(props, trigger)}
						<!-- The radio's own type, name and state come last: the tooltip trigger's data-state must not hide it. -->
						<button
							{...merged}
							data-slot="view-group-item"
							class={cn(
								buttonVariants({ shape: 'toolbar' }),
								toolbarButtonVariants({ pressed: checked && !disabled })
							)}
							type="button"
							role="radio"
							aria-label={item.label}
							data-state={props['data-state']}
							data-disabled={disabled ? '' : undefined}
						>
							<Icon icon={item.icon} size="md" />
						</button>
					{/snippet}
				</Primitive.Item>
			{/snippet}
		</Tooltip>
	{/each}
</Primitive.Root>
