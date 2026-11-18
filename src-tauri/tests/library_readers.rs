use khi_lib::library::{Library, LibraryError};
use tempfile::TempDir;

#[test]
fn associated_kobo_is_remembered_after_reopen() {
    let dir = TempDir::new().unwrap();
    let reader_id = {
        let lib = Library::open(dir.path()).unwrap();
        let reader = lib.create_reader("Bruno").unwrap();
        lib.associate_kobo("N4181B5025147", reader.id).unwrap();
        reader.id
    };

    let lib = Library::open(dir.path()).unwrap();
    let kobo = lib.kobo("N4181B5025147").unwrap().expect("kobo is known");
    assert_eq!(kobo.reader_id, reader_id);
    assert_eq!(kobo.last_sync_at, None);
    assert!(lib.kobo("OTHER").unwrap().is_none());
}

#[test]
fn rename_reader_keeps_id() {
    let dir = TempDir::new().unwrap();
    let lib = Library::open(dir.path()).unwrap();
    let reader = lib.create_reader("Bruno").unwrap();

    lib.rename_reader(reader.id, "Bruno M.").unwrap();

    let readers = lib.list_readers().unwrap();
    assert_eq!(readers.len(), 1);
    assert_eq!(readers[0].id, reader.id);
    assert_eq!(readers[0].name, "Bruno M.");
}

#[test]
fn rename_unknown_reader_is_not_found() {
    let dir = TempDir::new().unwrap();
    let lib = Library::open(dir.path()).unwrap();

    let err = lib.rename_reader(999, "Ninguém").unwrap_err();
    assert!(matches!(err, LibraryError::NotFound));
}

#[test]
fn last_reader_round_trip() {
    let dir = TempDir::new().unwrap();
    let lib = Library::open(dir.path()).unwrap();
    assert_eq!(lib.last_reader().unwrap(), None);

    let reader = lib.create_reader("Ana").unwrap();
    lib.set_last_reader(reader.id).unwrap();

    assert_eq!(lib.last_reader().unwrap(), Some(reader.id));
}
