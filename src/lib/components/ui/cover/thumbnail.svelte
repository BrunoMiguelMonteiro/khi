<script lang="ts" module>
	export type ThumbnailProps = {
		src?: string;
		bookId: number | string;
		class?: string;
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils';
	import { COVER_BG, coverTone } from './cover-tone';

	let { src, bookId, class: className }: ThumbnailProps = $props();
</script>

<!-- Componentes (D7) · 17 · Miniatura (63:3295): decorative, the row names the book. -->
<div
	aria-hidden="true"
	data-slot="thumbnail"
	class={cn(
		'relative h-9 w-6 shrink-0 rounded-thumb',
		!src && COVER_BG[coverTone(bookId)],
		className
	)}
>
	{#if src}
		<img
			{src}
			alt=""
			class="absolute inset-0 size-full overflow-hidden rounded-thumb object-cover"
		/>
	{/if}
	<span
		data-slot="cover-border"
		class="pointer-events-none absolute inset-0 rounded-thumb inset-ring inset-ring-cover-border"
	></span>
</div>
