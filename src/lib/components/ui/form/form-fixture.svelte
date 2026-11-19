<script lang="ts">
	// Test fixture for form.test.ts: a small Definições group, one row per control type that
	// exists so far (the Pop-up joins with Task 14). Each control takes the row's ids.
	import { Checkbox } from '../checkbox';
	import { Input } from '../input';
	import { Switch } from '../switch';
	import { FormGroup, FormRow } from './index';

	let { heading = 'Biblioteca' }: { heading?: string } = $props();

	let covers = $state(true);
	let folder = $state('Kobo');
	let series = $state(false);
</script>

<FormGroup {heading}>
	<FormRow label="Mostrar capas" help="Mostra a capa de cada livro na grelha.">
		{#snippet control({ labelId, helpId })}
			<Switch bind:checked={covers} aria-labelledby={labelId} aria-describedby={helpId} />
		{/snippet}
	</FormRow>
	<FormRow label="Pasta dos livros" divider>
		{#snippet control({ labelId, helpId })}
			<Input bind:value={folder} class="w-40" aria-labelledby={labelId} aria-describedby={helpId} />
		{/snippet}
	</FormRow>
	<FormRow label="Agrupar por série" help="Junta os volumes da mesma série." divider>
		{#snippet control({ labelId, helpId })}
			<Checkbox bind:checked={series} aria-labelledby={labelId} aria-describedby={helpId} />
		{/snippet}
	</FormRow>
</FormGroup>
