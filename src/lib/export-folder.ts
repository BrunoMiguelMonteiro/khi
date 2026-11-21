import { commands } from '$lib/bindings';
import { library } from '$lib/stores/library.svelte';
import { settings } from '$lib/stores/settings.svelte';

/**
 * Asks for a folder and saves it: the open Reader's (its default folder is stored as null, so it keeps
 * following the base folder and the Reader's name) or, with no Reader, the base folder in the settings.
 * Whether a folder was chosen: cancelling the picker changes nothing. A failed save is thrown.
 */
export async function chooseExportFolder(current: string | null, readerId: number | null): Promise<boolean> {
	const picked = await commands.pickExportFolder(current);
	if (!picked) return false;
	if (readerId !== null) {
		const defaultFolder = await commands.readerDefaultExportFolder(readerId);
		await library.setReaderExportPath(readerId, picked === defaultFolder ? null : picked);
	} else {
		settings.setExportPath(picked);
		await settings.commit(['exportConfig.exportPath']);
	}
	return true;
}
