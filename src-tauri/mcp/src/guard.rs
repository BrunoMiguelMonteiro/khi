//! Where the Library may be read from: the data folder `data_dir_for` names,
//! canonicalized, and only a file called `library.sqlite`, never a Kobo.

use khi_core::settings::data_dir_for;
use std::path::{Path, PathBuf};

pub const LIBRARY_FILE: &str = "library.sqlite";

#[derive(Debug)]
pub enum GuardError {
    /// `data_dir_for` has no answer (no HOME, or a debug build without `--dev`).
    Folder(String),
    /// The path is, or resolves to, somewhere under /Volumes/ (a Kobo).
    Volumes,
    /// The file is not called `library.sqlite`.
    NotLibraryFile,
    /// No data folder, or no `library.sqlite` in it.
    Missing,
    /// The file is there but its real path cannot be found (a broken symlink).
    Unresolved(String),
    /// The file's real folder is not the data folder (a symlink elsewhere).
    OutsideDataDir,
}

impl std::fmt::Display for GuardError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GuardError::Folder(why) => write!(f, "Cannot choose the Khi data folder: {why}"),
            GuardError::Volumes => write!(f, "Refusing to read anything under /Volumes/"),
            GuardError::NotLibraryFile => write!(f, "Refusing to open a file that is not library.sqlite"),
            GuardError::Missing => write!(f, "No Library found in the Khi data folder"),
            GuardError::Unresolved(why) => write!(f, "Cannot resolve library.sqlite: {why}"),
            GuardError::OutsideDataDir => write!(f, "Refusing to open a library.sqlite that lives outside the Khi data folder"),
        }
    }
}

impl std::error::Error for GuardError {}

fn under_volumes(path: &Path) -> bool {
    path.starts_with("/Volumes")
}

/// The data folder for `identifier`, canonicalized when it exists. A folder
/// that does not exist yet is returned as it is, and never created.
pub fn resolve_data_dir(home: &Path, identifier: &str, debug: bool) -> Result<PathBuf, GuardError> {
    let dir = data_dir_for(home, Some(identifier), debug).map_err(|e| GuardError::Folder(e.to_string()))?;
    if under_volumes(&dir) {
        return Err(GuardError::Volumes);
    }
    let dir = dir.canonicalize().unwrap_or(dir);
    if under_volumes(&dir) {
        return Err(GuardError::Volumes);
    }
    Ok(dir)
}

/// `path` may be opened as a Library.
pub fn check_library_file(path: &Path) -> Result<(), GuardError> {
    if under_volumes(path) {
        return Err(GuardError::Volumes);
    }
    if path.file_name().and_then(|n| n.to_str()) != Some(LIBRARY_FILE) {
        return Err(GuardError::NotLibraryFile);
    }
    Ok(())
}

/// The Library file of `dir`, as a canonical path: checked by name, then
/// resolved through every symlink and checked again, and it has to sit
/// directly in the canonical data folder. Run it before every open. A missing
/// folder or file is `Missing`, never a skipped check.
pub fn library_file(dir: &Path) -> Result<PathBuf, GuardError> {
    let file = dir.join(LIBRARY_FILE);
    check_library_file(&file)?;
    if std::fs::symlink_metadata(&file).is_err() {
        return Err(GuardError::Missing);
    }
    let real = file.canonicalize().map_err(|e| GuardError::Unresolved(e.to_string()))?;
    check_library_file(&real)?;
    let real_dir = dir.canonicalize().map_err(|e| GuardError::Unresolved(e.to_string()))?;
    if real.parent() != Some(real_dir.as_path()) {
        return Err(GuardError::OutsideDataDir);
    }
    Ok(real)
}
