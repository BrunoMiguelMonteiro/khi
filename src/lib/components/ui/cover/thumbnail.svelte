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

<!-- Componentes (D7) · 17 · Miniatura (63:3295), at the list's M2 size (32 × 48, radius 3, Task 41): decorative, the row names the book. -->
<div
	aria-hidden="true"
	data-slot="thumbnail"
	class={cn(
		'relative h-12 w-8 shrink-0 rounded-[3px]',
		!src && COVER_BG[coverTone(bookId)],
		className
	)}
>
	{#if src}
		<img
			{src}
			alt=""
			class="absolute inset-0 size-full overflow-hidden rounded-[3px] object-cover"
		/>
	{/if}
	<span
		data-slot="cover-border"
		class="pointer-events-none absolute inset-0 rounded-[3px] inset-ring inset-ring-cover-border"
	></span>
</div>
