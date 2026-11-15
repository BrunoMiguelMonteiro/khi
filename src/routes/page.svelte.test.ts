import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(() => Promise.resolve(() => {})),
	emit: vi.fn()
}));
vi.mock('$lib/menu', () => ({ createApplicationMenu: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import Page from './+page.svelte';

const readers = [
	{ id: 1, name: 'Bruno', exportPath: null },
	{ id: 2, name: 'Ana', exportPath: null }
];

describe('+page', () => {
	it('shows an error when the chosen reader cannot be opened', async () => {
		// jsdom has no Web Animations; the notification fades in
		Element.prototype.animate ??= vi.fn(() => ({ cancel: vi.fn(), finished: Promise.resolve(), onfinish: null })) as never;
		vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
			if (cmd === 'list_readers') return Promise.resolve(readers);
			if (cmd === 'last_reader') return Promise.resolve(1);
			if (cmd === 'get_library') {
				const { readerId } = args as { readerId: number };
				return readerId === 1 ? Promise.resolve([]) : Promise.reject('database is locked');
			}
			return Promise.resolve(null);
		});
		render(Page);
		const picker = await screen.findByTestId('reader-picker');

		await fireEvent.change(picker, { target: { value: '2' } });

		expect(await screen.findByText('notifications.openReaderError')).toBeInTheDocument();
	});
});
