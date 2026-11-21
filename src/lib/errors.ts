/**
 * What to show when an export fails: always a message in the user's language,
 * never the raw error from Rust (that one goes to the console and the log).
 */

import { t, type MessageFormatter } from '$lib/i18n';
import { abbreviateHome } from '$lib/home-path';
import type { ExportFailure } from '$lib/bindings';

function isExportFailure(error: unknown): error is ExportFailure {
	return typeof error === 'object' && error !== null && typeof (error as { kind?: unknown }).kind === 'string';
}

/** What the Library header (and the Detail's toast) says of a failed export, and what it offers. */
export type ExportErrorView = {
	title: string;
	/** The header's second line; empty when there is nothing to add to the title. */
	detail: string;
	/** `chooseFolder`: the folder is the problem, so the main action picks another one; else the same export is tried again. */
	action: 'chooseFolder' | 'retry';
	/** The folder that could not be written, as stored (absolute): where the picker opens. */
	folder: string | null;
	/** The Detail's toast: one line, in the toast's own words. */
	toast: string;
};

/** `home` is only for display: the home folder is written «~», as in the Finder. */
export function exportErrorView(error: unknown, home: string | null | undefined, format: MessageFormatter = t): ExportErrorView {
	const title = format('errors.export.title');
	if (isExportFailure(error) && error.kind === 'folderNotWritable') {
		const folder = abbreviateHome(error.folder, home);
		return {
			title,
			detail: format('errors.export.folderNotWritableDetail', { folder }),
			action: 'chooseFolder',
			folder: error.folder,
			toast: format('errors.export.folderNotWritableToast', { folder })
		};
	}
	if (isExportFailure(error) && error.kind === 'diskFull') {
		return { title, detail: format('errors.export.diskFullDetail'), action: 'retry', folder: null, toast: format('errors.export.diskFull') };
	}
	return { title, detail: '', action: 'retry', folder: null, toast: title };
}
