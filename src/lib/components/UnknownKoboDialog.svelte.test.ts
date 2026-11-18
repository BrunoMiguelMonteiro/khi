import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/svelte';
import UnknownKoboDialog from './UnknownKoboDialog.svelte';
import { makeDevice } from '../test-fixtures';

const device = makeDevice({
	name: 'KOBOeReader',
	path: '/Volumes/KOBOeReader',
	isValid: true,
	serialNumber: 'N4181B5025147'
});
const createButton = () => within(screen.getByTestId('create-reader')).getByRole('button');

const readers = [
	{ id: 1, name: 'Bruno', exportPath: null },
	{ id: 2, name: 'Ana', exportPath: null }
];

describe('UnknownKoboDialog', () => {
	it('dialog defaults new name to device name', () => {
		render(UnknownKoboDialog, { device, readers: [], onChoose: vi.fn(), onCreate: vi.fn() });

		const input = screen.getByTestId('new-reader-name') as HTMLInputElement;
		expect(input.value).toBe('KOBOeReader');
	});

	it('choosing a reader associates the kobo', async () => {
		const onChoose = vi.fn();
		render(UnknownKoboDialog, { device, readers, onChoose, onCreate: vi.fn() });

		await fireEvent.click(screen.getByRole('button', { name: 'Ana' }));

		expect(onChoose).toHaveBeenCalledWith(2);
	});

	it('creates a reader with the typed name', async () => {
		const onCreate = vi.fn();
		render(UnknownKoboDialog, { device, readers, onChoose: vi.fn(), onCreate });

		const input = screen.getByTestId('new-reader-name');
		await fireEvent.input(input, { target: { value: '  Ana Sofia ' } });
		await fireEvent.click(createButton());

		expect(onCreate).toHaveBeenCalledWith('Ana Sofia');
	});

	it('does not create a reader with an empty name', async () => {
		const onCreate = vi.fn();
		render(UnknownKoboDialog, { device, readers, onChoose: vi.fn(), onCreate });

		await fireEvent.input(screen.getByTestId('new-reader-name'), { target: { value: '   ' } });

		expect(createButton()).toBeDisabled();
	});
});
