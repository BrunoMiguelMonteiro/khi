mod common;

use khi_lib::commands::library::{get_library_with, sync_kobo_with};
use khi_lib::library::Library;
use khi_lib::models::KoboDevice;
use std::sync::{Arc, Barrier};
use std::time::{Duration, Instant};
use tempfile::TempDir;

const SERIAL: &str = "N4181B5025147";

/// A fake mounted Kobo (`<dir>/.kobo/KoboReader.sqlite`) already associated
/// with a Reader in the Library at `data`.
fn kobo_and_library() -> (TempDir, TempDir, TempDir, KoboDevice, u32) {
    let volume = TempDir::new().unwrap();
    let kobo_dir = volume.path().join(".kobo");
    std::fs::create_dir_all(&kobo_dir).unwrap();
    common::kobo_db(&kobo_dir);

    let data = TempDir::new().unwrap();
    let lib = Library::open(data.path()).unwrap();
    let reader = lib.create_reader("Bruno").unwrap();
    lib.associate_kobo(SERIAL, reader.id).unwrap();

    let device = KoboDevice {
        name: "KOBOeReader".into(),
        path: volume.path().to_string_lossy().into_owned(),
        is_valid: true,
        serial_number: Some(SERIAL.into()),
    };
    (volume, data, TempDir::new().unwrap(), device, reader.id)
}

#[test]
fn sync_kobo_with_reads_fixture() {
    let (_volume, data, cache, device, _) = kobo_and_library();

    let report = sync_kobo_with(data.path(), cache.path(), &device, |_, _| {}).unwrap();

    assert_eq!(report.added, 3);
    assert_eq!(report.books, 2);
}

#[test]
fn cover_comes_from_kobo_images_without_an_epub() {
    let (volume, data, cache, device, reader_id) = kobo_and_library();
    // Where a Kobo Libra 2 keeps this ImageId: the folders come from it,
    // not from the book's ContentID
    let images = volume.path().join(".kobo-images/85/194");
    std::fs::create_dir_all(&images).unwrap();
    std::fs::write(images.join("c6c0e484-4956-40c0-83a0-c9b4e01c0645 - N3_FULL.parsed"), b"jpeg").unwrap();

    sync_kobo_with(data.path(), cache.path(), &device, |_, _| {}).unwrap();

    let lib = Library::open(data.path()).unwrap();
    let books = lib.books(reader_id).unwrap();
    let a = books.iter().find(|b| b.title == "Confiança").unwrap();
    let cover = a.cover_path.as_deref().expect("cover from .kobo-images");
    assert_eq!(std::fs::read(cover).unwrap(), b"jpeg");
    let b = books.iter().find(|b| b.title == "Duly Noted").unwrap();
    assert_eq!(b.cover_path, None, "no ImageId, no EPUB, no cover");
}

#[test]
fn reads_do_not_wait_for_sync() {
    let (_volume, data, cache, device, reader_id) = kobo_and_library();
    let inside_tx = Arc::new(Barrier::new(2));
    let release = Arc::new(Barrier::new(2));

    let sync = {
        let (inside_tx, release) = (inside_tx.clone(), release.clone());
        let (data, cache) = (data.path().to_path_buf(), cache.path().to_path_buf());
        std::thread::spawn(move || {
            sync_kobo_with(&data, &cache, &device, |done, _| {
                if done == 1 {
                    inside_tx.wait();
                    release.wait();
                }
            })
        })
    };

    inside_tx.wait();
    let started = Instant::now();
    let reader_lib = Library::open(data.path()).unwrap();
    let books = get_library_with(&reader_lib, reader_id);
    let elapsed = started.elapsed();
    release.wait();

    assert!(books.is_ok(), "read failed during sync: {:?}", books.err());
    assert!(elapsed < Duration::from_secs(1), "read waited {:?} for the sync", elapsed);
    assert_eq!(sync.join().unwrap().unwrap().added, 3);
}
