<script lang="ts">
	// Test only: the page gives the view its TooltipProvider, as the Segmented's tooltips need.
	import type { Book } from '$lib/types';
	import BookDetailsView from './BookDetailsView.svelte';
	import { TooltipProvider } from './ui/tooltip';

	let { book }: { book: Book } = $props();
</script>

<TooltipProvider>
	<BookDetailsView {book} />
</TooltipProvider>
