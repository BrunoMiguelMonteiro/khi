//! Paginated reads of Readers and books through a read-only connection,
//! on the evaluation Library (and a bigger one for the paging cases).

mod common;

use common::{hl, kobo_book, snapshot, KOBO_A};
use khi_lib::library::eval_fixture::build_eval_library;
use khi_lib::library::read::{open_read_only, BookSort, ListBooks, ReadError, ReadLibrary};
use serde_json::Value;
use tempfile::TempDir;

const CEILING: usize = 16 * 1024;
const FORBIDDEN: [&str; 4] = ["serial", "exportPath", "coverPath", "containerPath"];

fn eval() -> (TempDir, ReadLibrary) {
    let dir = TempDir::new().unwrap();
    drop(build_eval_library(dir.path()).unwrap());
    let lib = open_read_only(dir.path()).unwrap();
    (dir, lib)
}

fn titles(page: &khi_lib::library::read::BooksPage) -> Vec<&str> {
    page.books.iter().map(|b| b.title.as_str()).collect()
}

fn hex(s: &str) -> String {
    s.bytes().map(|b| format!("{b:02x}")).collect()
}

fn hex_decode(s: &str) -> String {
    let bytes: Vec<u8> = (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap()).collect();
    String::from_utf8(bytes).unwrap()
}

fn keys(value: &Value, out: &mut Vec<String>) {
    match value {
        Value::Object(map) => {
            for (k, v) in map {
                out.push(k.clone());
                keys(v, out);
            }
        }
        Value::Array(items) => items.iter().for_each(|v| keys(v, out)),
        _ => {}
    }
}

fn assert_no_private_keys(value: &impl serde::Serialize) {
    let mut found = Vec::new();
    keys(&serde_json::to_value(value).unwrap(), &mut found);
    assert!(!found.is_empty());
    for key in FORBIDDEN {
        assert!(!found.iter().any(|k| k == key), "{key} leaked");
    }
}

fn size(value: &impl serde::Serialize) -> usize {
    serde_json::to_vec(value).unwrap().len()
}

#[test]
fn list_readers_counts_and_new_since() {
    let (_dir, lib) = eval();
    let readers = lib.list_readers().unwrap();
    let rows: Vec<_> = readers
        .iter()
        .map(|r| (r.name.as_str(), r.book_count, r.highlight_count, r.new_count))
        .collect();
    // Bruno's two removed Sapiens highlights are not counted as live.
    assert_eq!(rows, [("Bruno", 25, 611, 3), ("Ana", 4, 14, 0), ("Rui", 1, 3, 0)]);
    assert_eq!(readers[0].new_since.as_deref(), Some("2026-11-09T18:00:00Z"));
    assert_eq!(readers[1].new_since, None);
    assert_no_private_keys(&readers);
}

#[test]
fn list_books_filters_by_reader_and_new() {
    let (_dir, lib) = eval();
    let first = lib.list_books(&ListBooks::default()).unwrap();
    assert_eq!((first.total, first.books.len()), (30, 20), "the default limit is 20");
    assert!(first.next_cursor.is_some());
    let all = lib.list_books(&ListBooks { limit: Some(100), ..Default::default() }).unwrap();
    assert_eq!((all.total, all.books.len(), all.next_cursor), (30, 30, None));

    let ana = lib.list_books(&ListBooks { reader_id: Some(2), ..Default::default() }).unwrap();
    assert_eq!(ana.total, 4);
    assert!(ana.books.iter().all(|b| b.reader_id == 2));

    let new = lib.list_books(&ListBooks { has_new: true, ..Default::default() }).unwrap();
    assert_eq!(new.total, 1);
    let book = &new.books[0];
    assert_eq!((book.title.as_str(), book.reader_id, book.new_count), ("Confiança", 1, 3));
    assert_eq!((book.highlight_count, book.note_count, book.removed_count), (5, 1, 0));
}

#[test]
fn list_books_counts_removed_apart() {
    let (_dir, lib) = eval();
    let page = lib
        .list_books(&ListBooks { query: Some("sapiens".into()), reader_id: Some(1), ..Default::default() })
        .unwrap();
    let book = &page.books[0];
    assert_eq!((book.highlight_count, book.removed_count), (4, 2));
}

#[test]
fn list_books_query_ignores_accents_and_case() {
    let (_dir, lib) = eval();
    let by_author = lib
        .list_books(&ListBooks { query: Some("HERNAN diaz".into()), ..Default::default() })
        .unwrap();
    assert_eq!(titles(&by_author), ["Confiança", "Confiança"]);
    let by_title = lib
        .list_books(&ListBooks { query: Some("confianca".into()), ..Default::default() })
        .unwrap();
    assert_eq!(by_title.total, 2);
    let none = lib
        .list_books(&ListBooks { query: Some("guerra e paz".into()), ..Default::default() })
        .unwrap();
    assert_eq!((none.total, none.books.len()), (0, 0));
}

#[test]
fn list_books_has_three_orders() {
    let (_dir, lib) = eval();
    let bruno = ListBooks { reader_id: Some(1), ..Default::default() };

    let by_title = lib.list_books(&bruno).unwrap();
    assert_eq!(
        titles(&by_title)[..4],
        ["Confiança", "Duly Noted", "Ensaio sobre a Cegueira", "Livro do Desassossego"]
    );

    // Nothing in the fixture has a last-read date: the order falls back to title.
    let by_read = lib.list_books(&ListBooks { sort: BookSort::LastRead, ..bruno.clone() }).unwrap();
    assert_eq!(titles(&by_read), titles(&by_title));

    let by_count = lib.list_books(&ListBooks { sort: BookSort::HighlightCount, ..bruno }).unwrap();
    assert_eq!(by_count.books[0].title, "Ensaio sobre a Cegueira");
    assert_eq!(by_count.books[0].highlight_count, 120);
    assert_eq!(by_count.books[1].title, "Volume 01");
}

/// 150 one-highlight books in a Library the test writes itself.
fn big() -> (TempDir, ReadLibrary) {
    let (dir, mut lib, _) = common::setup();
    let books = (0..150)
        .map(|i| {
            kobo_book(
                &format!("file:///mnt/onboard/{i}.epub"),
                &format!("Book {i:03} with a rather long title to fill the page"),
                "Some Author",
                vec![hl(&format!("h{i}"), "text")],
            )
        })
        .collect();
    lib.sync(KOBO_A, &snapshot(books), &common::no_cover, common::no_progress).unwrap();
    let read = open_read_only(dir.path()).unwrap();
    (dir, read)
}

#[test]
fn limit_above_max_and_cursor_to_null() {
    let (_dir, lib) = big();
    let mut seen = Vec::new();
    let mut cursor = None;
    let mut pages = 0;
    loop {
        let page = lib
            .list_books(&ListBooks { limit: Some(1000), cursor: cursor.clone(), ..Default::default() })
            .unwrap();
        assert!(page.books.len() <= 100, "limit above the max stays at the max");
        assert_eq!(page.total, 150);
        assert!(size(&page) <= CEILING, "page of {} bytes", size(&page));
        seen.extend(page.books.iter().map(|b| b.id));
        pages += 1;
        match page.next_cursor {
            Some(c) => cursor = Some(c),
            None => break,
        }
    }
    assert!(pages >= 2);
    let mut unique = seen.clone();
    unique.sort();
    unique.dedup();
    assert_eq!((seen.len(), unique.len()), (150, 150));
}

#[test]
fn ceiling_cuts_the_page_before_the_limit() {
    let (_dir, lib) = big();
    let page = lib.list_books(&ListBooks { limit: Some(100), ..Default::default() }).unwrap();
    assert!(page.books.len() < 100, "100 summaries do not fit in 16 KB");
    assert!(page.next_cursor.is_some());
    assert!(size(&page) <= CEILING);
}

#[test]
fn bad_cursor_is_invalid_cursor() {
    let (_dir, lib) = eval();
    for cursor in ["zz", "", "not hex!", &hex("v2:3"), &hex("v1:abc"), &hex("v1:-1"), &hex("v1:3"), &hex("garbage")] {
        let result = lib.list_books(&ListBooks { cursor: Some(cursor.to_string()), ..Default::default() });
        assert!(matches!(result, Err(ReadError::InvalidCursor)), "{cursor:?}: {result:?}");
    }
    // A well-formed cursor past the end is just an empty last page.
    let real = lib.list_books(&ListBooks { limit: Some(5), ..Default::default() }).unwrap().next_cursor.unwrap();
    let fingerprint = hex_decode(&real).rsplit(':').next().unwrap().to_string();
    let page = lib
        .list_books(&ListBooks { cursor: Some(hex(&format!("v1:500:{fingerprint}"))), ..Default::default() })
        .unwrap();
    assert_eq!((page.books.len(), page.next_cursor), (0, None));
}

#[test]
fn no_private_keys_in_books() {
    let (_dir, lib) = eval();
    assert_no_private_keys(&lib.list_books(&ListBooks::default()).unwrap());
}

#[test]
fn reads_check_the_schema_each_call() {
    let (dir, lib) = eval();
    let conn = rusqlite::Connection::open(dir.path().join("library.sqlite")).unwrap();
    conn.pragma_update(None, "user_version", 3).unwrap();
    assert!(matches!(lib.list_readers(), Err(ReadError::SchemaMismatch { .. })));
    assert!(matches!(lib.list_books(&ListBooks::default()), Err(ReadError::SchemaMismatch { .. })));
}

#[test]
fn book_without_highlights_has_zero_counts() {
    let (dir, _lib, reader) = common::setup();
    // The app never writes such a book today; a future change might.
    common::library_conn(dir.path())
        .execute(
            "INSERT INTO books (reader_id, title, author) VALUES (?1, 'Empty', 'Nobody')",
            [reader],
        )
        .unwrap();
    let lib = open_read_only(dir.path()).unwrap();
    let page = lib.list_books(&ListBooks::default()).unwrap();
    let book = &page.books[0];
    assert_eq!(book.title, "Empty");
    assert_eq!((book.highlight_count, book.note_count, book.new_count, book.removed_count), (0, 0, 0, 0));
    let readers = lib.list_readers().unwrap();
    assert_eq!((readers[0].book_count, readers[0].highlight_count, readers[0].new_count), (1, 0, 0));
}
