/**
 * Tests for SettingsPanel Component
 *
 * TDD approach: Test the component rendering and interactions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import SettingsPanel from './SettingsPanel.svelte';

// Mock the settings store
vi.mock('../stores/settings.svelte', () => ({
	settings: {
		exportConfig: {
			exportPath: '~/Documents/Kobo Highlights',
			metadata: {
				author: true,
				isbn: true,
				publisher: true,
				dateLastRead: true,
				language: true,
				description: false
			},
			dateFormat: 'dd_month_yyyy'
		},
		uiPreferences: {
			theme: 'system',
			windowWidth: 1200,
			windowHeight: 800,
			isMaximized: false,
			showOnboarding: true,
			libraryViewMode: 'grid',
			librarySort: 'title',
			syncOnConnect: true
		},
		language: 'en',
		isLoading: false,
		setLanguage: vi.fn(),
		setExportPath: vi.fn(),
		setMetadataOption: vi.fn(),
		setDateFormat: vi.fn(),
		setTheme: vi.fn(),
		setViewMode: vi.fn(),
		setSortPreference: vi.fn(),
		setSyncOnConnect: vi.fn(),
		save: vi.fn(),
		resetAndSave: vi.fn()
	},
	getSortLabel: vi.fn((sort) => {
		const labels: Record<string, string> = {
			title: 'Title',
			author: 'Author',
			date_last_read: 'Last Read',
			highlight_count: 'Highlight Count'
		};
		return labels[sort] || sort;
	}),
	getViewModeLabel: vi.fn((mode) => {
		const labels: Record<string, string> = {
			grid: 'Grid',
			list: 'List'
		};
		return labels[mode] || mode;
	}),
	getThemeLabel: vi.fn((theme) => {
		const labels: Record<string, string> = {
			system: 'System',
			light: 'Light',
			dark: 'Dark'
		};
		return labels[theme] || theme;
	}),
	getDateFormatLabel: vi.fn((format) => {
		const labels: Record<string, string> = {
			dd_mm_yyyy: 'DD/MM/YYYY (24/01/2025)',
			dd_month_yyyy: '24 January 2025',
			iso8601: 'ISO 8601 (2025-01-24)'
		};
		return labels[format] || format;
	})
}));

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(() => Promise.resolve(null)),
	convertFileSrc: vi.fn((src: string) => src)
}));

import { settings } from '../stores/settings.svelte';
import { library } from '../stores/library.svelte';
import { invoke } from '@tauri-apps/api/core';

describe('SettingsPanel', () => {
	const mockOnClose = vi.fn();
	const mockOnSave = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		// list_readers answers with the readers on screen, never null
		vi.mocked(invoke).mockImplementation((cmd: string) =>
			Promise.resolve(cmd === 'list_readers' ? library.readers : null)
		);
		library.readers = [];
		library.activeReaderId = null;
	});

	it('renames the active reader and offers no delete', async () => {
		library.readers = [{ id: 3, name: 'Bruno', exportPath: null }];
		library.activeReaderId = 3;
		render(SettingsPanel, { onClose: mockOnClose });

		const input = screen.getByTestId('reader-name') as HTMLInputElement;
		expect(input.value).toBe('Bruno');
		await fireEvent.input(input, { target: { value: 'Bruno M.' } });
		await fireEvent.change(input);

		expect(invoke).toHaveBeenCalledWith('rename_reader', { id: 3, name: 'Bruno M.' });
		expect(screen.queryByText(/delete reader/i)).toBeNull();
	});

	it('a failed rename shows a translated message, not the raw error', async () => {
		library.readers = [{ id: 3, name: 'Bruno', exportPath: null }];
		library.activeReaderId = 3;
		vi.mocked(invoke).mockImplementation((cmd: string) =>
			cmd === 'rename_reader' ? Promise.reject('Library database error: disk I/O error') : Promise.resolve(null)
		);
		render(SettingsPanel, { onClose: mockOnClose });

		const input = screen.getByTestId('reader-name') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: 'Bruno M.' } });
		await fireEvent.change(input);

		expect(await screen.findByText('Couldn’t rename the reader')).toBeInTheDocument();
		expect(screen.queryByText(/disk I\/O error/)).toBeNull();
	});

	it('with a reader open, one folder field shows where that reader exports', () => {
		library.readers = [{ id: 3, name: 'Bruno', exportPath: null }];
		library.activeReaderId = 3;
		render(SettingsPanel, { onClose: mockOnClose });

		expect(screen.getAllByLabelText(/path/i)).toHaveLength(1);
		expect(screen.getByLabelText(/path/i)).toHaveValue('~/Documents/Kobo Highlights/Bruno');
	});

	it('shows the reader custom folder when it has one', () => {
		library.readers = [{ id: 3, name: 'Bruno', exportPath: '/x/Bruno' }];
		library.activeReaderId = 3;
		render(SettingsPanel, { onClose: mockOnClose });

		expect(screen.getByLabelText(/path/i)).toHaveValue('/x/Bruno');
	});

	it('saving a new folder sets the reader folder, not the base folder', async () => {
		vi.mocked(settings.save).mockResolvedValue(undefined);
		library.readers = [{ id: 3, name: 'Bruno', exportPath: null }];
		library.activeReaderId = 3;
		render(SettingsPanel, { onClose: mockOnClose });

		await fireEvent.input(screen.getByLabelText(/path/i), { target: { value: '/x/Bruno' } });
		await fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

		await waitFor(() =>
			expect(invoke).toHaveBeenCalledWith('set_reader_export_path', { readerId: 3, path: '/x/Bruno' })
		);
		expect(settings.setExportPath).not.toHaveBeenCalled();
	});

	it('saving the default folder keeps the reader on the default', async () => {
		vi.mocked(settings.save).mockResolvedValue(undefined);
		library.readers = [{ id: 3, name: 'Bruno', exportPath: '/x/Bruno' }];
		library.activeReaderId = 3;
		render(SettingsPanel, { onClose: mockOnClose });

		await fireEvent.input(screen.getByLabelText(/path/i), {
			target: { value: '~/Documents/Kobo Highlights/Bruno' }
		});
		await fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

		await waitFor(() =>
			expect(invoke).toHaveBeenCalledWith('set_reader_export_path', { readerId: 3, path: null })
		);
	});

	it('hides the reader name without an open reader', () => {
		render(SettingsPanel, { onClose: mockOnClose });

		expect(screen.queryByTestId('reader-name')).toBeNull();
	});

	it('should render the settings panel with title', () => {
		render(SettingsPanel, {
			props: {
				onClose: mockOnClose,
				onSave: mockOnSave
			}
		});

		expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
	});

	it('should render export tab by default', () => {
		render(SettingsPanel, {
			props: {
				onClose: mockOnClose,
				onSave: mockOnSave
			}
		});

		expect(screen.getByRole('tab', { name: /export/i })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByText(/export folder/i)).toBeInTheDocument();
	});

	it('should render export path input with current value', () => {
		render(SettingsPanel, {
			props: {
				onClose: mockOnClose,
				onSave: mockOnSave
			}
		});

		const input = screen.getByLabelText(/path/i);
		expect(input).toHaveValue('~/Documents/Kobo Highlights');
	});

	it('should render metadata checkboxes', () => {
		render(SettingsPanel, {
			props: {
				onClose: mockOnClose,
				onSave: mockOnSave
			}
		});

		expect(screen.getByLabelText(/author/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/isbn/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/publisher/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/last read/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/language/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
	});

	it('should check metadata checkboxes based on current settings', () => {
		render(SettingsPanel, {
			props: {
				onClose: mockOnClose,
				onSave: mockOnSave
			}
		});

		expect(screen.getByLabelText(/author/i)).toBeChecked();
		expect(screen.getByLabelText(/description/i)).not.toBeChecked();
	});

	it('should render date format radio buttons with descriptive labels', () => {
		render(SettingsPanel, {
			props: {
				onClose: mockOnClose,
				onSave: mockOnSave
			}
		});

		// This test expects the nice labels from getDateFormatLabel
		expect(screen.getByLabelText(/24 January 2025/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/dd\/mm\/yyyy/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/iso 8601/i)).toBeInTheDocument();
	});

	it('should switch to appearance tab when clicked', async () => {
		render(SettingsPanel, {
			props: {
				onClose: mockOnClose,
				onSave: mockOnSave
			}
		});

		const appearanceTab = screen.getByRole('tab', { name: /appearance/i });
		await fireEvent.click(appearanceTab);

		expect(appearanceTab).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('heading', { name: /theme/i })).toBeInTheDocument();
	});

	it('choosing Português switches the language', async () => {
		render(SettingsPanel, { props: { onClose: mockOnClose, onSave: mockOnSave } });
		await fireEvent.click(screen.getByRole('tab', { name: /appearance/i }));

		expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
		await fireEvent.click(screen.getByRole('button', { name: 'Português' }));

		expect(settings.setLanguage).toHaveBeenCalledWith('pt');
	});

	it('should render theme buttons in appearance tab', async () => {
		render(SettingsPanel, {
			props: {
				onClose: mockOnClose,
				onSave: mockOnSave
			}
		});

		const appearanceTab = screen.getByRole('tab', { name: /appearance/i });
		await fireEvent.click(appearanceTab);

		expect(screen.getByRole('button', { name: /system/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument();
	});

	it('should call onClose when close button is clicked', async () => {
		render(SettingsPanel, {
			props: {
				onClose: mockOnClose,
				onSave: mockOnSave
			}
		});

		const closeButton = screen.getByRole('button', { name: /close settings/i });
		await fireEvent.click(closeButton);

		expect(mockOnClose).toHaveBeenCalled();
	});

	it('should call onClose when cancel button is clicked', async () => {
		render(SettingsPanel, {
			props: {
				onClose: mockOnClose,
				onSave: mockOnSave
			}
		});

		const cancelButton = screen.getByRole('button', { name: /cancel/i });
		await fireEvent.click(cancelButton);

		expect(mockOnClose).toHaveBeenCalled();
	});

	it('should enable save button after making changes', async () => {
		render(SettingsPanel, {
			props: {
				onClose: mockOnClose,
				onSave: mockOnSave
			}
		});

		const input = screen.getByLabelText(/path/i);
		await fireEvent.input(input, { target: { value: '/new/path' } });

		const saveButton = screen.getByRole('button', { name: /save changes/i });
		expect(saveButton).toBeEnabled();
	});

	it('should call settings.save and onSave when save button is clicked', async () => {
		vi.mocked(settings.save).mockResolvedValue(undefined);

		render(SettingsPanel, {
			props: {
				onClose: mockOnClose,
				onSave: mockOnSave
			}
		});

		// Make a change to enable save button
		const input = screen.getByLabelText(/path/i);
		await fireEvent.input(input, { target: { value: '/new/path' } });

		const saveButton = screen.getByRole('button', { name: /save changes/i });
		await fireEvent.click(saveButton);

		await waitFor(() => {
			expect(settings.save).toHaveBeenCalled();
			expect(mockOnSave).toHaveBeenCalled();
		});
	});
});