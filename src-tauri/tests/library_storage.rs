use khi_lib::library::{schema, Library};
use rusqlite::Connection;
use tempfile::TempDir;

fn user_version(dir: &TempDir) -> i64 {
    let conn = Connection::open(dir.path().join("library.sqlite")).unwrap();
    conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap()
}

#[test]
fn open_creates_db_and_covers_dir() {
    let dir = TempDir::new().unwrap();
    let _lib = Library::open(dir.path()).unwrap();

    assert!(dir.path().join("library.sqlite").is_file());
    assert!(dir.path().join("covers").is_dir());
}

#[test]
fn user_version_equals_migration_count() {
    let dir = TempDir::new().unwrap();
    drop(Library::open(dir.path()).unwrap());

    assert_eq!(user_version(&dir), schema::MIGRATIONS.len() as i64);
}

#[test]
fn reopen_does_not_rerun_migrations() {
    let dir = TempDir::new().unwrap();
    drop(Library::open(dir.path()).unwrap());
    drop(Library::open(dir.path()).expect("second open must not fail"));

    assert_eq!(user_version(&dir), schema::MIGRATIONS.len() as i64);
}
