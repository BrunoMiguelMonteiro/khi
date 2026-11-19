//! The sync sequence behind «novo»: each sync gets a number, and a highlight
//! the Library never saw before keeps the number of the sync that brought it.

mod common;

use chrono::{DateTime, TimeZone, Utc};
use common::{hl, kobo_book, library_conn, no_cover, no_progress, setup, snapshot, BOOK_A, BOOK_B, KOBO_A, KOBO_B};
use khi_lib::library::{schema, Library, LibraryBook, LibraryError, LibraryHighlight};
use khi_lib::models::{DateFormat, ExportConfig, KoboBook, KoboHighlight, Language, MetadataConfig};
use rusqlite::{params, Connection, OptionalExtension};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::Path;
use tempfile::TempDir;

fn at(day: u32, hour: u32) -> DateTime<Utc> {
    Utc.with_ymd_and_hms(2026, 11, day, hour, 0, 0).unwrap()
}

/// `meta('sync_seq')`, or `None` before any sync.
fn sync_seq(dir: &Path) -> Option<i64> {
    library_conn(dir)
        .query_row("SELECT CAST(value AS INTEGER) FROM meta WHERE key = 'sync_seq'", [], |r| r.get(0))
        .optional()
        .unwrap()
}

/// `(synced_seq, synced_at)` of one highlight.
fn synced(dir: &Path, bookmark_id: &str) -> (Option<i64>, Option<String>) {
    library_conn(dir)
        .query_row(
            "SELECT synced_seq, synced_at FROM highlights WHERE bookmark_id = ?1",
            [bookmark_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap()
}

fn last_sync_at(dir: &Path, serial: &str) -> Option<String> {
    library_conn(dir)
        .query_row("SELECT last_sync_at FROM kobos WHERE serial = ?1", [serial], |r| r.get(0))
        .unwrap()
}

/// bookmark_id, text, annotation, removed_at, synced_seq, synced_at
type MigratedRow = (String, String, Option<String>, Option<String>, Option<i64>, Option<String>);

#[test]
fn migration_v2_keeps_v1_data() {
    let dir = TempDir::new().unwrap();
    {
        let conn = Connection::open(dir.path().join("library.sqlite")).unwrap();
        conn.execute_batch(schema::MIGRATIONS[0]).unwrap();
        conn.pragma_update(None, "user_version", 1).unwrap();
        conn.execute_batch(
            "INSERT INTO readers (id, name) VALUES (1, 'Bruno');
             INSERT INTO kobos (serial, reader_id, last_sync_at) VALUES ('SERIAL-A', 1, '2026-11-01T10:00:00Z');
             INSERT INTO books (id, reader_id, title, author) VALUES (1, 1, 'Confiança', 'Hernán Díaz');
             INSERT INTO highlights (reader_id, bookmark_id, book_id, kobo_serial, text, annotation, date_created)
                VALUES (1, 'a1', 1, 'SERIAL-A', 'Primeiro', 'Nota a1', '2026-10-01T10:00:00Z');
             INSERT INTO highlights (reader_id, bookmark_id, book_id, kobo_serial, text, removed_at)
                VALUES (1, 'a2', 1, 'SERIAL-A', 'Segundo', '2026-11-01T10:00:00Z');",
        )
        .unwrap();
    }

    drop(Library::open(dir.path()).unwrap());

    let conn = library_conn(dir.path());
    let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
    assert_eq!(version, 2);
    let rows: Vec<MigratedRow> = conn
        .prepare(
            "SELECT bookmark_id, text, annotation, removed_at, synced_seq, synced_at
             FROM highlights ORDER BY bookmark_id",
        )
        .unwrap()
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)))
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap();
    assert_eq!(
        rows,
        vec![
            ("a1".into(), "Primeiro".into(), Some("Nota a1".into()), None, None, None),
            ("a2".into(), "Segundo".into(), None, Some("2026-11-01T10:00:00Z".into()), None, None),
        ]
    );
    let (title, opened_seq): (String, Option<i64>) = conn
        .query_row("SELECT title, opened_seq FROM books WHERE id = 1", [], |r| Ok((r.get(0)?, r.get(1)?)))
        .unwrap();
    assert_eq!(title, "Confiança");
    assert_eq!(opened_seq, None);
    assert_eq!(last_sync_at(dir.path(), KOBO_A).as_deref(), Some("2026-11-01T10:00:00Z"));
}

#[test]
fn first_sync_of_reader_marks_nothing() {
    let (dir, mut lib, _) = setup();

    lib.sync(
        KOBO_A,
        &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro"), hl("a2", "Segundo")])]),
        &no_cover,
        no_progress,
    )
    .unwrap();

    assert_eq!(sync_seq(dir.path()), Some(1), "the first sync is numbered too");
    assert_eq!(synced(dir.path(), "a1"), (None, None));
    assert_eq!(synced(dir.path(), "a2"), (None, None));
}

#[test]
fn seq_increments_per_sync() {
    let (dir, mut lib, _) = setup();
    assert_eq!(sync_seq(dir.path()), None);
    let snap = snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]);

    lib.sync(KOBO_A, &snap, &no_cover, no_progress).unwrap();
    assert_eq!(sync_seq(dir.path()), Some(1));
    lib.sync(KOBO_A, &snap, &no_cover, no_progress).unwrap();
    assert_eq!(sync_seq(dir.path()), Some(2), "a sync that brings nothing new still counts");
    lib.sync(KOBO_B, &snapshot(vec![]), &no_cover, no_progress).unwrap();
    assert_eq!(sync_seq(dir.path()), Some(3), "the number is per Library, not per Kobo");
}

#[test]
fn failed_sync_does_not_advance_seq() {
    let (dir, mut lib, _) = setup();
    lib.sync(KOBO_A, &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]), &no_cover, no_progress)
        .unwrap();
    assert_eq!(sync_seq(dir.path()), Some(1));

    let snap = snapshot(vec![
        kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")]),
        kobo_book(BOOK_B, "Duly Noted", "Jorge Arango", vec![hl("b1", "Terceiro")]),
    ]);
    let result = catch_unwind(AssertUnwindSafe(|| {
        lib.sync(KOBO_A, &snap, &no_cover, |done, _total| {
            if done == 1 {
                panic!("Kobo unplugged mid-sync");
            }
        })
    }));
    assert!(result.is_err());
    assert_eq!(sync_seq(dir.path()), Some(1), "a rolled-back sync keeps the old number");

    lib.sync(KOBO_A, &snap, &no_cover, no_progress).unwrap();
    assert_eq!(sync_seq(dir.path()), Some(2));
    assert_eq!(synced(dir.path(), "b1").0, Some(2), "the next sync takes the number the failed one never kept");
}

#[test]
fn insert_after_first_sync_gets_seq_and_at() {
    let (dir, lib, _) = setup();
    let mut lib = lib.with_clock(|| at(9, 10));
    lib.sync(KOBO_A, &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]), &no_cover, no_progress)
        .unwrap();

    let mut lib = lib.with_clock(|| at(10, 21));
    lib.sync(
        KOBO_A,
        &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro"), hl("a2", "Segundo")])]),
        &no_cover,
        no_progress,
    )
    .unwrap();

    assert_eq!(synced(dir.path(), "a1"), (None, None));
    assert_eq!(synced(dir.path(), "a2"), (Some(2), Some("2026-11-10T21:00:00Z".to_string())));
    assert_eq!(last_sync_at(dir.path(), KOBO_A).as_deref(), Some("2026-11-10T21:00:00Z"), "same now, same format");
}

#[test]
fn second_kobo_unseen_bookmarks_get_seq() {
    let (dir, mut lib, _) = setup();
    lib.sync(KOBO_A, &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]), &no_cover, no_progress)
        .unwrap();

    // B's first sync is not the Reader's first: the Library already holds a1.
    lib.sync(
        KOBO_B,
        &snapshot(vec![
            kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")]),
            kobo_book(BOOK_B, "Duly Noted", "Jorge Arango", vec![hl("b1", "Terceiro")]),
        ]),
        &no_cover,
        no_progress,
    )
    .unwrap();

    assert_eq!(synced(dir.path(), "a1").0, None, "a bookmark the Library already had is not new");
    assert_eq!(synced(dir.path(), "b1").0, Some(2));
}

#[test]
fn same_bookmark_again_keeps_seq() {
    let (dir, lib, _) = setup();
    let mut lib = lib.with_clock(|| at(9, 10));
    lib.sync(KOBO_A, &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]), &no_cover, no_progress)
        .unwrap();
    let mut lib = lib.with_clock(|| at(10, 10));
    lib.sync(
        KOBO_A,
        &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro"), hl("a2", "Segundo")])]),
        &no_cover,
        no_progress,
    )
    .unwrap();
    let original = (Some(2), Some("2026-11-10T10:00:00Z".to_string()));
    assert_eq!(synced(dir.path(), "a2"), original);

    // Update branch: the Kobo changed the text.
    let mut lib = lib.with_clock(|| at(11, 10));
    let report = lib
        .sync(
            KOBO_A,
            &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro"), hl("a2", "Segundo, corrigido")])]),
            &no_cover,
            no_progress,
        )
        .unwrap();
    assert_eq!(report.updated, 1);
    assert_eq!(synced(dir.path(), "a2"), original, "an update is not new");

    // Restore branch: removed from the Kobo, then back.
    let mut lib = lib.with_clock(|| at(12, 10));
    lib.sync(KOBO_A, &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]), &no_cover, no_progress)
        .unwrap();
    let mut lib = lib.with_clock(|| at(13, 10));
    let report = lib
        .sync(
            KOBO_A,
            &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro"), hl("a2", "Segundo, corrigido")])]),
            &no_cover,
            no_progress,
        )
        .unwrap();
    assert_eq!(report.restored, 1);
    assert_eq!(synced(dir.path(), "a2"), original, "a restore is not new");
    let removed_at: Option<String> = library_conn(dir.path())
        .query_row("SELECT removed_at FROM highlights WHERE bookmark_id = ?1", params!["a2"], |r| r.get(0))
        .unwrap();
    assert_eq!(removed_at, None);
}

// ---------------------------------------------------------------------------
// isNew, mark_book_opened and the Reader's summary (Task 32)
// ---------------------------------------------------------------------------

fn sync(lib: &mut Library, serial: &str, books: Vec<KoboBook>) {
    lib.sync(serial, &snapshot(books), &no_cover, no_progress).unwrap();
}

fn confianca(ids: &[&str]) -> KoboBook {
    kobo_book(BOOK_A, "Confiança", "Hernán Díaz", ids.iter().map(|id| hl(id, &format!("Texto {}", id))).collect())
}

fn duly_noted(ids: &[&str]) -> KoboBook {
    kobo_book(BOOK_B, "Duly Noted", "Jorge Arango", ids.iter().map(|id| hl(id, &format!("Texto {}", id))).collect())
}

fn book<'a>(books: &'a [LibraryBook], title: &str) -> &'a LibraryBook {
    books.iter().find(|b| b.title == title).unwrap()
}

fn highlight<'a>(book: &'a LibraryBook, id: &str) -> &'a LibraryHighlight {
    book.highlights.iter().find(|h| h.id == id).unwrap()
}

/// The ids of the book's new highlights, sorted.
fn new_ids(lib: &Library, reader_id: u32, title: &str) -> Vec<String> {
    let books = lib.books(reader_id).unwrap();
    let mut ids: Vec<String> = book(&books, title).highlights.iter().filter(|h| h.is_new).map(|h| h.id.clone()).collect();
    ids.sort();
    ids
}

/// What the frontend sends as `seen_seq`: the highest `syncedSeq` it loaded.
fn seen_seq(book: &LibraryBook) -> u32 {
    book.highlights.iter().filter_map(|h| h.synced_seq).max().unwrap_or(0)
}

fn opened_seq(dir: &Path, book_id: u32) -> Option<i64> {
    library_conn(dir)
        .query_row("SELECT opened_seq FROM books WHERE id = ?1", [book_id], |r| r.get(0))
        .unwrap()
}

#[test]
fn never_opened_book_is_new() {
    let (_dir, mut lib, reader) = setup();
    sync(&mut lib, KOBO_A, vec![confianca(&["a1"])]);
    sync(&mut lib, KOBO_A, vec![confianca(&["a1", "a2"])]);

    let books = lib.books(reader).unwrap();
    let confianca = book(&books, "Confiança");
    let a2 = highlight(confianca, "a2");
    assert!(a2.is_new, "a highlight from a later sync of a never-opened book is new");
    assert_eq!(a2.synced_seq, Some(2));
    let a1 = highlight(confianca, "a1");
    assert!(!a1.is_new, "the Reader's first sync marks nothing");
    assert_eq!(a1.synced_seq, None);
}

#[test]
fn opening_with_seen_seq_clears_new() {
    let (_dir, mut lib, reader) = setup();
    sync(&mut lib, KOBO_A, vec![confianca(&["a1"])]);
    sync(&mut lib, KOBO_A, vec![confianca(&["a1", "a2"]), duly_noted(&["b1"])]);
    assert_eq!(new_ids(&lib, reader, "Confiança"), vec!["a2"]);

    let books = lib.books(reader).unwrap();
    let confianca = book(&books, "Confiança");
    assert_eq!(seen_seq(confianca), 2);
    lib.mark_book_opened(reader, confianca.id, seen_seq(confianca)).unwrap();

    assert!(new_ids(&lib, reader, "Confiança").is_empty(), "seen up to its own seq: no longer new");
    assert_eq!(new_ids(&lib, reader, "Duly Noted"), vec!["b1"], "only the opened book is marked");
}

#[test]
fn sync_while_open_is_new_next_open() {
    let (_dir, mut lib, reader) = setup();
    sync(&mut lib, KOBO_A, vec![confianca(&["a1"])]);
    sync(&mut lib, KOBO_A, vec![confianca(&["a1", "a2"])]);

    let books = lib.books(reader).unwrap();
    let confianca_loaded = book(&books, "Confiança");
    lib.mark_book_opened(reader, confianca_loaded.id, seen_seq(confianca_loaded)).unwrap();

    sync(&mut lib, KOBO_A, vec![confianca(&["a1", "a2", "a3"])]);

    assert_eq!(new_ids(&lib, reader, "Confiança"), vec!["a3"]);
}

#[test]
fn open_during_sync_is_new_next_open() {
    let (_dir, mut lib, reader) = setup();
    sync(&mut lib, KOBO_A, vec![confianca(&["a1"])]);
    sync(&mut lib, KOBO_A, vec![confianca(&["a1", "a2"])]);

    // The book is loaded at seq 2...
    let books = lib.books(reader).unwrap();
    let confianca_loaded = book(&books, "Confiança");
    let seen = seen_seq(confianca_loaded);
    assert_eq!(seen, 2);

    // ...sync 3 lands before the mark does...
    sync(&mut lib, KOBO_A, vec![confianca(&["a1", "a2", "a3"])]);

    // ...and the mark carries what was loaded, not the current seq (3),
    // which would swallow a3 unseen.
    lib.mark_book_opened(reader, confianca_loaded.id, seen).unwrap();

    assert_eq!(new_ids(&lib, reader, "Confiança"), vec!["a3"]);
}

#[test]
fn mark_never_lowers_opened_seq() {
    let (dir, mut lib, reader) = setup();
    sync(&mut lib, KOBO_A, vec![confianca(&["a1"])]);
    sync(&mut lib, KOBO_A, vec![confianca(&["a1", "a2"])]);
    sync(&mut lib, KOBO_A, vec![confianca(&["a1", "a2", "a3"])]);
    let book_id = book(&lib.books(reader).unwrap(), "Confiança").id;

    lib.mark_book_opened(reader, book_id, 3).unwrap();
    assert_eq!(opened_seq(dir.path(), book_id), Some(3));

    // A stale mark (an older window, a slow call) arrives late.
    lib.mark_book_opened(reader, book_id, 1).unwrap();
    assert_eq!(opened_seq(dir.path(), book_id), Some(3));
    assert!(new_ids(&lib, reader, "Confiança").is_empty());
}

#[test]
fn mark_book_opened_other_reader_is_not_found() {
    let (dir, mut lib, reader) = setup();
    let other = lib.create_reader("Outra").unwrap();
    sync(&mut lib, KOBO_A, vec![confianca(&["a1"])]);
    sync(&mut lib, KOBO_A, vec![confianca(&["a1", "a2"])]);
    let book_id = book(&lib.books(reader).unwrap(), "Confiança").id;

    assert!(matches!(lib.mark_book_opened(other.id, book_id, 2), Err(LibraryError::NotFound)));
    assert!(matches!(lib.mark_book_opened(reader, 9999, 2), Err(LibraryError::NotFound)));

    assert_eq!(opened_seq(dir.path(), book_id), None);
    assert_eq!(new_ids(&lib, reader, "Confiança"), vec!["a2"]);
}

#[test]
fn new_since_is_oldest_unseen() {
    let (_dir, lib, reader) = setup();
    let mut lib = lib.with_clock(|| at(8, 10));
    sync(&mut lib, KOBO_A, vec![confianca(&["a1"])]);
    let mut lib = lib.with_clock(|| at(9, 10));
    sync(&mut lib, KOBO_A, vec![confianca(&["a1", "a2"])]);
    let mut lib = lib.with_clock(|| at(10, 10));
    sync(&mut lib, KOBO_A, vec![confianca(&["a1", "a2"]), duly_noted(&["b1"])]);

    let summary = lib.library_summary(reader, None).unwrap();
    assert_eq!(summary.new_since.as_deref(), Some("2026-11-09T10:00:00Z"));

    let books = lib.books(reader).unwrap();
    let confianca_loaded = book(&books, "Confiança");
    lib.mark_book_opened(reader, confianca_loaded.id, seen_seq(confianca_loaded)).unwrap();

    let summary = lib.library_summary(reader, None).unwrap();
    assert_eq!(summary.new_since.as_deref(), Some("2026-11-10T10:00:00Z"), "a2 was seen; b1 is the oldest unseen");
}

#[test]
fn new_since_none_when_nothing_new() {
    let (_dir, lib, reader) = setup();
    let mut lib = lib.with_clock(|| at(8, 10));
    sync(&mut lib, KOBO_A, vec![confianca(&["a1"])]);
    assert_eq!(lib.library_summary(reader, None).unwrap().new_since, None, "the first sync brings nothing new");

    let mut lib = lib.with_clock(|| at(9, 10));
    sync(&mut lib, KOBO_A, vec![confianca(&["a1", "a2"])]);
    assert!(lib.library_summary(reader, None).unwrap().new_since.is_some());

    let books = lib.books(reader).unwrap();
    let confianca_loaded = book(&books, "Confiança");
    lib.mark_book_opened(reader, confianca_loaded.id, seen_seq(confianca_loaded)).unwrap();
    assert_eq!(lib.library_summary(reader, None).unwrap().new_since, None);
}

#[test]
fn last_sync_at_is_the_connected_kobos() {
    let (_dir, lib, reader) = setup();
    let mut lib = lib.with_clock(|| at(9, 10));
    sync(&mut lib, KOBO_A, vec![confianca(&["a1"])]);
    let mut lib = lib.with_clock(|| at(10, 21));
    sync(&mut lib, KOBO_B, vec![confianca(&["a1"])]);

    let summary = lib.library_summary(reader, Some(KOBO_A)).unwrap();
    assert_eq!(summary.last_sync_at.as_deref(), Some("2026-11-09T10:00:00Z"), "the connected Kobo's, not the latest");
    let summary = lib.library_summary(reader, Some(KOBO_B)).unwrap();
    assert_eq!(summary.last_sync_at.as_deref(), Some("2026-11-10T21:00:00Z"));
}

#[test]
fn last_sync_at_none_without_kobo() {
    let (_dir, lib, reader) = setup();
    let mut lib = lib.with_clock(|| at(9, 10));
    sync(&mut lib, KOBO_A, vec![confianca(&["a1"])]);

    assert_eq!(lib.library_summary(reader, None).unwrap().last_sync_at, None);
    assert_eq!(lib.library_summary(reader, Some("SERIAL-UNKNOWN")).unwrap().last_sync_at, None);
    assert_eq!(lib.library_summary(reader, Some(KOBO_B)).unwrap().last_sync_at, None, "associated, never synced");
}

#[test]
fn last_sync_at_none_for_other_readers_kobo() {
    let (_dir, lib, reader) = setup();
    let other = lib.create_reader("Outra").unwrap();
    lib.associate_kobo("SERIAL-C", other.id).unwrap();
    let mut lib = lib.with_clock(|| at(9, 10));
    sync(&mut lib, "SERIAL-C", vec![confianca(&["c1"])]);

    assert_eq!(lib.library_summary(reader, Some("SERIAL-C")).unwrap().last_sync_at, None);
    assert_eq!(
        lib.library_summary(other.id, Some("SERIAL-C")).unwrap().last_sync_at.as_deref(),
        Some("2026-11-09T10:00:00Z")
    );
}

#[test]
fn export_output_unchanged() {
    fn config(base: &Path) -> ExportConfig {
        ExportConfig {
            export_path: base.to_string_lossy().into_owned(),
            metadata: MetadataConfig {
                author: true,
                isbn: true,
                publisher: true,
                date_last_read: true,
                language: true,
                description: true,
            },
            date_format: DateFormat::Iso8601,
        }
    }
    let a2 = KoboHighlight { date_created: "2026-10-02T10:00:00Z".to_string(), ..hl("a2", "Segundo") };
    let both = kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro"), a2]);

    // a2 arrives in a later sync, so it is new
    let (_dir_new, mut with_new, reader_new) = setup();
    sync(&mut with_new, KOBO_A, vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]);
    sync(&mut with_new, KOBO_A, vec![both.clone()]);
    let books = with_new.books(reader_new).unwrap();
    assert!(highlight(book(&books, "Confiança"), "a2").is_new, "precondition: a2 is new");

    // Both arrive in the first sync: nothing is new
    let (_dir_fresh, mut fresh, reader_fresh) = setup();
    sync(&mut fresh, KOBO_A, vec![both]);
    let books_fresh = fresh.books(reader_fresh).unwrap();
    assert!(book(&books_fresh, "Confiança").highlights.iter().all(|h| !h.is_new));

    let base_new = TempDir::new().unwrap();
    let base_fresh = TempDir::new().unwrap();
    let file_new = &with_new
        .export(reader_new, &[book(&books, "Confiança").id], &config(base_new.path()), Language::Pt)
        .unwrap()[0];
    let file_fresh = &fresh
        .export(reader_fresh, &[book(&books_fresh, "Confiança").id], &config(base_fresh.path()), Language::Pt)
        .unwrap()[0];

    assert_eq!(file_new.file_name(), file_fresh.file_name());
    assert_eq!(std::fs::read(file_new).unwrap(), std::fs::read(file_fresh).unwrap());
}
