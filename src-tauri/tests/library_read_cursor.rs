//! A cursor belongs to the call that made it: same method, same sort and
//! filters. Anything else is an InvalidCursor, never a silently wrong page.

use khi_lib::library::eval_fixture::build_eval_library;
use khi_lib::library::read::{
    open_read_only, BookSort, GetBook, ListBooks, NewHighlights, NewMode, ReadError, ReadLibrary, SearchIn,
    SearchParams,
};
use tempfile::TempDir;

fn eval() -> (TempDir, ReadLibrary) {
    let dir = TempDir::new().unwrap();
    drop(build_eval_library(dir.path()).unwrap());
    let lib = open_read_only(dir.path()).unwrap();
    (dir, lib)
}

fn unhex(cursor: &str) -> String {
    let bytes: Vec<u8> = (0..cursor.len()).step_by(2).map(|i| u8::from_str_radix(&cursor[i..i + 2], 16).unwrap()).collect();
    String::from_utf8(bytes).unwrap()
}

/// The same cursor with another offset, whatever follows it kept as it was.
fn with_offset(cursor: &str, offset: &str) -> String {
    let text = unhex(cursor);
    let mut parts: Vec<&str> = text.split(':').collect();
    parts[1] = offset;
    parts.join(":").bytes().map(|b| format!("{b:02x}")).collect()
}

fn invalid<T: std::fmt::Debug>(result: Result<T, ReadError>, what: &str) {
    assert!(matches!(result, Err(ReadError::InvalidCursor)), "{what}: {result:?}");
}

const HUGE: [&str; 3] = ["18446744073709551615", "9223372036854775808", "99999999999999999999"];

fn books(lib: &ReadLibrary, p: ListBooks) -> Result<khi_lib::library::read::BooksPage, ReadError> {
    lib.list_books(&ListBooks { limit: Some(5), ..p })
}

#[test]
fn list_books_cursor_is_bound_to_sort_and_filters() {
    let (_dir, lib) = eval();
    let by_title = ListBooks { sort: BookSort::Title, ..Default::default() };
    let cursor = books(&lib, by_title.clone()).unwrap().next_cursor.unwrap();
    let with = |p: ListBooks| books(&lib, ListBooks { cursor: Some(cursor.clone()), ..p });

    assert!(with(by_title.clone()).is_ok(), "unchanged");
    let wider = lib.list_books(&ListBooks { limit: Some(7), cursor: Some(cursor.clone()), ..by_title.clone() });
    assert!(wider.is_ok(), "the limit may change");
    invalid(with(ListBooks { sort: BookSort::LastRead, ..by_title.clone() }), "sort lastRead");
    invalid(with(ListBooks { sort: BookSort::HighlightCount, ..by_title.clone() }), "sort highlightCount");
    invalid(with(ListBooks { query: Some("a".into()), ..by_title.clone() }), "query");
    invalid(with(ListBooks { reader_id: Some(1), ..by_title.clone() }), "readerId");
    invalid(with(ListBooks { has_new: true, ..by_title.clone() }), "hasNew");
    for offset in HUGE {
        invalid(with_cursor_list(&lib, &with_offset(&cursor, offset)), offset);
    }
    // A real offset past the end is still an empty last page.
    let past = books(&lib, ListBooks { cursor: Some(with_offset(&cursor, "500")), ..by_title }).unwrap();
    assert_eq!((past.books.len(), past.next_cursor), (0, None));
}

fn with_cursor_list(lib: &ReadLibrary, cursor: &str) -> Result<khi_lib::library::read::BooksPage, ReadError> {
    lib.list_books(&ListBooks { cursor: Some(cursor.into()), ..Default::default() })
}

fn cego(lib: &ReadLibrary) -> u32 {
    lib.list_books(&ListBooks { reader_id: Some(1), query: Some("cegueira".into()), ..Default::default() })
        .unwrap()
        .books[0]
        .id
}

#[test]
fn get_book_cursor_is_bound_to_the_book_and_include_removed() {
    let (_dir, lib) = eval();
    let id = cego(&lib);
    let first = GetBook { book_id: id, limit: Some(10), ..Default::default() };
    let cursor = lib.get_book(&first).unwrap().next_cursor.unwrap();
    let with = |p: GetBook| lib.get_book(&GetBook { cursor: Some(cursor.clone()), ..p });

    assert!(with(first.clone()).is_ok(), "unchanged");
    invalid(with(GetBook { include_removed: false, ..first.clone() }), "includeRemoved");
    let other = lib.list_books(&ListBooks { reader_id: Some(1), query: Some("sapiens".into()), ..Default::default() }).unwrap().books[0].id;
    invalid(with(GetBook { book_id: other, ..first.clone() }), "bookId");
    for offset in HUGE {
        invalid(lib.get_book(&GetBook { cursor: Some(with_offset(&cursor, offset)), ..first.clone() }), offset);
    }
    // Another method's cursor is not this one's.
    let list_cursor = books(&lib, ListBooks::default()).unwrap().next_cursor.unwrap();
    invalid(lib.get_book(&GetBook { cursor: Some(list_cursor), ..first }), "cursor of list_books");
}

#[test]
fn search_cursor_is_bound_to_the_query_and_filters() {
    let (_dir, lib) = eval();
    let find = |query: &str| SearchParams { query: query.into(), limit: Some(2), ..Default::default() };
    let first = find("de");
    let cursor = lib.search_highlights(&first).unwrap().next_cursor.expect("more than 2 hits");
    let with = |p: SearchParams| lib.search_highlights(&SearchParams { cursor: Some(cursor.clone()), ..p });

    assert!(with(first.clone()).is_ok(), "unchanged");
    invalid(with(find("da")), "query");
    invalid(with(SearchParams { search_in: SearchIn::Text, ..first.clone() }), "in");
    invalid(with(SearchParams { reader_id: Some(1), ..first.clone() }), "readerId");
    invalid(with(SearchParams { book_id: Some(cego(&lib)), ..first.clone() }), "bookId");
    invalid(with(SearchParams { include_removed: false, ..first.clone() }), "includeRemoved");
    for offset in HUGE {
        invalid(lib.search_highlights(&SearchParams { cursor: Some(with_offset(&cursor, offset)), ..first.clone() }), offset);
    }
}

#[test]
fn new_highlights_cursor_is_bound_to_the_mode_since_and_reader() {
    let (_dir, lib) = eval();
    let since = |d: &str| NewHighlights {
        mode: NewMode::SyncedSince(d.into()),
        limit: Some(3),
        ..Default::default()
    };
    let first = since("2000-01-01");
    let cursor = lib.new_highlights(&first).unwrap().next_cursor.expect("more than 3 new");
    let with = |p: NewHighlights| lib.new_highlights(&NewHighlights { cursor: Some(cursor.clone()), ..p });

    assert!(with(first.clone()).is_ok(), "unchanged");
    invalid(with(since("2001-01-01")), "since");
    invalid(with(NewHighlights { mode: NewMode::Unseen, limit: Some(3), ..Default::default() }), "mode");
    invalid(with(NewHighlights { reader_id: Some(1), ..first.clone() }), "readerId");
    for offset in HUGE {
        invalid(lib.new_highlights(&NewHighlights { cursor: Some(with_offset(&cursor, offset)), ..first.clone() }), offset);
    }
}
