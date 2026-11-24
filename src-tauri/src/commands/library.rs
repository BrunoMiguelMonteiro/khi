//! Tauri commands for the persistent Library (R16 and «Interface»).
//!
//! Every command is `async` and does its work inside `spawn_blocking`: Tauri
//! runs non-async commands on the main thread, and a SQLite call there would
//! freeze the window. The shared `Mutex<Library>` serves the UI; a Sync opens
//! its own `Library` (own connection, WAL) so reads never wait for it.

use crate::covers::{self, CoverExtractor};
use crate::db::kobo::KoboDatabase;
use crate::library::{KoboInfo, Library, LibraryBook, LibraryError, LibrarySummary, Reader, SyncReport};
use crate::models::{ExportConfig, KoboDevice, Language};
use crate::settings::{data_dir, SettingsManager};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};
use tauri_specta::Event;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, Event)]
#[serde(rename_all = "camelCase")]
#[tauri_specta(event_name = "sync-progress")]
pub struct SyncProgress {
    pub done: u32,
    pub total: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, Event)]
#[serde(rename_all = "camelCase")]
#[tauri_specta(event_name = "sync-finished")]
pub struct SyncFinished {
    pub reader_id: u32,
    pub report: SyncReport,
}

pub type LibraryState = Mutex<Library>;

/// Why an export failed, as a kind the screen says in the user's language.
/// The error itself goes to the log, never to the screen.
#[derive(Debug, Clone, PartialEq, Serialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ExportFailure {
    /// No permission, a read-only disk, or a disk that is no longer connected
    FolderNotWritable { folder: String },
    DiskFull,
    Internal,
}

/// The kind of `error`, raised while exporting into `folder`.
pub fn export_failure(error: &LibraryError, folder: String) -> ExportFailure {
    use std::io::ErrorKind;
    match error {
        LibraryError::Io(e) => match e.kind() {
            ErrorKind::PermissionDenied | ErrorKind::ReadOnlyFilesystem => {
                ExportFailure::FolderNotWritable { folder }
            }
            ErrorKind::StorageFull | ErrorKind::QuotaExceeded => ExportFailure::DiskFull,
            _ => ExportFailure::Internal,
        },
        _ => ExportFailure::Internal,
    }
}

/// Runs `f` on the shared Library off the main thread.
async fn with_library<T, F>(app: AppHandle, f: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce(&mut Library) -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<LibraryState>();
        let mut library = state
            .lock()
            .map_err(|_| "The Library is unavailable after an earlier error".to_string())?;
        f(&mut library)
    })
    .await
    .map_err(|e| format!("Library task failed: {}", e))?
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// A Reader was created, renamed or given another folder: every window reloads the Readers.
fn readers_changed(app: &AppHandle) {
    if let Err(e) = app.emit("readers-changed", ()) {
        log::warn!("Could not emit readers-changed: {}", e);
    }
}

// ---------------------------------------------------------------------------
// Helpers, public so the integration tests drive them without Tauri.
// ---------------------------------------------------------------------------

/// The Reader's books. Remembering the Reader is best effort: during a Sync
/// it is skipped rather than delaying the Library (R17).
pub fn get_library_with(library: &Library, reader_id: u32) -> Result<Vec<LibraryBook>, String> {
    let books = library.books(reader_id).map_err(err)?;
    if let Err(e) = library.try_set_last_reader(reader_id) {
        log::warn!("Could not remember the last Reader: {}", e);
    }
    Ok(books)
}

/// Reads the Kobo, then merges it into the Library at `data_dir` with its own
/// connection. Covers come from the EPUBs on the Kobo, through `cache_dir`.
pub fn sync_kobo_with(
    data_dir: &Path,
    cache_dir: &Path,
    device: &KoboDevice,
    progress: impl FnMut(u32, u32),
) -> Result<SyncReport, String> {
    let serial = device
        .serial_number
        .as_deref()
        .ok_or("This Kobo has no serial number")?;
    let db_path = Path::new(&device.path).join(".kobo").join("KoboReader.sqlite");

    let read_started = Instant::now();
    let snapshot = KoboDatabase::open_read_only(&db_path)
        .and_then(|db| db.read_snapshot())
        .map_err(|e| format!("Could not read the Kobo: {}", e))?;
    log::info!(
        "Read Kobo snapshot in {} ms ({} books)",
        read_started.elapsed().as_millis(),
        snapshot.books.len()
    );

    let extractor = CoverExtractor::new(cache_dir.to_path_buf());
    let volume = PathBuf::from(&device.path);
    // The EPUB's own cover, else the one the Kobo keeps (store books)
    let cover_source = |book: &crate::models::KoboBook| {
        let from_epub = book
            .volume_id
            .strip_prefix("file:///mnt/onboard/")
            .and_then(|relative| extractor.extract_cover(&volume.join(relative)).ok().flatten())
            .filter(|path| !covers::is_placeholder(path));
        from_epub.or_else(|| covers::kobo_image_cover(&volume, book.image_id.as_deref()?))
    };

    let mut library = Library::open(data_dir).map_err(err)?;
    library.sync(serial, &snapshot, &cover_source, progress).map_err(err)
}

/// Exports the Reader's books `ids`; a failure comes back as its kind.
pub fn export_library_books_with(
    library: &Library,
    reader_id: u32,
    ids: &[u32],
    config: &ExportConfig,
    language: Language,
) -> Result<Vec<String>, ExportFailure> {
    match library.export(reader_id, ids, config, language) {
        Ok(files) => Ok(files.into_iter().map(|p| p.to_string_lossy().into_owned()).collect()),
        Err(e) => {
            log::error!("Export failed: {}", e);
            let folder = library
                .export_dir(reader_id, &config.export_path)
                .map(|dir| dir.to_string_lossy().into_owned())
                .unwrap_or_default();
            Err(export_failure(&e, folder))
        }
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn list_readers(app: AppHandle) -> Result<Vec<Reader>, String> {
    with_library(app, |lib| lib.list_readers().map_err(err)).await
}

#[tauri::command]
#[specta::specta]
pub async fn create_reader(app: AppHandle, name: String) -> Result<Reader, String> {
    let reader = with_library(app.clone(), move |lib| lib.create_reader(name.trim()).map_err(err)).await?;
    // An open Settings window shows the new Reader at once (Task 45)
    readers_changed(&app);
    Ok(reader)
}

#[tauri::command]
#[specta::specta]
pub async fn rename_reader(app: AppHandle, id: u32, name: String) -> Result<(), String> {
    with_library(app.clone(), move |lib| lib.rename_reader(id, name.trim()).map_err(err)).await?;
    readers_changed(&app);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn associate_kobo(app: AppHandle, serial: String, reader_id: u32) -> Result<(), String> {
    with_library(app, move |lib| lib.associate_kobo(&serial, reader_id).map_err(err)).await
}

#[tauri::command]
#[specta::specta]
pub async fn reader_for_kobo(app: AppHandle, serial: String) -> Result<Option<u32>, String> {
    with_library(app, move |lib| {
        Ok(lib.kobo(&serial).map_err(err)?.map(|k: KoboInfo| k.reader_id))
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn last_reader(app: AppHandle) -> Result<Option<u32>, String> {
    with_library(app, |lib| lib.last_reader().map_err(err)).await
}

/// Whether agents (the MCP) may read the Library. Off until the user turns it on.
#[tauri::command]
#[specta::specta]
pub async fn agents_allowed(app: AppHandle) -> Result<bool, String> {
    with_library(app, |lib| lib.allow_agents().map_err(err)).await
}

#[tauri::command]
#[specta::specta]
pub async fn set_agents_allowed(app: AppHandle, allowed: bool) -> Result<(), String> {
    with_library(app, move |lib| lib.set_allow_agents(allowed).map_err(err)).await
}

/// Where `khi-mcp` sits: next to `exe` (Khi.app/Contents/MacOS/khi-mcp in the release app). The
/// file may not exist, as in a dev build.
pub fn mcp_helper_path_for(exe: &Path) -> Result<String, String> {
    let dir = exe.parent().ok_or("The app has no folder")?;
    Ok(dir.join("khi-mcp").to_string_lossy().into_owned())
}

#[tauri::command]
#[specta::specta]
pub async fn mcp_helper_path() -> Result<String, String> {
    mcp_helper_path_for(&std::env::current_exe().map_err(err)?)
}

#[tauri::command]
#[specta::specta]
pub async fn get_library(app: AppHandle, reader_id: u32) -> Result<Vec<LibraryBook>, String> {
    with_library(app, move |lib| get_library_with(lib, reader_id)).await
}

#[tauri::command]
#[specta::specta]
pub async fn delete_book(app: AppHandle, reader_id: u32, book_id: u32) -> Result<(), String> {
    with_library(app, move |lib| lib.delete_book(reader_id, book_id).map_err(err)).await
}

/// Marks the book seen up to `seen_seq`, the highest `syncedSeq` loaded (D1).
#[tauri::command]
#[specta::specta]
pub async fn mark_book_opened(
    app: AppHandle,
    reader_id: u32,
    book_id: u32,
    seen_seq: u32,
) -> Result<(), String> {
    with_library(app, move |lib| lib.mark_book_opened(reader_id, book_id, seen_seq).map_err(err)).await
}

/// New highlights since when, and the connected Kobo's last sync.
#[tauri::command]
#[specta::specta]
pub async fn library_summary(
    app: AppHandle,
    reader_id: u32,
    kobo_serial: Option<String>,
) -> Result<LibrarySummary, String> {
    with_library(app, move |lib| lib.library_summary(reader_id, kobo_serial.as_deref()).map_err(err)).await
}

/// Exports with the Export settings (R22), into the Reader's folder (R21).
#[tauri::command]
#[specta::specta]
pub async fn export_library_books(
    app: AppHandle,
    reader_id: u32,
    book_ids: Vec<u32>,
) -> Result<Vec<String>, ExportFailure> {
    with_library(app, move |lib| {
        let settings = SettingsManager::new().map_err(err)?.get().clone();
        Ok(export_library_books_with(
            lib,
            reader_id,
            &book_ids,
            &settings.export_config,
            settings.language,
        ))
    })
    .await
    .unwrap_or_else(|e| {
        log::error!("Export failed: {}", e);
        Err(ExportFailure::Internal)
    })
}

/// The folder the Reader's exports go to: the one chosen for it, or `base/<safe Reader name>`.
pub fn reader_export_folder_with(library: &Library, reader_id: u32, base: &str) -> Result<String, String> {
    library
        .export_dir(reader_id, base)
        .map(|dir| dir.to_string_lossy().into_owned())
        .map_err(err)
}

/// `base/<safe Reader name>`: where the exports go when no folder was chosen for the Reader.
pub fn reader_default_export_folder_with(library: &Library, reader_id: u32, base: &str) -> Result<String, String> {
    let readers = library.list_readers().map_err(err)?;
    let reader = readers.iter().find(|r| r.id == reader_id).ok_or("Reader not found")?;
    Ok(std::path::Path::new(base)
        .join(crate::library::safe_dir_name(&reader.name))
        .to_string_lossy()
        .into_owned())
}

/// The folder the Reader's exports go to when it has none of its own: Settings compares the folder
/// chosen with it, and stores «the default» as no folder.
#[tauri::command]
#[specta::specta]
pub async fn reader_default_export_folder(app: AppHandle, reader_id: u32) -> Result<String, String> {
    with_library(app, move |lib| {
        let base = SettingsManager::new().map_err(err)?.get().export_config.export_path.clone();
        reader_default_export_folder_with(lib, reader_id, &base)
    })
    .await
}

/// The folder the Reader's exports go to now, as the export itself decides it (R21): Settings
/// shows it and compares a chosen folder with it.
#[tauri::command]
#[specta::specta]
pub async fn reader_export_folder(app: AppHandle, reader_id: u32) -> Result<String, String> {
    with_library(app, move |lib| {
        let base = SettingsManager::new().map_err(err)?.get().export_config.export_path.clone();
        reader_export_folder_with(lib, reader_id, &base)
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn set_reader_export_path(
    app: AppHandle,
    reader_id: u32,
    path: Option<String>,
) -> Result<(), String> {
    with_library(app.clone(), move |lib| {
        lib.set_reader_export_path(reader_id, path.as_deref()).map_err(err)
    })
    .await?;
    readers_changed(&app);
    Ok(())
}

/// Syncs the connected Kobo into its Reader's Library, emitting
/// `sync-progress` per book and `sync-finished` at the end.
#[tauri::command]
#[specta::specta]
pub async fn sync_kobo(app: AppHandle, device: KoboDevice) -> Result<SyncReport, String> {
    let data = data_dir().map_err(err)?;
    let cache = app.path().app_cache_dir().map_err(err)?;
    let emitter = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let started = Instant::now();
        let report = sync_kobo_with(&data, &cache, &device, |done, total| {
            if let Err(e) = (SyncProgress { done, total }).emit(&emitter) {
                log::warn!("Could not emit sync progress: {}", e);
            }
        })?;
        log::info!("Sync finished in {} ms: {:?}", started.elapsed().as_millis(), report);

        let serial = device.serial_number.clone().unwrap_or_default();
        let reader_id = Library::open(&data)
            .and_then(|lib| lib.kobo(&serial))
            .map_err(err)?
            .map(|k| k.reader_id)
            .ok_or("This Kobo is not associated with a Reader")?;
        let finished = SyncFinished { reader_id, report: report.clone() };
        if let Err(e) = finished.emit(&emitter) {
            log::warn!("Could not emit sync finished: {}", e);
        }
        Ok(report)
    })
    .await
    .map_err(|e| format!("Sync task failed: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_helper_sits_next_to_the_app_executable() {
        let exe = Path::new("/Applications/My Apps/Khi.app/Contents/MacOS/Khi");
        assert_eq!(
            mcp_helper_path_for(exe).unwrap(),
            "/Applications/My Apps/Khi.app/Contents/MacOS/khi-mcp"
        );
    }

    #[test]
    fn a_path_with_no_folder_has_no_helper() {
        assert!(mcp_helper_path_for(Path::new("/")).is_err());
    }
}
