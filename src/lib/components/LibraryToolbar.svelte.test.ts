import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LibraryToolbar from './LibraryToolbar.svelte';

function renderToolbar(canSync: boolean, onSync = vi.fn()) {
	render(LibraryToolbar, {
		selectedCount: 0,
		viewMode: 'grid',
		sortBy: 'title',
		canSync,
		onSync,
		onExportAll: vi.fn(),
		onExportSelected: vi.fn(),
		onClearSelection: vi.fn(),
		onSortChange: vi.fn(),
		onViewModeChange: vi.fn(),
		onOpenSettings: vi.fn()
	});
	return onSync;
}

describe('LibraryToolbar', () => {
	it("sync button disabled without the reader's kobo", () => {
		renderToolbar(false);

		expect(screen.getByRole('button', { name: /sync/i })).toBeDisabled();
	});

	it('sync button runs the sync when the kobo is connected', async () => {
		const onSync = renderToolbar(true);

		await fireEvent.click(screen.getByRole('button', { name: /sync/i }));

		expect(onSync).toHaveBeenCalledOnce();
	});
});
