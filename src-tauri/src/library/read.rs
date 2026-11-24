//! Read-only access to `library.sqlite`, for the khi-mcp. It never creates a
//! folder or a file, never migrates and never writes: the app owns the file.

use super::schema;
use rusqlite::{Connection, ErrorCode, OpenFlags};
use std::path::Path;
use std::time::Duration;

/// How long a read waits for a lock; set here because the app never sets it.
const BUSY_TIMEOUT: Duration = Duration::from_secs(2);

#[derive(Debug)]
pub enum ReadError {
    /// No data folder, or no `library.sqlite` in it.
    LibraryNotFound,
    /// The folder is read-only, so SQLite cannot set up its WAL files.
    LibraryNotReadable,
    /// The Library's `user_version` is not the one this build knows.
    SchemaMismatch { found: usize, expected: usize },
    Db(rusqlite::Error),
}

impl std::fmt::Display for ReadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ReadError::LibraryNotFound => write!(f, "No Library found in the Khi data folder"),
            ReadError::LibraryNotReadable => {
                write!(f, "The Library cannot be read: its folder is read-only")
            }
            ReadError::SchemaMismatch { found, expected } if found < expected => write!(
                f,
                "The Library is at version {found} but this tool needs {expected}: open the Khi app once so it updates the Library"
            ),
            ReadError::SchemaMismatch { found, expected } => write!(
                f,
                "The Library is at version {found}, newer than the {expected} this tool knows: update the Khi app and this tool"
            ),
            ReadError::Db(e) => write!(f, "Library database error: {e}"),
        }
    }
}

impl std::error::Error for ReadError {}

impl From<rusqlite::Error> for ReadError {
    /// A read in a read-only folder fails with "attempt to write a readonly
    /// database"; say what is wrong instead.
    fn from(e: rusqlite::Error) -> Self {
        match &e {
            rusqlite::Error::SqliteFailure(f, _) if f.code == ErrorCode::ReadOnly => {
                ReadError::LibraryNotReadable
            }
            _ => ReadError::Db(e),
        }
    }
}

/// A read-only connection to the Library.
pub struct ReadLibrary {
    conn: Connection,
}

/// Opens `data_dir/library.sqlite` read-only. SQLite may still create the
/// `-shm` and `-wal` beside it; nothing else is created.
pub fn open_read_only(data_dir: &Path) -> Result<ReadLibrary, ReadError> {
    let path = data_dir.join("library.sqlite");
    if !path.is_file() {
        return Err(ReadError::LibraryNotFound);
    }
    let conn = Connection::open_with_flags(
        &path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    conn.pragma_update(None, "query_only", true)?;
    conn.busy_timeout(BUSY_TIMEOUT)?;
    let library = ReadLibrary { conn };
    // A first read shows a read-only folder now, not on the first tool call.
    // A schema mismatch is not an open error: check_schema reports it.
    library.user_version()?;
    Ok(library)
}

impl ReadLibrary {
    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    /// Compares the Library's `user_version` with the migrations this build
    /// knows. Reads it every time: the app may migrate while this runs.
    pub fn check_schema(&self) -> Result<(), ReadError> {
        let found = self.user_version()?;
        let expected = schema::MIGRATIONS.len();
        if found == expected {
            Ok(())
        } else {
            Err(ReadError::SchemaMismatch { found, expected })
        }
    }

    fn user_version(&self) -> Result<usize, ReadError> {
        let v: i64 = self.conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
        Ok(v as usize)
    }
}
