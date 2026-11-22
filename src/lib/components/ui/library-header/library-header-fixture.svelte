<script lang="ts">
	// Test fixture for library-header.test.ts: the consumer that owns `exporting` and `exported`,
	// as the Library screen would; the export takes 500 ms.
	import { LibraryHeader, type LibraryHeaderProps } from './index';

	let {
		onExport,
		...props
	}: Omit<LibraryHeaderProps, 'exporting' | 'exported'> = $props();

	let exporting = $state(false);
	let exported = $state(false);

	function exportNow() {
		onExport?.();
		exported = false;
		exporting = true;
		setTimeout(() => {
			exporting = false;
			exported = true;
		}, 500);
	}
</script>

<LibraryHeader {...props} onExport={exportNow} {exporting} {exported} />
