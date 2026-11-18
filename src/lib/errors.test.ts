import { describe, it, expect } from 'vitest';
import { exportErrorMessage } from './errors';

describe('exportErrorMessage', () => {
	it('names the folder that cannot be written', () => {
		expect(exportErrorMessage({ kind: 'folderNotWritable', folder: '/Volumes/Livros/Bruno' })).toBe(
			'Couldn’t export to /Volumes/Livros/Bruno. Check that the disk is connected, or choose another folder in Settings.'
		);
	});

	it('says when the disk is full', () => {
		expect(exportErrorMessage({ kind: 'diskFull' })).toBe('Couldn’t export: the disk is full.');
	});

	it('anything else gets the general message, never the raw error', () => {
		const general = 'Error exporting highlights';
		expect(exportErrorMessage({ kind: 'internal' })).toBe(general);
		expect(exportErrorMessage({ kind: 'somethingNew' })).toBe(general);
		expect(exportErrorMessage('Library IO error: Permission denied (os error 13)')).toBe(general);
		expect(exportErrorMessage(new Error('No reader open'))).toBe(general);
		expect(exportErrorMessage(null)).toBe(general);
	});
});
