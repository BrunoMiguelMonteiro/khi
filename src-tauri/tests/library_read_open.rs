//! Opening the Library read-only (the khi-mcp way): never writes, never
//! creates, and tells the caller why it cannot read.

use khi_lib::library::read::{open_read_only, ReadError};
use khi_lib::library::schema::MIGRATIONS;
use khi_lib::library::Library;
use khi_lib::settings::{data_dir_for, SettingsError};
use rusqlite::Connection;
use sha2::{Digest, Sha256};
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use tempfile::TempDir;

/// A data folder with a migrated library.sqlite and one Reader, closed
/// again: the app wrote it, the test only reads.
fn library_dir() -> TempDir {
    let dir = TempDir::new().unwrap();
    let lib = Library::open(dir.path()).unwrap();
    lib.create_reader("Bruno").unwrap();
    drop(lib);
    dir
}

fn reader_names(conn: &Connection) -> Vec<String> {
    let mut stmt = conn.prepare("SELECT name FROM readers ORDER BY id").unwrap();
    let rows = stmt.query_map([], |r| r.get(0)).unwrap();
    rows.map(|r| r.unwrap()).collect()
}

fn set_user_version(dir: &Path, version: i64) {
    let conn = Connection::open(dir.join("library.sqlite")).unwrap();
    conn.pragma_update(None, "user_version", version).unwrap();
}

fn file_hash(path: &Path) -> Vec<u8> {
    Sha256::digest(fs::read(path).unwrap()).to_vec()
}

/// Restores the folder's permissions on drop, even if the test panics.
struct RestorePerms<'a>(&'a Path);

impl Drop for RestorePerms<'_> {
    fn drop(&mut self) {
        let _ = fs::set_permissions(self.0, fs::Permissions::from_mode(0o755));
    }
}

#[test]
fn insert_is_refused() {
    let dir = library_dir();
    let lib = open_read_only(dir.path()).unwrap();
    let err = lib
        .conn()
        .execute("INSERT INTO readers (name) VALUES ('x')", [])
        .unwrap_err();
    let message = err.to_string().to_lowercase();
    assert!(message.contains("readonly") || message.contains("read-only"), "{message}");
}

#[test]
fn file_hash_is_unchanged() {
    let dir = library_dir();
    let path = dir.path().join("library.sqlite");
    let before = file_hash(&path);
    {
        let lib = open_read_only(dir.path()).unwrap();
        lib.check_schema().unwrap();
        assert_eq!(reader_names(lib.conn()), ["Bruno"]);
    }
    assert_eq!(file_hash(&path), before);
}

#[test]
fn missing_library_is_not_created() {
    let parent = TempDir::new().unwrap();
    let missing = parent.path().join("data");
    assert!(matches!(open_read_only(&missing), Err(ReadError::LibraryNotFound)));
    assert!(!missing.exists());

    fs::create_dir(&missing).unwrap();
    assert!(matches!(open_read_only(&missing), Err(ReadError::LibraryNotFound)));
    assert_eq!(fs::read_dir(&missing).unwrap().count(), 0);
}

#[test]
fn opens_with_app_closed() {
    let dir = library_dir();
    let names: Vec<_> = fs::read_dir(dir.path())
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .filter(|n| n.starts_with("library.sqlite"))
        .collect();
    assert_eq!(names, ["library.sqlite"], "the app left more than the main file");

    let lib = open_read_only(dir.path()).unwrap();
    lib.check_schema().unwrap();
    assert_eq!(reader_names(lib.conn()), ["Bruno"]);
}

#[test]
fn crashed_app_wal_is_read() {
    let dir = library_dir();
    // The app is "running": a writer that never checkpoints leaves its rows
    // only in the -wal.
    let writer = Connection::open(dir.path().join("library.sqlite")).unwrap();
    writer.pragma_update(None, "wal_autocheckpoint", 0).unwrap();
    writer.execute("INSERT INTO readers (name) VALUES ('Only in the WAL')", []).unwrap();

    // The crash: the files as they are on disk, with no -shm.
    let crashed = TempDir::new().unwrap();
    for name in ["library.sqlite", "library.sqlite-wal"] {
        fs::copy(dir.path().join(name), crashed.path().join(name)).unwrap();
    }
    assert!(!crashed.path().join("library.sqlite-shm").exists());

    let lib = open_read_only(crashed.path()).unwrap();
    lib.check_schema().unwrap();
    assert_eq!(reader_names(lib.conn()), ["Bruno", "Only in the WAL"]);
    drop(writer);
}

#[test]
fn read_only_folder_is_not_readable() {
    let dir = library_dir();
    let _restore = RestorePerms(dir.path());
    fs::set_permissions(dir.path(), fs::Permissions::from_mode(0o555)).unwrap();

    // Whether it fails on open or on the first call, it is never `Db`.
    let result = open_read_only(dir.path()).and_then(|lib| lib.check_schema());
    assert!(matches!(result, Err(ReadError::LibraryNotReadable)), "{result:?}");
}

#[test]
fn schema_older_and_newer() {
    let dir = library_dir();
    let expected = MIGRATIONS.len();
    let lib = open_read_only(dir.path()).unwrap();
    lib.check_schema().unwrap();

    set_user_version(dir.path(), 1);
    let lib = open_read_only(dir.path()).unwrap();
    match lib.check_schema() {
        Err(ReadError::SchemaMismatch { found, expected: e }) => assert_eq!((found, e), (1, expected)),
        other => panic!("{other:?}"),
    }

    set_user_version(dir.path(), 3);
    let lib = open_read_only(dir.path()).unwrap();
    match lib.check_schema() {
        Err(ReadError::SchemaMismatch { found, expected: e }) => assert_eq!((found, e), (3, expected)),
        other => panic!("{other:?}"),
    }
}

#[test]
fn schema_changes_mid_session() {
    let dir = library_dir();
    let lib = open_read_only(dir.path()).unwrap();
    lib.check_schema().unwrap();

    // The app migrates while the khi-mcp keeps running.
    set_user_version(dir.path(), MIGRATIONS.len() as i64 + 1);
    assert!(matches!(lib.check_schema(), Err(ReadError::SchemaMismatch { .. })));

    set_user_version(dir.path(), MIGRATIONS.len() as i64);
    lib.check_schema().unwrap();
}

#[test]
fn debug_build_needs_dev() {
    let home = Path::new("/nonexistent-home");
    assert!(matches!(
        data_dir_for(home, Some("com.bruno.khi"), true),
        Err(SettingsError::DebugBuildNeedsDevIdentifier)
    ));
    let dev = data_dir_for(home, Some("com.bruno.khi.dev"), true).unwrap();
    assert!(dev.ends_with("KoboHighlightsExporter Dev"));
}
