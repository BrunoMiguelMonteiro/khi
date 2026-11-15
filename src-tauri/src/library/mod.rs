//! The persistent Library: every book and highlight the Khi has ever read from
//! a Kobo, kept in `library.sqlite` so it is available with no Kobo connected.

pub mod schema;

use rusqlite::Connection;
use std::path::{Path, PathBuf};

pub struct Library {
    #[allow(dead_code)] // read by the next tasks (readers, sync)
    conn: Connection,
    #[allow(dead_code)]
    covers_dir: PathBuf,
}

#[derive(Debug)]
pub enum LibraryError {
    Db(rusqlite::Error),
    Io(std::io::Error),
    NotFound,
    BookHasLiveHighlights,
}

impl std::fmt::Display for LibraryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LibraryError::Db(e) => write!(f, "Library database error: {}", e),
            LibraryError::Io(e) => write!(f, "Library IO error: {}", e),
            LibraryError::NotFound => write!(f, "Not found in the Library"),
            LibraryError::BookHasLiveHighlights => {
                write!(f, "The book still has highlights on the Kobo")
            }
        }
    }
}

impl std::error::Error for LibraryError {}

impl From<rusqlite::Error> for LibraryError {
    fn from(e: rusqlite::Error) -> Self {
        LibraryError::Db(e)
    }
}

impl From<std::io::Error> for LibraryError {
    fn from(e: std::io::Error) -> Self {
        LibraryError::Io(e)
    }
}

impl Library {
    /// Opens (creating if needed) `library.sqlite` and `covers/` inside
    /// `data_dir`, and applies any migration not yet applied.
    pub fn open(data_dir: &Path) -> Result<Library, LibraryError> {
        let covers_dir = data_dir.join("covers");
        std::fs::create_dir_all(&covers_dir)?;

        let mut conn = Connection::open(data_dir.join("library.sqlite"))?;
        conn.pragma_update(None, "foreign_keys", true)?;
        migrate(&mut conn)?;

        Ok(Library { conn, covers_dir })
    }
}

fn migrate(conn: &mut Connection) -> Result<(), LibraryError> {
    let current: usize = conn.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))? as usize;
    for (index, sql) in schema::MIGRATIONS.iter().enumerate().skip(current) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", (index + 1) as i64)?;
        tx.commit()?;
    }
    Ok(())
}
