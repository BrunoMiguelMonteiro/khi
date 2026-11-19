<script lang="ts">
	// Test fixture for form.test.ts: a small Definições group, one row per control type that
	// exists so far. Each control takes the row's ids.
	import { Checkbox } from '../checkbox';
	import { Input } from '../input';
	import { Select } from '../select';
	import { Switch } from '../switch';
	import { FormGroup, FormRow } from './index';

	let { heading = 'Biblioteca' }: { heading?: string } = $props();

	let covers = $state(true);
	let folder = $state('Kobo');
	let series = $state(false);
	let format = $state('md');

	const formats = [
		{ value: 'md', label: 'Markdown' },
		{ value: 'txt', label: 'Texto simples' }
	];
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
	<FormRow label="Formato" help="O formato dos ficheiros exportados." divider>
		{#snippet control({ labelId, helpId })}
			<Select bind:value={format} items={formats} aria-labelledby={labelId} aria-describedby={helpId} />
		{/snippet}
	</FormRow>
</FormGroup>
