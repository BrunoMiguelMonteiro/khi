<script lang="ts">
	// Test fixture for segmented.test.ts: the highlights filter of a book, «Todos | Novos | Com notas»,
	// as the Library screen would build it, with value bound to the fixture's own state.
	import { _ } from '$lib/i18n';
	import { TooltipProvider } from '../tooltip';
	import { Segmented } from './index';

	let {
		value = $bindable<string | undefined>(undefined),
		counts = { all: 9, new: 2, withNotes: 3 },
		onbound
	}: {
		value?: string;
		counts?: { all: number; new: number; withNotes: number };
		onbound?: (value: string | undefined) => void;
	} = $props();

	$effect.pre(() => onbound?.(value));
</script>

<TooltipProvider>
	<Segmented
		bind:value
		label={$_('ui.segmented.label')}
		segments={[
			{ value: 'all', label: $_('ui.segmented.all'), count: counts.all },
			{
				value: 'new',
				label: $_('ui.segmented.new'),
				count: counts.new,
				emptyReason: $_('ui.segmented.noNew')
			},
			{
				value: 'withNotes',
				label: $_('ui.segmented.withNotes'),
				count: counts.withNotes,
				emptyReason: $_('ui.segmented.noNotes')
			}
		]}
	/>
</TooltipProvider>
