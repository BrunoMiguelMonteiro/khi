<script lang="ts" module>
	import type { RadioGroup as RadioGroupPrimitive } from 'bits-ui';

	export type Segment = {
		value: string;
		label: string;
		count: number;
		/** Why a segment with nothing to show can't be chosen: a tooltip on pointer hover. */
		emptyReason?: string;
	};

	export type SegmentedProps = Omit<
		RadioGroupPrimitive.RootProps,
		'children' | 'child' | 'orientation' | 'loop' | 'aria-label'
	> & {
		/** The group's accessible name, e.g. «Mostrar». */
		label: string;
		segments: Segment[];
	};
</script>

<script lang="ts">
	import { RadioGroup as Primitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { withTrigger } from '../button';
	import { Tooltip } from '../tooltip';

	const uid = $props.id();

	let {
		ref = $bindable(null),
		value = $bindable(),
		label,
		segments,
		onValueChange,
		class: className,
		...restProps
	}: SegmentedProps = $props();

	// Todos (the first segment) when nothing is chosen yet.
	$effect.pre(() => {
		if (value === undefined && segments.length) value = segments[0].value;
	});

	const keepFocus = (e: MouseEvent) => e.preventDefault();
</script>

<!--
	Componentes (D7) · 9 · Segmentado (55:2588) of Segmento (55:2574). A Bits UI radio group: one
	Tab stop, arrows choose, clicking the chosen one keeps it. No hover: the chosen fill changes in
	duration/hover, without sliding. A segment with count 0 is Bits UI disabled, so neither arrows
	nor clicks choose it, and, like macOS, it is no Tab stop; native disabled is left off so the
	pointer still reaches its tooltip.
-->
<Primitive.Root
	bind:ref
	bind:value={
		() => value ?? segments[0]?.value,
		(v) => {
			value = v;
			onValueChange?.(v);
		}
	}
	{...restProps}
	orientation="horizontal"
	loop
	data-slot="segmented"
	aria-label={label}
	class={cn('inline-grid auto-cols-fr grid-flow-col bg-muted p-0.5 rounded-control', className)}
>
	{#each segments as segment (segment.value)}
		{@const id = `segmented-${uid}-${segment.value}`}
		{@const empty = segment.count === 0}
		<Tooltip text={segment.emptyReason ?? ''} disabled={!empty || !segment.emptyReason} {id}>
			{#snippet children({ props: trigger })}
				<Primitive.Item value={segment.value} disabled={empty} {id}>
					{#snippet child({ props, checked })}
						{@const merged = withTrigger(props, trigger)}
						<!-- The radio's own states come last: the tooltip trigger's data-state and data-disabled must not hide them. -->
						<button
							{...merged}
							data-slot="segment"
							class={checked
								? 'inline-flex h-segment min-w-24 items-center justify-center gap-1 px-2 rounded-segment outline-none focus-visible:focus-ring transition-[background-color] duration-(--duration-hover) ease-hover bg-segmented-selected shadow-sombra-segmento inset-ring inset-ring-contrast-outline-strong'
								: 'inline-flex h-segment min-w-24 items-center justify-center gap-1 px-2 rounded-segment outline-none focus-visible:focus-ring transition-[background-color] duration-(--duration-hover) ease-hover'}
							type="button"
							role="radio"
							aria-label={`${segment.label}, ${segment.count}`}
							data-state={props['data-state']}
							data-disabled={props['data-disabled']}
							disabled={undefined}
							aria-disabled={empty ? 'true' : undefined}
							onmousedown={empty ? keepFocus : undefined}
						>
							<span
								data-slot="segment-label"
								class={checked
									? 'text-callout-medium text-foreground'
									: empty
										? 'text-callout text-disabled-foreground'
										: 'text-callout text-foreground'}>{segment.label}</span
							>
							<span
								data-slot="segment-count"
								class={checked
									? 'text-callout tabular-nums text-segmented-selected-count'
									: empty
										? 'text-callout tabular-nums text-disabled-foreground'
										: 'text-callout tabular-nums text-tertiary-foreground'}>{segment.count}</span
							>
						</button>
					{/snippet}
				</Primitive.Item>
			{/snippet}
		</Tooltip>
	{/each}
</Primitive.Root>
