//! The path guard: the data folder comes from `data_dir_for`, is canonicalized,
//! and only `library.sqlite` is ever opened, never anything under /Volumes/.

use khi_mcp::guard::{library_file, resolve_data_dir, GuardError};
use std::path::Path;
use tempfile::TempDir;

#[test]
fn debug_build_without_dev_is_refused() {
    let home = TempDir::new().unwrap();
    assert!(matches!(resolve_data_dir(home.path(), "com.bruno.khi", true), Err(GuardError::Folder(_))));
}

#[test]
fn dev_identifier_gives_the_dev_folder_canonicalized() {
    let home = TempDir::new().unwrap();
    let dir = home.path().join("Library/Application Support/KoboHighlightsExporter Dev");
    std::fs::create_dir_all(&dir).unwrap();
    let resolved = resolve_data_dir(home.path(), "com.bruno.khi.dev", true).unwrap();
    assert_eq!(resolved, dir.canonicalize().unwrap());
    assert_eq!(library_file(&resolved).unwrap(), resolved.join("library.sqlite"));
}

#[test]
fn a_missing_folder_is_not_an_error_and_is_not_created() {
    let home = TempDir::new().unwrap();
    let resolved = resolve_data_dir(home.path(), "com.bruno.khi.dev", true).unwrap();
    assert!(!resolved.exists());
}

#[test]
fn volumes_are_refused() {
    assert!(matches!(
        library_file(Path::new("/Volumes/KOBOeReader/.kobo")),
        Err(GuardError::Volumes)
    ));
    assert!(matches!(
        library_file(Path::new("/Volumes/KOBOeReader")),
        Err(GuardError::Volumes)
    ));
    // The Kobo's own database, wherever it is, is not a Library.
    assert!(matches!(
        khi_mcp::guard::check_library_file(Path::new("/Volumes/KOBOeReader/.kobo/KoboReader.sqlite")),
        Err(GuardError::Volumes)
    ));
    assert!(matches!(
        khi_mcp::guard::check_library_file(Path::new("/tmp/data/KoboReader.sqlite")),
        Err(GuardError::NotLibraryFile)
    ));
    assert!(matches!(
        khi_mcp::guard::check_library_file(Path::new("/tmp/data/library.sqlite-wal")),
        Err(GuardError::NotLibraryFile)
    ));
    assert!(khi_mcp::guard::check_library_file(Path::new("/tmp/data/library.sqlite")).is_ok());
}

#[test]
fn a_symlink_into_volumes_is_refused() {
    let home = TempDir::new().unwrap();
    let support = home.path().join("Library/Application Support");
    std::fs::create_dir_all(&support).unwrap();
    // /Volumes always exists on macOS and is a safe target to point at.
    if Path::new("/Volumes").is_dir() {
        std::os::unix::fs::symlink("/Volumes", support.join("KoboHighlightsExporter Dev")).unwrap();
        assert!(matches!(
            resolve_data_dir(home.path(), "com.bruno.khi.dev", true),
            Err(GuardError::Volumes)
        ));
    }
}
