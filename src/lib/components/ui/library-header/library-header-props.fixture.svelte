<script lang="ts">
	// Test-only: props change one at a time, as from a real parent
	// (testing-library's rerender replaces the whole props object).
	import { LibraryHeader } from './index';
	import type { LibraryHeaderState } from './index';

	let { state: headerState }: { state: LibraryHeaderState } = $props();
	let exporting = $state(false);
	let exported = $state(true);

	export function setExport(next: { exporting?: boolean; exported?: boolean }) {
		if (next.exporting !== undefined) exporting = next.exporting;
		if (next.exported !== undefined) exported = next.exported;
	}
</script>

<LibraryHeader state={headerState} {exporting} {exported} />
