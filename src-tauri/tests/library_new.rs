//! The sync sequence behind «novo»: each sync gets a number, and a highlight
//! the Library never saw before keeps the number of the sync that brought it.

mod common;

use chrono::{DateTime, TimeZone, Utc};
use common::{hl, kobo_book, library_conn, no_cover, no_progress, setup, snapshot, BOOK_A, BOOK_B, KOBO_A, KOBO_B};
use khi_lib::library::{schema, Library};
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
