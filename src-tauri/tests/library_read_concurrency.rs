//! The khi-mcp reads while the app writes (docs/plans/0003-mcp.md, tests 2 and 3).

mod common;

use common::{hl, kobo_book, no_cover, no_progress, snapshot, KOBO_A};
use khi_lib::library::read::{open_read_only, GetBook, ListBooks};
use khi_lib::library::Library;
use std::sync::mpsc;
use std::time::{Duration, Instant};
use tempfile::TempDir;

const BOOK: &str = "file:///mnt/onboard/a.epub";

fn book(count: usize) -> khi_lib::models::KoboBook {
    kobo_book(BOOK, "Alpha", "A", (0..count).map(|i| hl(&format!("h{i}"), "text")).collect())
}

/// A Library with one Reader and a book of 3 highlights, closed again.
fn library_dir() -> TempDir {
    let (dir, mut lib, _) = common::setup();
    lib.sync(KOBO_A, &snapshot(vec![book(3)]), &no_cover, no_progress).unwrap();
    drop(lib);
    dir
}

/// Test 2: a Sync holds its write transaction open; reads do not wait, show
/// the state before it, and show the new one after the commit.
#[test]
fn read_during_a_held_sync_shows_the_old_state() {
    let dir = library_dir();
    let reader = open_read_only(dir.path()).unwrap();
    let id = reader.list_books(&ListBooks::default()).unwrap().books[0].id;

    let (started_tx, started_rx) = mpsc::channel::<()>();
    let (release_tx, release_rx) = mpsc::channel::<()>();
    let path = dir.path().to_path_buf();
    let sync = std::thread::spawn(move || {
        let mut app = Library::open(&path).unwrap();
        let snap = snapshot(vec![book(5)]);
        // The progress callback runs inside the sync's transaction.
        app.sync(KOBO_A, &snap, &no_cover, |_, _| {
            let _ = started_tx.send(());
            let _ = release_rx.recv();
        })
        .unwrap();
    });
    started_rx.recv_timeout(Duration::from_secs(10)).expect("the sync did not start");

    let started = Instant::now();
    let page = reader.get_book(&GetBook { book_id: id, ..Default::default() }).unwrap();
    let books = reader.list_books(&ListBooks::default()).unwrap();
    assert!(started.elapsed() < Duration::from_secs(1), "the read waited for the sync");
    assert_eq!(page.highlights.len(), 3);
    assert_eq!(books.books[0].highlight_count, 3);

    drop(release_tx);
    sync.join().unwrap();

    let page = reader.get_book(&GetBook { book_id: id, ..Default::default() }).unwrap();
    let books = reader.list_books(&ListBooks::default()).unwrap();
    assert_eq!(page.highlights.len(), 5);
    assert_eq!(books.books[0].highlight_count, 5);
}

/// Test 3: the app's own writes do not fail because a read transaction of
/// the khi-mcp is open.
#[test]
fn app_writes_while_a_read_is_open() {
    let dir = library_dir();
    let app = Library::open(dir.path()).unwrap();
    let reader = open_read_only(dir.path()).unwrap();
    let book_id = reader.list_books(&ListBooks::default()).unwrap().books[0].id;

    // A read transaction that has really started: it has read a page.
    reader.conn().execute_batch("BEGIN").unwrap();
    let n: i64 = reader.conn().query_row("SELECT COUNT(*) FROM highlights", [], |r| r.get(0)).unwrap();
    assert_eq!(n, 3);

    app.mark_book_opened(1, book_id, 1).unwrap();
    app.try_set_last_reader(1).unwrap();

    reader.conn().execute_batch("COMMIT").unwrap();
    assert_eq!(app.last_reader().unwrap(), Some(1));
}
