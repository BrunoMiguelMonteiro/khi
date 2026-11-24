import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { locale } from '$lib/i18n';
import { library } from '$lib/stores/library.svelte';
import AgentsPane from './AgentsPane.svelte';
import { rustKeeps, openStores, type Rust } from './test-support';

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

let rust: Rust;
const onerror = vi.fn();

const PATH = '/Applications/My Apps/Khi.app/Contents/MacOS/khi-mcp';
const CLAUDE_CODE = `claude mcp add --scope user khi -- "${PATH}"`;

async function show(setup: (rust: Rust) => void = () => {}) {
	rust = rustKeeps();
	setup(rust);
	await openStores(rust);
	const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
	render(AgentsPane, { onerror });
	// The switch and the path are read on mount
	await waitFor(() => expect(screen.getByTestId('agents-snippet')).toHaveTextContent(PATH));
	await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('data-state', rust.agents ? 'checked' : 'unchecked'));
	return user;
}

const allow = () => screen.getByRole('switch', { name: 'Allow agents' });
const snippet = () => screen.getByTestId('agents-snippet');
const copy = () => screen.getByRole('button', { name: /^Cop(y|ied)$/ });
const picker = () => screen.getByRole('combobox', { name: 'Agent' });

async function choose(user: ReturnType<typeof userEvent.setup>, agent: string) {
	picker().focus();
	await user.keyboard(' ');
	await screen.findByRole('listbox', { hidden: true });
	const option = screen.getAllByRole('option', { hidden: true }).find((o) => o.textContent?.trim() === agent)!;
	await user.click(option);
}

describe('AgentsPane', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers({ shouldAdvanceTime: true });
		locale.set('en');
		library.readers = [];
		library.activeReaderId = null;
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('has the switch group with no heading, then «Connect an agent»', async () => {
		await show();

		expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['Connect an agent']);
		expect(document.querySelectorAll('[data-slot="form-group"]')).toHaveLength(2);
		expect(
			screen.getByText(
				'The agent reads the highlights and notes of every Reader and sends them to the model it uses. Khi sends nothing.'
			)
		).toBeInTheDocument();
		expect(screen.getByText('If you move Khi to another folder, copy the command again.')).toBeInTheDocument();
	});

	describe('the switch', () => {
		it('is off when Rust says agents are not allowed', async () => {
			await show();

			expect(allow()).not.toBeChecked();
		});

		it('is on when Rust says they are', async () => {
			await show((r) => (r.agents = true));

			expect(allow()).toBeChecked();
		});

		it('writes with set_agents_allowed at the moment', async () => {
			const user = await show();

			await user.click(allow());

			await waitFor(() => expect(rust.calls.filter((c) => c.cmd === 'set_agents_allowed')).toEqual([{ cmd: 'set_agents_allowed', args: { allowed: true } }]));
			expect(allow()).toBeChecked();
			expect(rust.agents).toBe(true);
			expect(onerror).not.toHaveBeenCalledWith(expect.any(String));
		});

		it('goes back and says so when the write fails', async () => {
			const user = await show((r) => (r.agentsFail = 'disk full'));

			await user.click(allow());

			await waitFor(() => expect(onerror).toHaveBeenLastCalledWith('Error saving settings'));
			expect(allow()).not.toBeChecked();
			expect(rust.agents).toBe(false);
		});
	});

	describe('the agent', () => {
		it('starts on Claude Code, with the three choices', async () => {
			const user = await show((r) => (r.agents = true));

			expect(picker()).toHaveTextContent('Claude Code');
			picker().focus();
			await user.keyboard(' ');
			expect((await screen.findAllByRole('option', { hidden: true })).map((o) => o.textContent?.trim())).toEqual([
				'Claude Code',
				'Claude Desktop',
				'Other agents'
			]);
		});

		it('Claude Code: the command, quoted, and how to check it', async () => {
			await show((r) => (r.agents = true));

			expect(snippet()).toHaveTextContent(CLAUDE_CODE);
			expect(screen.getByText('Paste it in Terminal. Check with claude mcp list.')).toBeInTheDocument();
		});

		it('Claude Desktop: a JSON that parses back, and where to paste it', async () => {
			const user = await show((r) => (r.agents = true));

			await choose(user, 'Claude Desktop');

			expect(JSON.parse(snippet().textContent ?? '')).toEqual({ mcpServers: { khi: { command: PATH, args: [] } } });
			expect(snippet().textContent).toBe(JSON.stringify({ mcpServers: { khi: { command: PATH, args: [] } } }, null, 2));
			expect(screen.getByText('Paste it into claude_desktop_config.json and reopen Claude Desktop.')).toBeInTheDocument();
			expect(screen.queryByText(/Check with claude mcp list/)).toBeNull();
		});

		it('Other agents: the bare path, and no arguments', async () => {
			const user = await show((r) => (r.agents = true));

			await choose(user, 'Other agents');

			expect(snippet().textContent).toBe(PATH);
			expect(screen.getByText('Point the agent at this file, with no arguments.')).toBeInTheDocument();
		});
	});

	describe('Copy', () => {
		it('writes the snippet on show and says «Copied» for a moment', async () => {
			const user = await show((r) => (r.agents = true));

			await user.click(copy());

			await waitFor(async () => expect(await navigator.clipboard.readText()).toBe(CLAUDE_CODE));
			await waitFor(() => expect(copy()).toHaveTextContent('Copied'));
			expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('Copied');

			await vi.advanceTimersByTimeAsync(1600);
			await waitFor(() => expect(copy()).toHaveTextContent('Copy'));
			expect(copy()).not.toHaveTextContent('Copied');
		});

		it('writes the snippet of the agent chosen', async () => {
			const user = await show((r) => (r.agents = true));
			await choose(user, 'Other agents');

			await user.click(copy());

			await waitFor(async () => expect(await navigator.clipboard.readText()).toBe(PATH));
		});
	});

	describe('while the switch is off', () => {
		it('the pop-up and Copy are disabled, and the snippet is still shown', async () => {
			const user = await show();

			expect(picker()).toHaveAttribute('aria-disabled', 'true');
			expect(copy()).toHaveAttribute('aria-disabled', 'true');
			expect(snippet()).toHaveTextContent(CLAUDE_CODE);
			expect(document.querySelector('[data-slot="agents-connect"]')).toHaveClass('opacity-50');

			await user.click(copy());
			expect(await navigator.clipboard.readText()).toBe('');
			expect(copy()).toHaveTextContent('Copy');
			expect(copy()).not.toHaveTextContent('Copied');
		});

		it('turning the switch on wakes them', async () => {
			const user = await show();

			await user.click(allow());

			await waitFor(() => expect(picker()).not.toHaveAttribute('aria-disabled', 'true'));
			expect(copy()).not.toHaveAttribute('aria-disabled', 'true');
			expect(document.querySelector('[data-slot="agents-connect"]')).not.toHaveClass('opacity-50');
		});
	});
});
