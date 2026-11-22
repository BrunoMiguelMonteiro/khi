<script lang="ts" module>
	import type { Snippet } from 'svelte';

	export type FormGroupProps = {
		heading?: string;
		class?: string;
		children: Snippet;
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils.js';

	let { heading, class: className, children }: FormGroupProps = $props();

	const uid = $props.id();
	const headingId = `form-group-${uid}-heading`;
</script>

<!--
	Componentes (D7) · 11 · Grupo de formulário (55:3553): an optional heading over a card of rows.
	The card has no visible border; its inside stroke is contrast-outline, transparent outside the
	contrast modes.
-->
<section
	data-slot="form-group"
	aria-labelledby={heading ? headingId : undefined}
	class={cn('flex flex-col gap-2', className)}
>
	{#if heading}
		<h2 id={headingId} data-slot="form-group-heading" class="px-4 text-body-semibold text-foreground">
			{heading}
		</h2>
	{/if}
	<div
		data-slot="form-group-card"
		class="flex flex-col rounded-group bg-card inset-ring inset-ring-contrast-outline"
	>
		{@render children()}
	</div>
</section>
