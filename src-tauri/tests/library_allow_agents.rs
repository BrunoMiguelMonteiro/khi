//! The "Permitir agentes" switch (docs/plans/0003-mcp.md, test 13): kept in
//! the Library's `meta` table, off unless it says exactly `true`.

use khi_lib::library::read::{
    open_read_only, GetBook, ListBooks, ListReaders, NewHighlights, ReadError, ReadLibrary, SearchParams,
};
use khi_lib::library::Library;
use rusqlite::Connection;
use sha2::{Digest, Sha256};
use std::path::Path;
use tempfile::TempDir;

fn library_dir() -> TempDir {
    let dir = TempDir::new().unwrap();
    let lib = Library::open(dir.path()).unwrap();
    lib.create_reader("Bruno").unwrap();
    dir
}

/// Writes the raw value, the way a damaged or hand-edited Library would have it.
fn set_raw(dir: &Path, value: Option<&str>) {
    let conn = Connection::open(dir.join("library.sqlite")).unwrap();
    match value {
        Some(v) => conn
            .execute(
                "INSERT INTO meta (key, value) VALUES ('allow_agents', ?1)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                [v],
            )
            .unwrap(),
        None => conn.execute("DELETE FROM meta WHERE key = 'allow_agents'", []).unwrap(),
    };
}

/// Every tool of the khi-mcp goes through one of these.
fn every_read(lib: &ReadLibrary) -> Vec<(&'static str, Result<(), ReadError>)> {
    vec![
        ("list_readers", lib.list_readers(&ListReaders::default()).map(drop)),
        ("list_books", lib.list_books(&ListBooks::default()).map(drop)),
        ("get_book", lib.get_book(&GetBook { book_id: 1, ..Default::default() }).map(drop)),
        ("new_highlights", lib.new_highlights(&NewHighlights::default()).map(drop)),
        (
            "search_highlights",
            lib.search_highlights(&SearchParams { query: "confianca".into(), ..Default::default() }).map(drop),
        ),
    ]
}

fn file_hash(dir: &Path) -> Vec<u8> {
    Sha256::digest(std::fs::read(dir.join("library.sqlite")).unwrap()).to_vec()
}

#[test]
fn is_off_on_a_new_library() {
    let dir = TempDir::new().unwrap();
    let lib = Library::open(dir.path()).unwrap();
    assert!(!lib.allow_agents().unwrap());
}

#[test]
fn can_be_turned_on_and_off() {
    let dir = TempDir::new().unwrap();
    let lib = Library::open(dir.path()).unwrap();
    lib.set_allow_agents(true).unwrap();
    assert!(lib.allow_agents().unwrap());
    lib.set_allow_agents(false).unwrap();
    assert!(!lib.allow_agents().unwrap());
}

#[test]
fn survives_reopening() {
    let dir = TempDir::new().unwrap();
    Library::open(dir.path()).unwrap().set_allow_agents(true).unwrap();
    assert!(Library::open(dir.path()).unwrap().allow_agents().unwrap());
}

#[test]
fn a_corrupt_value_counts_as_off() {
    let dir = TempDir::new().unwrap();
    let lib = Library::open(dir.path()).unwrap();
    for bad in ["yes", "1", "", "True", " true", "TRUE"] {
        set_raw(dir.path(), Some(bad));
        assert!(!lib.allow_agents().unwrap(), "{bad:?}");
    }
}

#[test]
fn every_tool_is_refused_unless_the_value_is_true() {
    let dir = library_dir();
    for value in [None, Some("false"), Some("garbage"), Some(""), Some("1")] {
        set_raw(dir.path(), value);
        let lib = open_read_only(dir.path()).unwrap();
        for (tool, result) in every_read(&lib) {
            assert!(matches!(result, Err(ReadError::DisabledInKhi)), "{tool} with {value:?}: {result:?}");
        }
    }
}

#[test]
fn every_tool_works_when_the_value_is_true() {
    let dir = library_dir();
    set_raw(dir.path(), Some("true"));
    let lib = open_read_only(dir.path()).unwrap();
    for (tool, result) in every_read(&lib) {
        // get_book on a book that is not there is NotFound, which is still a read.
        assert!(matches!(result, Ok(()) | Err(ReadError::NotFound)), "{tool}: {result:?}");
    }
}

#[test]
fn the_message_points_to_the_settings() {
    assert_eq!(ReadError::DisabledInKhi.to_string(), "Turned off in Khi Settings › Agents");
}

#[test]
fn a_switch_flipped_by_the_app_is_seen_by_an_open_read_library() {
    let dir = TempDir::new().unwrap();
    let app = Library::open(dir.path()).unwrap();
    app.create_reader("Bruno").unwrap();
    let reader = open_read_only(dir.path()).unwrap();
    assert!(matches!(reader.list_readers(&ListReaders::default()), Err(ReadError::DisabledInKhi)));
    app.set_allow_agents(true).unwrap();
    assert_eq!(reader.list_readers(&ListReaders::default()).unwrap().readers.len(), 1);
    app.set_allow_agents(false).unwrap();
    assert!(matches!(reader.list_readers(&ListReaders::default()), Err(ReadError::DisabledInKhi)));
}

#[test]
fn refused_calls_never_write() {
    let dir = library_dir();
    let before = file_hash(dir.path());
    let lib = open_read_only(dir.path()).unwrap();
    every_read(&lib);
    drop(lib);
    assert_eq!(file_hash(dir.path()), before);
}
