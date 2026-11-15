//! The persistent Library: every book and highlight the Khi has ever read from
//! a Kobo, kept in `library.sqlite` so it is available with no Kobo connected.

pub mod identity;
pub mod schema;
pub mod sync;

pub use sync::SyncReport;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

pub type Result<T> = std::result::Result<T, LibraryError>;

/// A person whose Kobos feed the Library. Never deleted (R3).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct Reader {
    pub id: u32,
    pub name: String,
    pub export_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct KoboInfo {
    pub serial: String,
    pub reader_id: u32,
    pub last_sync_at: Option<String>,
}

const META_LAST_READER: &str = "last_reader";

pub struct Library {
    conn: Connection,
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
    pub fn open(data_dir: &Path) -> Result<Library> {
        let covers_dir = data_dir.join("covers");
        std::fs::create_dir_all(&covers_dir)?;

        let mut conn = Connection::open(data_dir.join("library.sqlite"))?;
        conn.pragma_update(None, "foreign_keys", true)?;
        migrate(&mut conn)?;

        Ok(Library { conn, covers_dir })
    }

    pub fn create_reader(&self, name: &str) -> Result<Reader> {
        self.conn
            .execute("INSERT INTO readers (name) VALUES (?1)", [name])?;
        Ok(Reader {
            id: self.conn.last_insert_rowid() as u32,
            name: name.to_string(),
            export_path: None,
        })
    }

    pub fn rename_reader(&self, id: u32, name: &str) -> Result<()> {
        let changed = self
            .conn
            .execute("UPDATE readers SET name = ?1 WHERE id = ?2", params![name, id])?;
        if changed == 0 {
            return Err(LibraryError::NotFound);
        }
        Ok(())
    }

    pub fn list_readers(&self) -> Result<Vec<Reader>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, name, export_path FROM readers ORDER BY id")?;
        let readers = stmt
            .query_map([], |r| {
                Ok(Reader {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    export_path: r.get(2)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(readers)
    }

    /// Remembers which Reader a Kobo belongs to (R1). Re-associating keeps
    /// the Kobo's last sync time.
    pub fn associate_kobo(&self, serial: &str, reader_id: u32) -> Result<()> {
        self.conn.execute(
            "INSERT INTO kobos (serial, reader_id) VALUES (?1, ?2)
             ON CONFLICT(serial) DO UPDATE SET reader_id = excluded.reader_id",
            params![serial, reader_id],
        )?;
        Ok(())
    }

    pub fn kobo(&self, serial: &str) -> Result<Option<KoboInfo>> {
        Ok(self
            .conn
            .query_row(
                "SELECT serial, reader_id, last_sync_at FROM kobos WHERE serial = ?1",
                [serial],
                |r| {
                    Ok(KoboInfo {
                        serial: r.get(0)?,
                        reader_id: r.get(1)?,
                        last_sync_at: r.get(2)?,
                    })
                },
            )
            .optional()?)
    }

    pub fn last_reader(&self) -> Result<Option<u32>> {
        let value: Option<String> = self
            .conn
            .query_row(
                "SELECT value FROM meta WHERE key = ?1",
                [META_LAST_READER],
                |r| r.get(0),
            )
            .optional()?;
        Ok(value.and_then(|v| v.parse().ok()))
    }

    pub fn set_last_reader(&self, id: u32) -> Result<()> {
        self.conn.execute(
            "INSERT INTO meta (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![META_LAST_READER, id.to_string()],
        )?;
        Ok(())
    }

    pub fn set_reader_export_path(&self, id: u32, path: Option<&str>) -> Result<()> {
        let changed = self.conn.execute(
            "UPDATE readers SET export_path = ?1 WHERE id = ?2",
            params![path, id],
        )?;
        if changed == 0 {
            return Err(LibraryError::NotFound);
        }
        Ok(())
    }
}

fn migrate(conn: &mut Connection) -> Result<()> {
    let current: usize = conn.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))? as usize;
    for (index, sql) in schema::MIGRATIONS.iter().enumerate().skip(current) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", (index + 1) as i64)?;
        tx.commit()?;
    }
    Ok(())
}
