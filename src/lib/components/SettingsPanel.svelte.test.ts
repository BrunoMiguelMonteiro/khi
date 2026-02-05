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
			autoImportOnConnect: true
		},
		isLoading: false,
		setExportPath: vi.fn(),
		setMetadataOption: vi.fn(),
		setDateFormat: vi.fn(),
		setTheme: vi.fn(),
		setViewMode: vi.fn(),
		setSortPreference: vi.fn(),
		setAutoImportOnConnect: vi.fn(),
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

import { settings } from '../stores/settings.svelte';

describe('SettingsPanel', () => {
	const mockOnClose = vi.fn();
	const mockOnSave = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
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