mod common;

use common::{hl, kobo_book, library_conn, no_cover, no_progress, setup, snapshot, BOOK_A, BOOK_B, KOBO_A, KOBO_B};
use khi_lib::covers::CoverExtractor;
use khi_lib::library::LibraryError;
use khi_lib::models::{KoboBook, KoboHighlight};
use rusqlite::OptionalExtension;
use std::panic::{catch_unwind, AssertUnwindSafe};
use tempfile::TempDir;

#[derive(Debug, PartialEq)]
struct Row {
    text: String,
    annotation: Option<String>,
    chapter_title: Option<String>,
    chapter_progress: Option<f64>,
    kobo_serial: Option<String>,
    removed_at: Option<String>,
    book_id: u32,
}

fn row(dir: &TempDir, bookmark_id: &str) -> Option<Row> {
    library_conn(dir.path())
        .query_row(
            "SELECT text, annotation, chapter_title, chapter_progress, kobo_serial, removed_at, book_id
             FROM highlights WHERE bookmark_id = ?1",
            [bookmark_id],
            |r| {
                Ok(Row {
                    text: r.get(0)?,
                    annotation: r.get(1)?,
                    chapter_title: r.get(2)?,
                    chapter_progress: r.get(3)?,
                    kobo_serial: r.get(4)?,
                    removed_at: r.get(5)?,
                    book_id: r.get(6)?,
                })
            },
        )
        .optional()
        .unwrap()
}

fn book_count(dir: &TempDir) -> u32 {
    library_conn(dir.path())
        .query_row("SELECT COUNT(*) FROM books", [], |r| r.get(0))
        .unwrap()
}

fn book_titles(dir: &TempDir) -> Vec<String> {
    let conn = library_conn(dir.path());
    let mut stmt = conn.prepare("SELECT title FROM books ORDER BY id").unwrap();
    stmt.query_map([], |r| r.get(0))
        .unwrap()
        .collect::<rusqlite::Result<Vec<String>>>()
        .unwrap()
}

fn book_id(dir: &TempDir) -> u32 {
    library_conn(dir.path())
        .query_row("SELECT id FROM books", [], |r| r.get(0))
        .unwrap()
}

#[test]
fn cover_is_copied_once() {
    let (dir, mut lib, _) = setup();
    let images = TempDir::new().unwrap();
    let first = images.path().join("first.jpg");
    let second = images.path().join("second.jpg");
    std::fs::write(&first, b"first cover").unwrap();
    std::fs::write(&second, b"second cover").unwrap();
    let snap = snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]);

    lib.sync(KOBO_A, &snap, &|_: &KoboBook| Some(first.clone()), no_progress).unwrap();
    lib.sync(KOBO_A, &snap, &|_: &KoboBook| Some(second.clone()), no_progress).unwrap();

    let stored = dir.path().join("covers").join(format!("{}.jpg", book_id(&dir)));
    assert_eq!(std::fs::read(&stored).unwrap(), b"first cover");
}

#[test]
fn placeholder_is_not_persisted() {
    let (dir, mut lib, _) = setup();
    let images = TempDir::new().unwrap();
    let placeholder = images.path().join("abc123_placeholder.svg");
    std::fs::write(&placeholder, b"<svg/>").unwrap();
    let snap = snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]);

    lib.sync(KOBO_A, &snap, &|_: &KoboBook| Some(placeholder.clone()), no_progress).unwrap();

    let stored = dir.path().join("covers").join(format!("{}.jpg", book_id(&dir)));
    assert!(!stored.exists(), "a placeholder would block the real cover forever");
}

#[test]
fn cover_survives_cache_clear() {
    let (dir, mut lib, _) = setup();
    let cache = TempDir::new().unwrap();
    let image = cache.path().join("cached.jpg");
    std::fs::write(&image, b"cover").unwrap();
    let snap = snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]);
    lib.sync(KOBO_A, &snap, &|_: &KoboBook| Some(image.clone()), no_progress).unwrap();

    CoverExtractor::new(cache.path().to_path_buf()).clear_cache().unwrap();

    let stored = dir.path().join("covers").join(format!("{}.jpg", book_id(&dir)));
    assert!(stored.exists());
}

#[test]
fn new_highlight_is_inserted_with_origin() {
    let (dir, mut lib, _) = setup();
    let snap = snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]);

    let report = lib.sync(KOBO_A, &snap, &no_cover, no_progress).unwrap();

    assert_eq!(report.added, 1);
    assert_eq!(report.books, 1);
    let r = row(&dir, "a1").unwrap();
    assert_eq!(r.text, "Primeiro");
    assert_eq!(r.kobo_serial.as_deref(), Some(KOBO_A));
    assert_eq!(r.removed_at, None);
}

#[test]
fn kobo_wins_on_text_note_chapter_progress() {
    let (dir, mut lib, _) = setup();
    lib.sync(KOBO_A, &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]), &no_cover, no_progress)
        .unwrap();

    let edited = KoboHighlight {
        annotation: Some("Nota nova".into()),
        chapter_title: Some("Capítulo 2".into()),
        chapter_progress: Some(0.4),
        ..hl("a1", "Primeiro, corrigido")
    };
    let report = lib
        .sync(KOBO_A, &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![edited])]), &no_cover, no_progress)
        .unwrap();

    assert_eq!(report.updated, 1);
    assert_eq!(report.added, 0);
    let r = row(&dir, "a1").unwrap();
    assert_eq!(r.text, "Primeiro, corrigido");
    assert_eq!(r.annotation.as_deref(), Some("Nota nova"));
    assert_eq!(r.chapter_title.as_deref(), Some("Capítulo 2"));
    assert_eq!(r.chapter_progress, Some(0.4));
}

#[test]
fn missing_highlight_is_marked_removed_with_date() {
    let (dir, mut lib, _) = setup();
    lib.sync(
        KOBO_A,
        &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro"), hl("a2", "Segundo")])]),
        &no_cover,
        no_progress,
    )
    .unwrap();

    let report = lib
        .sync(KOBO_A, &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]), &no_cover, no_progress)
        .unwrap();

    assert_eq!(report.removed, 1);
    let r = row(&dir, "a2").expect("a removed highlight stays in the Library");
    assert!(r.removed_at.is_some(), "a2 carries the removal date");
    assert_eq!(r.text, "Segundo");
    assert_eq!(row(&dir, "a1").unwrap().removed_at, None);
}

#[test]
fn removed_then_back_clears_mark() {
    let (dir, mut lib, _) = setup();
    let with_a1 = snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]);
    lib.sync(KOBO_A, &with_a1, &no_cover, no_progress).unwrap();
    lib.sync(KOBO_A, &snapshot(vec![]), &no_cover, no_progress).unwrap();
    assert!(row(&dir, "a1").unwrap().removed_at.is_some());

    let report = lib.sync(KOBO_A, &with_a1, &no_cover, no_progress).unwrap();

    assert_eq!(report.restored, 1);
    assert_eq!(row(&dir, "a1").unwrap().removed_at, None);
}

#[test]
fn other_kobo_highlights_are_untouched() {
    let (dir, mut lib, _) = setup();
    lib.sync(KOBO_A, &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]), &no_cover, no_progress)
        .unwrap();

    lib.sync(KOBO_B, &snapshot(vec![kobo_book(BOOK_B, "Duly Noted", "Jorge Arango", vec![hl("b1", "Terceiro")])]), &no_cover, no_progress)
        .unwrap();

    assert_eq!(row(&dir, "a1").unwrap().removed_at, None, "B never marks A's highlights");
    assert_eq!(row(&dir, "b1").unwrap().kobo_serial.as_deref(), Some(KOBO_B));
}

#[test]
fn same_bookmark_from_second_kobo_keeps_origin() {
    let (dir, mut lib, _) = setup();
    lib.sync(KOBO_A, &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]), &no_cover, no_progress)
        .unwrap();

    lib.sync(KOBO_B, &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro, no B")])]), &no_cover, no_progress)
        .unwrap();
    let r = row(&dir, "a1").unwrap();
    assert_eq!(r.text, "Primeiro, no B");
    assert_eq!(r.kobo_serial.as_deref(), Some(KOBO_A));

    lib.sync(KOBO_B, &snapshot(vec![]), &no_cover, no_progress).unwrap();
    assert_eq!(row(&dir, "a1").unwrap().removed_at, None, "only the origin Kobo marks removal");
}

#[test]
fn empty_text_counts_as_missing() {
    let (dir, mut lib, _) = setup();
    lib.sync(KOBO_A, &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]), &no_cover, no_progress)
        .unwrap();

    lib.sync(KOBO_A, &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "  ")])]), &no_cover, no_progress)
        .unwrap();

    let r = row(&dir, "a1").unwrap();
    assert!(r.removed_at.is_some());
    assert_eq!(r.text, "Primeiro", "the last real text is kept");
}

#[test]
fn same_book_by_other_path_joins_existing() {
    let (dir, mut lib, _) = setup();
    let a = common::kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")]);
    lib.sync(KOBO_A, &snapshot(vec![a]), &no_cover, no_progress).unwrap();

    let moved = kobo_book("file:///mnt/onboard/livros/confianca.epub", "CONFIANÇA", "Hernan Diaz", vec![hl("a9", "Outro")]);
    lib.sync(KOBO_B, &snapshot(vec![moved]), &no_cover, no_progress).unwrap();

    assert_eq!(book_count(&dir), 1);
    assert_eq!(row(&dir, "a1").unwrap().book_id, row(&dir, "a9").unwrap().book_id);
    let sources: u32 = library_conn(dir.path())
        .query_row("SELECT COUNT(*) FROM book_sources", [], |r| r.get(0))
        .unwrap();
    assert_eq!(sources, 2, "the new path is one more source of the book");
}

#[test]
fn unknown_titles_do_not_merge() {
    let (dir, mut lib, _) = setup();
    let snap = snapshot(vec![
        kobo_book("file:///mnt/onboard/x.pdf", "Unknown Title", "Unknown Author", vec![hl("x1", "X")]),
        kobo_book("file:///mnt/onboard/y.pdf", "Unknown Title", "Unknown Author", vec![hl("y1", "Y")]),
    ]);

    lib.sync(KOBO_A, &snap, &no_cover, no_progress).unwrap();

    assert_eq!(book_count(&dir), 2);
}

#[test]
fn metadata_refreshes_each_sync() {
    let (dir, mut lib, _) = setup();
    lib.sync(KOBO_A, &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]), &no_cover, no_progress)
        .unwrap();

    let mut refreshed = kobo_book(BOOK_A, "Confiança (edição revista)", "Hernán Díaz", vec![hl("a1", "Primeiro")]);
    refreshed.publisher = Some("Nova editora".into());
    refreshed.date_last_read = Some("2026-11-10T10:00:00Z".into());
    lib.sync(KOBO_A, &snapshot(vec![refreshed]), &no_cover, no_progress).unwrap();

    let (title, publisher, last_read): (String, Option<String>, Option<String>) = library_conn(dir.path())
        .query_row("SELECT title, publisher, date_last_read FROM books", [], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?))
        })
        .unwrap();
    assert_eq!(title, "Confiança (edição revista)");
    assert_eq!(publisher.as_deref(), Some("Nova editora"));
    assert_eq!(last_read.as_deref(), Some("2026-11-10T10:00:00Z"));
}

#[test]
fn book_without_highlights_stays() {
    let (dir, mut lib, _) = setup();
    lib.sync(KOBO_A, &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]), &no_cover, no_progress)
        .unwrap();

    lib.sync(KOBO_A, &snapshot(vec![]), &no_cover, no_progress).unwrap();

    assert_eq!(book_titles(&dir), vec!["Confiança".to_string()]);
}

#[test]
fn failed_sync_changes_nothing() {
    let (dir, mut lib, _) = setup();
    lib.sync(KOBO_A, &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]), &no_cover, no_progress)
        .unwrap();
    let before = (book_titles(&dir), row(&dir, "a1"));

    let snap = snapshot(vec![
        kobo_book(BOOK_A, "Outro título", "Hernán Díaz", vec![hl("a1", "Mudado")]),
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
    assert_eq!((book_titles(&dir), row(&dir, "a1")), before);
    assert_eq!(row(&dir, "b1"), None);
}

#[test]
fn unknown_kobo_is_rejected() {
    let (dir, mut lib, _) = setup();

    let err = lib
        .sync("NEVER-SEEN", &snapshot(vec![kobo_book(BOOK_A, "Confiança", "Hernán Díaz", vec![hl("a1", "Primeiro")])]), &no_cover, no_progress)
        .unwrap_err();

    assert!(matches!(err, LibraryError::NotFound));
    assert_eq!(book_count(&dir), 0);
}
