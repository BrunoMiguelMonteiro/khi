//! `get_book` and `new_highlights` through a read-only connection.

mod common;

use common::{hl, kobo_book, no_cover, no_progress, snapshot, KOBO_A};
use khi_lib::library::eval_fixture::build_eval_library;
use khi_lib::library::read::{
    open_read_only, GetBook, ListBooks, NewHighlights, NewMode, ReadError, ReadLibrary,
};
use khi_lib::models::KoboHighlight;
use serde_json::Value;
use tempfile::TempDir;

const CEILING: usize = 16 * 1024;

fn eval() -> (TempDir, khi_lib::library::Library, ReadLibrary) {
    let dir = TempDir::new().unwrap();
    let app = build_eval_library(dir.path()).unwrap();
    let lib = open_read_only(dir.path()).unwrap();
    (dir, app, lib)
}

/// The id of the book titled `title` that belongs to `reader`.
fn book_id(lib: &ReadLibrary, reader: u32, title: &str) -> u32 {
    let page = lib
        .list_books(&ListBooks { reader_id: Some(reader), query: Some(title.into()), ..Default::default() })
        .unwrap();
    page.books[0].id
}

fn size(value: &impl serde::Serialize) -> usize {
    serde_json::to_vec(value).unwrap().len()
}

fn ids(page: &khi_lib::library::read::BookPage) -> Vec<&str> {
    page.highlights.iter().map(|h| h.id.as_str()).collect()
}

fn keys(value: &Value, out: &mut Vec<String>) {
    match value {
        Value::Object(map) => map.iter().for_each(|(k, v)| {
            out.push(k.clone());
            keys(v, out);
        }),
        Value::Array(items) => items.iter().for_each(|v| keys(v, out)),
        _ => {}
    }
}

fn kobo_hl(id: &str, text: &str, progress: Option<f64>, date: &str) -> KoboHighlight {
    KoboHighlight {
        bookmark_id: id.into(),
        text: text.into(),
        chapter_progress: progress,
        date_created: date.into(),
        ..Default::default()
    }
}

#[test]
fn get_book_follows_the_app_order_with_id_tiebreak() {
    let (dir, mut app, _) = common::setup();
    let book = kobo_book(
        "file:///mnt/onboard/a.epub",
        "Order",
        "A",
        vec![
            kobo_hl("late", "t", Some(0.9), "2026-10-01T10:00:00Z"),
            kobo_hl("b", "t", Some(0.5), "2026-10-01T10:00:00Z"),
            kobo_hl("a", "t", Some(0.5), "2026-10-01T10:00:00Z"),
            kobo_hl("earlier", "t", Some(0.5), "2026-09-01T10:00:00Z"),
        ],
    );
    app.sync(KOBO_A, &snapshot(vec![book]), &no_cover, no_progress).unwrap();
    let lib = open_read_only(dir.path()).unwrap();
    let id = book_id(&lib, 1, "order");
    let page = lib.get_book(&GetBook { book_id: id, ..Default::default() }).unwrap();
    assert_eq!(ids(&page), ["earlier", "a", "b", "late"]);
}

#[test]
fn get_book_include_removed() {
    let (_dir, _app, lib) = eval();
    let id = book_id(&lib, 1, "sapiens");
    let all = lib.get_book(&GetBook { book_id: id, ..Default::default() }).unwrap();
    assert_eq!(all.highlights.len(), 6);
    let removed: Vec<_> = all.highlights.iter().filter(|h| h.removed).map(|h| h.id.as_str()).collect();
    assert_eq!(removed, ["sap-05", "sap-06"]);
    let live = lib
        .get_book(&GetBook { book_id: id, include_removed: false, ..Default::default() })
        .unwrap();
    assert_eq!(live.highlights.len(), 4);
    assert!(live.highlights.iter().all(|h| !h.removed));
}

#[test]
fn get_book_ceiling_cuts_the_page() {
    let (_dir, _app, lib) = eval();
    let id = book_id(&lib, 1, "cegueira");
    let mut seen = Vec::new();
    let mut cursor = None;
    let mut pages = 0;
    loop {
        let page = lib
            .get_book(&GetBook { book_id: id, limit: Some(1000), cursor: cursor.clone(), ..Default::default() })
            .unwrap();
        assert!(size(&page) <= CEILING, "{} bytes", size(&page));
        assert_eq!(page.book.summary.highlight_count, 120);
        seen.extend(page.highlights.iter().map(|h| h.id.clone()));
        pages += 1;
        match page.next_cursor {
            Some(c) => cursor = Some(c),
            None => break,
        }
    }
    assert!(pages >= 2, "120 highlights do not fit in one 16 KB page");
    assert_eq!(seen.len(), 120);
    assert_eq!(seen.last().unwrap(), "cego-120");
}

#[test]
fn get_book_keeps_long_text_whole_and_cuts_the_description() {
    let (dir, mut app, _) = common::setup();
    let mut book = kobo_book("file:///mnt/onboard/d.epub", "Long", "A", vec![hl("x", &"é".repeat(5000))]);
    book.description = Some("d".repeat(3000));
    app.sync(KOBO_A, &snapshot(vec![book]), &no_cover, no_progress).unwrap();
    let lib = open_read_only(dir.path()).unwrap();
    let id = book_id(&lib, 1, "long");
    let page = lib.get_book(&GetBook { book_id: id, ..Default::default() }).unwrap();
    assert_eq!(page.highlights[0].text.chars().count(), 5000);
    assert!(!page.highlights[0].truncated);
    assert_eq!(page.book.description.as_deref().unwrap().chars().count(), 1000);
}

#[test]
fn get_book_unknown_id_is_not_found() {
    let (_dir, _app, lib) = eval();
    let result = lib.get_book(&GetBook { book_id: 99999, ..Default::default() });
    assert!(matches!(result, Err(ReadError::NotFound)), "{result:?}");
}

#[test]
fn get_book_has_no_private_keys() {
    let (_dir, _app, lib) = eval();
    let id = book_id(&lib, 1, "confianca");
    let page = lib.get_book(&GetBook { book_id: id, ..Default::default() }).unwrap();
    let mut found = Vec::new();
    keys(&serde_json::to_value(&page).unwrap(), &mut found);
    for wanted in ["id", "bookId", "text", "note", "chapter", "progress", "dateCreated", "syncedAt", "isNew", "removed", "truncated"] {
        assert!(found.iter().any(|k| k == wanted), "missing {wanted}");
    }
    for key in ["serial", "exportPath", "coverPath", "containerPath", "kobo_serial", "koboSerial"] {
        assert!(!found.iter().any(|k| k == key), "{key} leaked");
    }
}

/// Test 8: the agent's `isNew` is the app's `is_new`, highlight by highlight.
#[test]
fn is_new_matches_the_app_for_every_highlight() {
    let (_dir, app, lib) = eval();
    let mut compared = 0;
    for reader in 1..=3 {
        for app_book in app.books(reader).unwrap() {
            let mut cursor = None;
            let mut theirs = Vec::new();
            loop {
                let page = lib
                    .get_book(&GetBook { book_id: app_book.id, limit: Some(200), cursor: cursor.clone(), ..Default::default() })
                    .unwrap();
                theirs.extend(page.highlights);
                match page.next_cursor {
                    Some(c) => cursor = Some(c),
                    None => break,
                }
            }
            assert_eq!(theirs.len(), app_book.highlights.len());
            for h in &app_book.highlights {
                let mine = theirs.iter().find(|t| t.id == h.id).unwrap();
                assert_eq!(mine.is_new, h.is_new, "{}", h.id);
                assert_eq!(mine.removed, h.removed_at.is_some(), "{}", h.id);
                compared += 1;
            }
        }
    }
    assert_eq!(compared, 630);
}

fn new_ids(page: &khi_lib::library::read::NewPage) -> Vec<&str> {
    page.groups.iter().flat_map(|g| g.highlights.iter().map(|h| h.id.as_str())).collect()
}

#[test]
fn new_highlights_unseen_is_the_app_rule() {
    let (_dir, _app, lib) = eval();
    let page = lib.new_highlights(&NewHighlights::default()).unwrap();
    assert_eq!(page.total_highlights, 3);
    assert_eq!(page.groups.len(), 1);
    assert_eq!(page.groups[0].book.title, "Confiança");
    assert_eq!(new_ids(&page), ["conf-03", "conf-04", "conf-05"]);
    assert!(page.groups[0].highlights.iter().all(|h| h.is_new));
    let other = lib.new_highlights(&NewHighlights { reader_id: Some(2), ..Default::default() }).unwrap();
    assert_eq!((other.total_highlights, other.groups.len()), (0, 0));
}

#[test]
fn new_highlights_synced_since_groups_by_book_and_skips_null() {
    let (_dir, _app, lib) = eval();
    let since = |s: &str| NewHighlights { mode: NewMode::SyncedSince(s.into()), reader_id: Some(1), ..Default::default() };

    let page = lib.new_highlights(&since("2026-11-01")).unwrap();
    assert_eq!(page.total_highlights, 5);
    let titles: Vec<_> = page.groups.iter().map(|g| g.book.title.as_str()).collect();
    assert_eq!(titles, ["Confiança", "Duly Noted"]);
    assert_eq!(new_ids(&page), ["conf-03", "conf-04", "conf-05", "duly-03", "duly-04"]);
    // Opened or not does not matter: duly-03 was seen, and is still listed.
    assert!(!page.groups[1].highlights[0].is_new);

    // A date-time works, and an early date still leaves out the first
    // sync's highlights, whose synced_at is NULL.
    assert_eq!(lib.new_highlights(&since("2026-11-09T18:00:00Z")).unwrap().total_highlights, 5);
    assert_eq!(lib.new_highlights(&since("2026-11-09T18:00:01Z")).unwrap().total_highlights, 0);
    assert_eq!(lib.new_highlights(&since("2026-01-01")).unwrap().total_highlights, 5);
}

#[test]
fn new_highlights_since_accepts_minutes_and_offsets() {
    let (_dir, _app, lib) = eval();
    let total = |s: &str| {
        lib.new_highlights(&NewHighlights { mode: NewMode::SyncedSince(s.into()), reader_id: Some(1), ..Default::default() })
            .unwrap_or_else(|e| panic!("{s:?}: {e:?}"))
            .total_highlights
    };
    // The newest sync is at 2026-11-09T18:00:00Z. A date-time with no zone is UTC.
    assert_eq!(total("2026-11-09T18:00"), 5);
    assert_eq!(total("2026-11-09T18:01"), 0);
    assert_eq!(total("2026-11-09T18:00:00"), 5);
    assert_eq!(total("2026-11-09T18:00:01"), 0);
    assert_eq!(total("2026-11-09T18:00Z"), 5);
    assert_eq!(total("2026-11-09T18:01Z"), 0);
    assert_eq!(total("2026-11-09T18:00:00Z"), 5);
    assert_eq!(total("2026-11-09T19:00+01:00"), 5);
    assert_eq!(total("2026-11-09T19:01+01:00"), 0);
    assert_eq!(total("2026-11-09T19:00:00+01:00"), 5);
    assert_eq!(total("2026-11-09T19:00:01+01:00"), 0);
}

#[test]
fn new_highlights_rejects_a_bad_date() {
    let (_dir, _app, lib) = eval();
    for bad in ["yesterday", "2026-13-40", "", "01/11/2026"] {
        let result = lib.new_highlights(&NewHighlights { mode: NewMode::SyncedSince(bad.into()), ..Default::default() });
        assert!(matches!(result, Err(ReadError::InvalidDate)), "{bad:?}: {result:?}");
    }
}

/// Two syncs: the second brings 30 new highlights (two books), one of them huge.
fn library_with_news() -> (TempDir, ReadLibrary) {
    let (dir, mut app, _) = common::setup();
    let first = kobo_book("file:///mnt/onboard/a.epub", "Alpha", "A", vec![hl("a0", "old")]);
    app.sync(KOBO_A, &snapshot(vec![first.clone()]), &no_cover, no_progress).unwrap();
    let mut alpha = first;
    for i in 1..=20 {
        alpha.highlights.push(hl(&format!("a{i:02}"), "new"));
    }
    alpha.highlights.push(hl("huge", &"x".repeat(5000)));
    let beta = kobo_book(
        "file:///mnt/onboard/b.epub",
        "Beta",
        "B",
        (1..=10).map(|i| hl(&format!("b{i:02}"), "new")).collect(),
    );
    app.sync(KOBO_A, &snapshot(vec![alpha, beta]), &no_cover, no_progress).unwrap();
    let lib = open_read_only(dir.path()).unwrap();
    (dir, lib)
}

#[test]
fn new_highlights_cuts_long_text_and_counts_highlights_in_the_limit() {
    let (_dir, lib) = library_with_news();
    let first = lib.new_highlights(&NewHighlights { limit: Some(10), ..Default::default() }).unwrap();
    assert_eq!(first.total_highlights, 31);
    assert_eq!(new_ids(&first).len(), 10, "the limit counts highlights, not books");
    assert!(first.next_cursor.is_some());

    let mut cursor = None;
    let mut all = Vec::new();
    loop {
        let page = lib
            .new_highlights(&NewHighlights { limit: Some(100), cursor: cursor.clone(), ..Default::default() })
            .unwrap();
        assert!(size(&page) <= CEILING);
        for g in &page.groups {
            all.extend(g.highlights.iter().cloned());
        }
        match page.next_cursor {
            Some(c) => cursor = Some(c),
            None => break,
        }
    }
    assert_eq!(all.len(), 31);
    let huge = all.iter().find(|h| h.id == "huge").unwrap();
    assert!(huge.truncated);
    assert_eq!(huge.text.chars().count(), 2000);
    assert!(all.iter().filter(|h| h.id != "huge").all(|h| !h.truncated));
}

#[test]
fn new_highlights_bad_cursor() {
    let (_dir, _app, lib) = eval();
    let result = lib.new_highlights(&NewHighlights { cursor: Some("nope".into()), ..Default::default() });
    assert!(matches!(result, Err(ReadError::InvalidCursor)));
}
