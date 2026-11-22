import { describe, it, expect } from 'vitest';
import { exportErrorView } from './errors';

describe('exportErrorView (Task 47)', () => {
	it('folder_not_writable_names_the_folder_with_a_tilde_and_offers_another_folder', () => {
		const view = exportErrorView({ kind: 'folderNotWritable', folder: '/Users/leitor/Documents/Kobo' }, '/Users/leitor');
		expect(view.title).toBe('Couldn’t export.');
		expect(view.detail).toBe('Khi can’t write to ~/Documents/Kobo. Choose another folder.');
		expect(view.action).toBe('chooseFolder');
		expect(view.toast).toBe('Couldn’t export to ~/Documents/Kobo.');
		expect(view.folder).toBe('/Users/leitor/Documents/Kobo');
	});

	it('a_folder_outside_the_home_stays_whole', () => {
		const view = exportErrorView({ kind: 'folderNotWritable', folder: '/Volumes/Livros/Bruno' }, '/Users/leitor');
		expect(view.detail).toBe('Khi can’t write to /Volumes/Livros/Bruno. Choose another folder.');
		expect(exportErrorView({ kind: 'folderNotWritable', folder: '/x' }, null).detail).toContain('/x');
	});

	it('disk_full_and_the_rest_offer_to_try_again', () => {
		const full = exportErrorView({ kind: 'diskFull' }, '/Users/leitor');
		expect(full).toMatchObject({ title: 'Couldn’t export.', detail: 'The disk is full.', action: 'retry', folder: null });
		expect(full.toast).toBe('Couldn’t export: the disk is full.');

		for (const error of [{ kind: 'internal' }, { kind: 'somethingNew' }, 'Library IO error: Permission denied', new Error('x'), null]) {
			const view = exportErrorView(error, null);
			expect(view).toMatchObject({ title: 'Couldn’t export.', detail: '', action: 'retry', folder: null });
			expect(view.toast).toBe('Couldn’t export.');
		}
	});
});
