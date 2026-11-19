<script lang="ts" module>
	import type { Snippet } from 'svelte';

	export type FormRowControlIds = { labelId: string; helpId?: string };

	export type FormRowProps = {
		label: string;
		help?: string;
		/** A top rule, for every row after the first. */
		divider?: boolean;
		class?: string;
		/** The control, which puts aria-labelledby={labelId} and aria-describedby={helpId} on itself. */
		control: Snippet<[FormRowControlIds]>;
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { Label } from '../label';

	let { label, help, divider = false, class: className, control }: FormRowProps = $props();

	const uid = $props.id();
	const labelId = `form-row-${uid}-label`;
	const helpId = `form-row-${uid}-help`;
</script>

<!--
	Componentes (D7) · 11 · Linha de formulário (55:3552): the label column on the left, the control
	on the right. Divisória=Sim is a 1 px inside top stroke, so it is a top border only.
-->
<div
	data-slot="form-row"
	class={cn(
		'flex min-h-form-row items-center gap-4 px-4 py-2',
		divider && 'border-t-(length:--stroke-border) border-border',
		className
	)}
>
	<div data-slot="form-row-labels" class="flex min-w-0 flex-1 flex-col gap-1">
		<Label id={labelId} data-slot="form-row-label">{label}</Label>
		{#if help}
			<p id={helpId} data-slot="form-row-help" class="text-callout text-tertiary-foreground">{help}</p>
		{/if}
	</div>
	{@render control({ labelId, helpId: help ? helpId : undefined })}
</div>
