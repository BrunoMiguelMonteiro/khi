/**
 * Deterministic data the mocked Rust backend answers with. Built with the
 * same factories as the unit tests, so every `Option<T>` is `null` exactly as
 * Rust sends it.
 */
import { makeBook, makeDevice } from '../../src/lib/test-fixtures';
import type { AppSettings_Serialize, Language, ThemePreference, ViewMode } from '../../src/lib/bindings';
import type { Book, KoboDevice, Reader } from '../../src/lib/types';

export const APP_VERSION = '1.3.0';
export const HOME = '/Users/leitor';

export const reader: Reader = { id: 1, name: 'Bruno', exportPath: null };

export const device: KoboDevice = makeDevice({
	name: 'Kobo Libra 2',
	path: '/Volumes/KOBOeReader',
	isValid: true,
	serialNumber: 'N4181C1043910'
});

export const books: Book[] = [
	makeBook({
		id: 1,
		title: 'O Ano da Morte de Ricardo Reis',
		author: 'José Saramago',
		publisher: 'Porto Editora',
		isbn: '9789720046970',
		language: 'pt',
		dateLastRead: '2026-10-02T21:14:00Z',
		highlights: [
			{
				id: 'h1-1',
				text: 'Aqui o mar acaba e a terra principia.',
				dateCreated: '2026-09-20T20:01:00Z',
				chapterTitle: 'Capítulo 1',
				chapterProgress: 0.02,
				isNew: true,
				syncedSeq: 2
			},
			{
				id: 'h1-2',
				text: 'Sábio é o que se contenta com o espetáculo do mundo.',
				dateCreated: '2026-09-22T22:10:00Z',
				annotation: 'Lembra o Ricardo Reis dos heterónimos.\nRever com as Odes.',
				chapterTitle: 'Capítulo 3',
				chapterProgress: 0.4,
				isNew: true,
				syncedSeq: 3
			},
			{
				id: 'h1-3',
				text: 'O tempo não pára, e nós com ele.',
				dateCreated: '2026-09-25T09:30:00Z',
				chapterTitle: 'Capítulo 7',
				removedAt: '2026-10-01T08:00:00Z'
			}
		]
	}),
	makeBook({
		id: 2,
		title:
			'Uma História Muito Longa de Como Aprendi a Ler Devagar, Sublinhar Tudo e Nunca Mais Voltar a Encontrar as Notas Que Tinha Tirado',
		author: 'Autora Com Um Nome Igualmente Comprido de Várias Palavras',
		dateLastRead: '2026-11-10T08:00:00Z',
		highlights: [
			{ id: 'h2-1', text: 'Ler devagar é ler duas vezes.', dateCreated: '2026-11-09T08:00:00Z', isNew: true, syncedSeq: 3 }
		]
	}),
	makeBook({
		id: 3,
		title: 'Meditations',
		author: 'Marcus Aurelius',
		language: 'en',
		dateLastRead: '2026-08-15T12:00:00Z',
		highlights: [
			{
				id: 'h3-1',
				text: 'The happiness of your life depends upon the quality of your thoughts.',
				dateCreated: '2026-08-14T12:00:00Z',
				chapterTitle: 'Book Five',
				annotation: 'Short and true.'
			},
			{
				id: 'h3-2',
				text: 'Waste no more time arguing about what a good man should be. Be one.',
				dateCreated: '2026-08-15T12:00:00Z',
				chapterTitle: 'Book Ten'
			}
		]
	}),
	makeBook({
		id: 4,
		title: 'Livro Sem Destaques',
		author: 'Anónimo',
		highlights: []
	}),
	makeBook({
		id: 5,
		title: 'Ensaio sobre a Cegueira',
		author: 'José Saramago',
		dateLastRead: '2026-07-01T10:00:00Z',
		highlights: [
			{ id: 'h5-1', text: 'Se podes olhar, vê. Se podes ver, repara.', dateCreated: '2026-06-30T10:00:00Z' }
		]
	})
];

/** The same Library after its books were opened or exported: nothing is new. */
export const booksWithoutNews: Book[] = books.map((book) => ({
	...book,
	highlights: book.highlights.map((highlight) => ({ ...highlight, isNew: false }))
}));

/** What `library_summary` answers: new highlights since 9 Nov, the connected Kobo's last sync at 09:42 (Lisbon, UTC+0). */
export const summary = { newSince: '2026-11-09T10:00:00Z', lastSyncAt: '2026-11-15T09:42:00Z' };

export interface SettingsInput {
	theme: ThemePreference;
	language: Language;
	viewMode?: ViewMode;
}

/** What `load_settings` returns: Rust's defaults with the scenario's choices. */
export function makeSettings({ theme, language, viewMode = 'grid' }: SettingsInput): AppSettings_Serialize {
	return {
		exportConfig: {
			exportPath: `${HOME}/Documents/Kobo Highlights`,
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
			theme,
			windowWidth: 1000,
			windowHeight: 700,
			isMaximized: false,
			showOnboarding: false,
			libraryViewMode: viewMode,
			librarySort: 'title',
			// Off, so connecting the Kobo shows the Library without a Sync
			syncOnConnect: false,
			checkForUpdates: true
		},
		language,
		version: APP_VERSION
	};
}

/** Rust's `AppSettings::default()` (`get_default_settings`, `reset_settings`). */
export function defaultSettings(language: Language): AppSettings_Serialize {
	const settings = makeSettings({ theme: 'system', language });
	settings.uiPreferences = {
		...settings.uiPreferences,
		windowWidth: 1200,
		windowHeight: 800,
		showOnboarding: true,
		librarySort: 'date_last_read',
		syncOnConnect: true
	};
	return settings;
}

/** What `plugin:updater|check` returns when a new version exists. */
export const availableUpdate = {
	rid: 9001,
	currentVersion: APP_VERSION,
	version: '2.0.0',
	date: '2026-11-01 10:00:00.0 +00:00:00',
	body: 'Khi 2.0.0',
	rawJson: {
		version: '2.0.0',
		khi_releases: [
			{
				version: '2.0.0',
				date: '2026-11-01',
				notes: {
					pt: {
						whats_new: ['Novo aspeto da Biblioteca.', 'Definições numa janela própria.'],
						bug_fixes: ['A exportação já não ignora livros sem autor.']
					},
					en: {
						whats_new: ['A new look for the Library.', 'Settings in their own window.'],
						bug_fixes: ['Export no longer skips books without an author.']
					}
				}
			},
			{
				version: '1.4.0',
				date: '2026-09-15',
				notes: {
					pt: { whats_new: ['Sincronização mais rápida.'], bug_fixes: [] },
					en: { whats_new: ['Faster Sync.'], bug_fixes: [] }
				}
			}
		]
	}
};
