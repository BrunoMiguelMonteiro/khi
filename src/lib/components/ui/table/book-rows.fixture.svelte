<script lang="ts">
	// Test fixture for table.test.ts: a few rows in one body, as the list screen renders them.
	import { Body, BookRow, type BookRowBook } from './index';

	let { books, selectedId }: { books: BookRowBook[]; selectedId?: number | string } = $props();
</script>

<table>
	<Body>
		{#each books as book (book.id)}
			<BookRow {book} selected={book.id === selectedId} />
		{/each}
	</Body>
</table>
