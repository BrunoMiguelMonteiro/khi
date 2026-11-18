mod common;

use common::{kobo_db, BOOK_A, BOOK_B};
use khi_lib::db::kobo::KoboDatabase;
use khi_lib::models::KoboSnapshot;

fn snapshot() -> KoboSnapshot {
    let dir = tempfile::TempDir::new().unwrap();
    let db = KoboDatabase::open_read_only(&kobo_db(dir.path())).unwrap();
    db.read_snapshot().unwrap()
}

#[test]
fn snapshot_groups_highlights_by_volume() {
    let snap = snapshot();

    assert_eq!(snap.books.len(), 2);
    let a = snap.books.iter().find(|b| b.volume_id == BOOK_A).unwrap();
    let b = snap.books.iter().find(|b| b.volume_id == BOOK_B).unwrap();
    assert_eq!(a.highlights.len(), 2);
    assert_eq!(b.highlights.len(), 1, "the empty-text bookmark is left out");
    assert_eq!(a.title, "Confiança");
    assert_eq!(a.author, "Hernán Díaz");
    assert_eq!(a.highlights[0].chapter_title.as_deref(), Some("Capítulo 1"));
}

#[test]
fn snapshot_reads_description_and_date_modified() {
    let snap = snapshot();

    let a = snap.books.iter().find(|b| b.volume_id == BOOK_A).unwrap();
    assert_eq!(a.description.as_deref(), Some("Uma descrição"));
    assert_eq!(a.isbn.as_deref(), Some("978-972-0-04567-8"));
    let a1 = a.highlights.iter().find(|h| h.bookmark_id == "a1").unwrap();
    assert_eq!(a1.date_modified.as_deref(), Some("2026-10-02T10:00:00Z"));
    assert_eq!(a1.annotation.as_deref(), Some("Nota a1"));
}

#[test]
fn snapshot_reads_image_id() {
    let snap = snapshot();

    let a = snap.books.iter().find(|b| b.volume_id == BOOK_A).unwrap();
    let b = snap.books.iter().find(|b| b.volume_id == BOOK_B).unwrap();
    assert_eq!(a.image_id.as_deref(), Some("c6c0e484-4956-40c0-83a0-c9b4e01c0645"));
    assert_eq!(b.image_id, None);
}
