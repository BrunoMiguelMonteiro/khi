mod common;

use common::{hl, kobo_book, snapshot, BOOK_A};
use khi_lib::library::{Library, LibraryError};
use khi_lib::models::{KoboBook, KoboSnapshot};
use std::path::PathBuf;
use tempfile::TempDir;

fn no_cover(_: &KoboBook) -> Option<PathBuf> {
    None
}

fn confianca(ids: &[&str]) -> KoboSnapshot {
    snapshot(vec![kobo_book(
        BOOK_A,
        "Confiança",
        "Hernán Díaz",
        ids.iter().map(|id| hl(id, &format!("Texto {}", id))).collect(),
    )])
}

fn reader_with_kobo(lib: &Library, name: &str, serial: &str) -> u32 {
    let reader = lib.create_reader(name).unwrap();
    lib.associate_kobo(serial, reader.id).unwrap();
    reader.id
}

#[test]
fn library_readable_without_kobo() {
    let dir = TempDir::new().unwrap();
    let (reader_id, before) = {
        let mut lib = Library::open(dir.path()).unwrap();
        let reader_id = reader_with_kobo(&lib, "Bruno", "A");
        lib.sync("A", &confianca(&["a1", "a2"]), &no_cover, |_, _| {}).unwrap();
        (reader_id, lib.books(reader_id).unwrap())
    };

    let lib = Library::open(dir.path()).unwrap();
    let after = lib.books(reader_id).unwrap();

    assert_eq!(after, before);
    assert_eq!(after.len(), 1);
    assert_eq!(after[0].title, "Confiança");
    let ids: Vec<&str> = after[0].highlights.iter().map(|h| h.id.as_str()).collect();
    assert_eq!(ids, vec!["a1", "a2"]);
}

#[test]
fn two_readers_same_book_are_separate() {
    let dir = TempDir::new().unwrap();
    let mut lib = Library::open(dir.path()).unwrap();
    let bruno = reader_with_kobo(&lib, "Bruno", "A");
    let ana = reader_with_kobo(&lib, "Ana", "B");

    lib.sync("A", &confianca(&["a1"]), &no_cover, |_, _| {}).unwrap();
    lib.sync("B", &confianca(&["a1", "x2"]), &no_cover, |_, _| {}).unwrap();

    let bruno_books = lib.books(bruno).unwrap();
    let ana_books = lib.books(ana).unwrap();
    assert_eq!(bruno_books.len(), 1);
    assert_eq!(ana_books.len(), 1);
    assert_ne!(bruno_books[0].id, ana_books[0].id);
    assert_eq!(bruno_books[0].highlights.len(), 1);
    assert_eq!(ana_books[0].highlights.len(), 2);
    assert!(lib.books_by_ids(bruno, &[ana_books[0].id]).unwrap().is_empty());
}

#[test]
fn delete_refused_with_live_highlights() {
    let dir = TempDir::new().unwrap();
    let mut lib = Library::open(dir.path()).unwrap();
    let reader_id = reader_with_kobo(&lib, "Bruno", "A");
    lib.sync("A", &confianca(&["a1", "a2"]), &no_cover, |_, _| {}).unwrap();
    lib.sync("A", &confianca(&["a1"]), &no_cover, |_, _| {}).unwrap();
    let book_id = lib.books(reader_id).unwrap()[0].id;

    let err = lib.delete_book(reader_id, book_id).unwrap_err();

    assert!(matches!(err, LibraryError::BookHasLiveHighlights));
    assert_eq!(lib.books(reader_id).unwrap().len(), 1);
}

#[test]
fn delete_allowed_when_all_removed_and_cover_gone() {
    let dir = TempDir::new().unwrap();
    let images = TempDir::new().unwrap();
    let image = images.path().join("cover.jpg");
    std::fs::write(&image, b"cover").unwrap();
    let mut lib = Library::open(dir.path()).unwrap();
    let reader_id = reader_with_kobo(&lib, "Bruno", "A");
    lib.sync("A", &confianca(&["a1"]), &|_: &KoboBook| Some(image.clone()), |_, _| {}).unwrap();
    lib.sync("A", &snapshot(vec![]), &no_cover, |_, _| {}).unwrap();
    let book = lib.books(reader_id).unwrap().remove(0);
    let cover = PathBuf::from(book.cover_path.clone().expect("the cover was stored"));
    assert!(cover.exists());
    assert!(book.highlights[0].removed_at.is_some());

    lib.delete_book(reader_id, book.id).unwrap();

    assert!(lib.books(reader_id).unwrap().is_empty());
    assert!(!cover.exists());
    assert!(matches!(lib.delete_book(reader_id, book.id), Err(LibraryError::NotFound)));
}
