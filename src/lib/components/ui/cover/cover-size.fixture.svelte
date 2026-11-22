<script lang="ts">
	// Test fixture: only `size` changes, so a re-measure cannot come from another prop.
	import Cover from './cover.svelte';
	let size = $state<'md' | 'sm'>('md');
</script>

<button onclick={() => (size = 'sm')}>small</button>
<Cover title="O Retorno" bookId={1} {size} />
