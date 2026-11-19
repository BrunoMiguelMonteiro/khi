<script lang="ts">
	// Test fixture for library-header.test.ts: the consumer that removes the header, so its outro plays.
	import { LibraryHeader, type LibraryHeaderProps } from './index';

	let { ...props }: LibraryHeaderProps = $props();
	let shown = $state(true);
</script>

<button type="button" onclick={() => (shown = false)}>Hide</button>
{#if shown}
	<LibraryHeader {...props} />
{/if}
