import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import AgentsPane from './AgentsPane.svelte';
import { rustKeeps, openStores } from './test-support';

// vitest-setup mocks $lib/i18n with English only; this file checks the real one in Portuguese.
vi.unmock('$lib/i18n');
const { locale } = await import('$lib/i18n');

describe('AgentsPane in Portuguese', () => {
	afterEach(() => locale.set('en'));

	it('speaks Portuguese, in the words of the Figma', async () => {
		const rust = rustKeeps();
		rust.agents = true;
		await openStores(rust);
		locale.set('pt');
		render(AgentsPane);

		const switchOn = await screen.findByRole('switch', { name: 'Permitir agentes' });
		await waitFor(() => expect(switchOn).toBeChecked());
		expect(
			screen.getByText('O agente lê os destaques e as notas de todos os Leitores e envia-os ao modelo que usa. O Khi não envia nada.')
		).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Ligar um agente' })).toBeInTheDocument();
		expect(screen.getByRole('combobox', { name: 'Agente' })).toHaveTextContent('Claude Code');
		expect(screen.getByText('Cole no Terminal. Confirme com claude mcp list.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
		expect(screen.getByText('Se mudar o Khi de pasta, copie o comando de novo.')).toBeInTheDocument();
	});
});
