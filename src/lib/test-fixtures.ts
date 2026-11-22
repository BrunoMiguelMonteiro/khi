/**
 * Test fixtures for the IPC types generated from Rust.
 *
 * Rust sends every `Option<T>` as `null`, never as a missing key. These
 * factories fill the optional fields with `null` so tests only spell out what
 * they care about, and a new Rust field only needs to be added here.
 */
import type { Book, Highlight, KoboDevice } from './types';

type HighlightInput = Pick<Highlight, 'id' | 'text' | 'dateCreated'> & Partial<Highlight>;

type BookInput = Pick<Book, 'id' | 'title' | 'author'> &
	Partial<Omit<Book, 'highlights'>> & { highlights?: HighlightInput[] };

type DeviceInput = Pick<KoboDevice, 'name' | 'path' | 'isValid'> & Partial<KoboDevice>;

export function makeHighlight(fields: HighlightInput): Highlight {
	return {
		annotation: null,
		chapterTitle: null,
		chapterProgress: null,
		containerPath: null,
		removedAt: null,
		isNew: false,
		syncedSeq: null,
		...fields
	};
}

export function makeBook({ highlights = [], ...fields }: BookInput): Book {
	return {
		isbn: null,
		publisher: null,
		language: null,
		dateLastRead: null,
		description: null,
		coverPath: null,
		...fields,
		highlights: highlights.map(makeHighlight)
	};
}

export function makeDevice(fields: DeviceInput): KoboDevice {
	return { serialNumber: null, ...fields };
}
