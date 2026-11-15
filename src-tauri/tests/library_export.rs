mod common;

use common::{hl, kobo_book, snapshot, BOOK_A};
use khi_lib::library::{safe_dir_name, Library};
use khi_lib::models::{DateFormat, ExportConfig, KoboBook, KoboSnapshot, Language, MetadataConfig};
use std::path::PathBuf;
use tempfile::TempDir;

fn no_cover(_: &KoboBook) -> Option<PathBuf> {
    None
}

fn config(base: &std::path::Path) -> ExportConfig {
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

fn confianca(ids: &[&str]) -> KoboSnapshot {
    snapshot(vec![kobo_book(
        BOOK_A,
        "Confiança",
        "Hernán Díaz",
        ids.iter().map(|id| hl(id, &format!("Texto {}", id))).collect(),
    )])
}

/// A Library whose Reader `name` has synced Confiança with `ids`.
fn synced(dir: &TempDir, name: &str, ids: &[&str]) -> (Library, u32, u32) {
    let mut lib = Library::open(dir.path()).unwrap();
    let reader = lib.create_reader(name).unwrap();
    lib.associate_kobo("A", reader.id).unwrap();
    lib.sync("A", &confianca(ids), &no_cover, |_, _| {}).unwrap();
    let book_id = lib.books(reader.id).unwrap()[0].id;
    (lib, reader.id, book_id)
}

#[test]
fn export_uses_reader_folder_by_default() {
    let dir = TempDir::new().unwrap();
    let base = TempDir::new().unwrap();
    let (lib, reader_id, book_id) = synced(&dir, "Bruno", &["a1"]);

    let files = lib.export(reader_id, &[book_id], &config(base.path()), Language::Pt).unwrap();

    assert_eq!(files.len(), 1);
    assert_eq!(files[0].parent().unwrap(), base.path().join("Bruno"));
    assert!(files[0].is_file());
}

#[test]
fn export_uses_custom_reader_folder() {
    let dir = TempDir::new().unwrap();
    let base = TempDir::new().unwrap();
    let custom = TempDir::new().unwrap();
    let (lib, reader_id, book_id) = synced(&dir, "Bruno", &["a1"]);
    lib.set_reader_export_path(reader_id, Some(&custom.path().to_string_lossy()))
        .unwrap();

    let files = lib.export(reader_id, &[book_id], &config(base.path()), Language::Pt).unwrap();

    assert_eq!(files[0].parent().unwrap(), custom.path());
}

#[test]
fn reader_name_with_slash_is_one_folder() {
    assert_eq!(safe_dir_name("  Ana/Bruno: casa "), "Ana-Bruno- casa");

    let dir = TempDir::new().unwrap();
    let base = TempDir::new().unwrap();
    let (lib, reader_id, _) = synced(&dir, "Ana/Bruno", &["a1"]);

    let export_dir = lib.export_dir(reader_id, &base.path().to_string_lossy()).unwrap();

    assert_eq!(export_dir.parent().unwrap(), base.path());
    assert_eq!(export_dir.file_name().unwrap(), "Ana-Bruno");
}

#[test]
fn export_includes_removed_highlights() {
    let dir = TempDir::new().unwrap();
    let base = TempDir::new().unwrap();
    let (mut lib, reader_id, book_id) = synced(&dir, "Bruno", &["a1", "a2"]);
    lib.sync("A", &confianca(&["a1"]), &no_cover, |_, _| {}).unwrap();

    let files = lib.export(reader_id, &[book_id], &config(base.path()), Language::Pt).unwrap();

    let markdown = std::fs::read_to_string(&files[0]).unwrap();
    assert!(markdown.contains("Texto a1"));
    assert!(markdown.contains("Texto a2"), "D1: removed highlights are exported");
}

#[test]
fn same_ids_same_config_same_bytes() {
    let dir = TempDir::new().unwrap();
    let base = TempDir::new().unwrap();
    let (lib, reader_id, book_id) = synced(&dir, "Bruno", &["a1", "a2"]);
    let cfg = config(base.path());

    let first = std::fs::read(&lib.export(reader_id, &[book_id], &cfg, Language::En).unwrap()[0]).unwrap();
    let second = std::fs::read(&lib.export(reader_id, &[book_id], &cfg, Language::En).unwrap()[0]).unwrap();

    assert_eq!(first, second);
}

#[test]
fn export_writes_the_chosen_language() {
    let dir = TempDir::new().unwrap();
    let base = TempDir::new().unwrap();
    let (lib, reader_id, book_id) = synced(&dir, "Bruno", &["a1"]);
    let cfg = config(base.path());

    let en = std::fs::read_to_string(&lib.export(reader_id, &[book_id], &cfg, Language::En).unwrap()[0]).unwrap();
    let pt = std::fs::read_to_string(&lib.export(reader_id, &[book_id], &cfg, Language::Pt).unwrap()[0]).unwrap();

    assert!(en.contains("**Author**: "), "{en}");
    assert!(pt.contains("**Autor**: "), "{pt}");
}
