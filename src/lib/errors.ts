/**
 * What to show when a command fails: always a message in the user's language,
 * never the raw error from Rust (that one goes to the console and the log).
 */

import { t } from '$lib/i18n';
import type { ExportFailure } from '$lib/bindings';

function isExportFailure(error: unknown): error is ExportFailure {
	return typeof error === 'object' && error !== null && typeof (error as { kind?: unknown }).kind === 'string';
}

/** The message for a failed export (`export_library_books` throws an `ExportFailure`). */
export function exportErrorMessage(error: unknown): string {
	if (isExportFailure(error)) {
		if (error.kind === 'folderNotWritable') return t('errors.export.folderNotWritable', { folder: error.folder });
		if (error.kind === 'diskFull') return t('errors.export.diskFull');
	}
	return t('notifications.exportError');
}
