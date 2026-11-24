//! The evaluation Library (docs/plans/0003-mcp.md, test 15) built in code.

use khi_lib::library::eval_fixture::build_eval_library;
use khi_lib::library::Library;
use tempfile::TempDir;

fn built() -> (TempDir, Library) {
    let dir = TempDir::new().unwrap();
    let lib = build_eval_library(dir.path()).unwrap();
    (dir, lib)
}

fn all_books(lib: &Library) -> Vec<khi_lib::library::LibraryBook> {
    (1..=3).flat_map(|reader| lib.books(reader).unwrap()).collect()
}

fn highlight<'a>(
    books: &'a [khi_lib::library::LibraryBook],
    id: &str,
) -> &'a khi_lib::library::LibraryHighlight {
    books
        .iter()
        .flat_map(|b| &b.highlights)
        .find(|h| h.id == id)
        .unwrap_or_else(|| panic!("no highlight {id}"))
}

#[test]
fn builds_30_books_630_highlights() {
    let (_dir, lib) = built();
    let books = all_books(&lib);
    assert_eq!(books.len(), 30);
    assert_eq!(books.iter().map(|b| b.highlights.len()).sum::<usize>(), 630);
    assert_eq!(lib.list_readers().unwrap().len(), 3);
}

#[test]
fn unseen_matches_app_rule() {
    let (_dir, lib) = built();
    let books = all_books(&lib);
    let mut new: Vec<&str> = books
        .iter()
        .flat_map(|b| &b.highlights)
        .filter(|h| h.is_new)
        .map(|h| h.id.as_str())
        .collect();
    new.sort();
    assert_eq!(new, ["conf-03", "conf-04", "conf-05"]);
}

#[test]
fn removed_are_marked() {
    let (_dir, lib) = built();
    let books = all_books(&lib);
    let mut removed: Vec<&str> = books
        .iter()
        .flat_map(|b| &b.highlights)
        .filter(|h| h.removed_at.is_some())
        .map(|h| h.id.as_str())
        .collect();
    removed.sort();
    assert_eq!(removed, ["sap-05", "sap-06"]);
}

#[test]
fn long_highlight_length() {
    let (_dir, lib) = built();
    let books = all_books(&lib);
    assert_eq!(highlight(&books, "long-01").text.chars().count(), 4956);
}

#[test]
fn agents_are_allowed() {
    let (_dir, lib) = built();
    assert!(lib.allow_agents().unwrap());
}
