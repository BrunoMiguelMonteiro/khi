//! The persistent Library: every book and highlight the Khi has ever read from
//! a Kobo, kept in `library.sqlite` so it is available with no Kobo connected.

pub mod identity;
pub mod schema;
pub mod sync;

pub use sync::SyncReport;

use crate::export::{ExportError, MarkdownExporter};
use crate::models::{Book, ExportConfig, Highlight};
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

/// A book as the Library holds it, with every highlight ever synced,
/// including the ones removed from the Kobo.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct LibraryBook {
    pub id: u32,
    pub title: String,
    pub author: String,
    pub isbn: Option<String>,
    pub publisher: Option<String>,
    pub language: Option<String>,
    pub description: Option<String>,
    pub date_last_read: Option<String>,
    /// Absolute path inside `covers/`.
    pub cover_path: Option<String>,
    pub highlights: Vec<LibraryHighlight>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct LibraryHighlight {
    pub id: String,
    pub text: String,
    pub date_created: String,
    pub annotation: Option<String>,
    pub chapter_title: Option<String>,
    pub container_path: Option<String>,
    pub removed_at: Option<String>,
    pub chapter_progress: Option<f64>,
}

/// Lets the `MarkdownExporter` export Library books unchanged. Removed
/// highlights are included with no mark (D1).
impl From<&LibraryBook> for Book {
    fn from(b: &LibraryBook) -> Self {
        Book {
            content_id: b.id.to_string(),
            title: b.title.clone(),
            author: b.author.clone(),
            isbn: b.isbn.clone(),
            publisher: b.publisher.clone(),
            language: b.language.clone(),
            date_last_read: b.date_last_read.clone(),
            description: b.description.clone(),
            file_path: None,
            cover_path: b.cover_path.clone(),
            highlights: b
                .highlights
                .iter()
                .map(|h| Highlight {
                    id: h.id.clone(),
                    text: h.text.clone(),
                    annotation: h.annotation.clone(),
                    chapter_title: h.chapter_title.clone(),
                    chapter_progress: h.chapter_progress,
                    container_path: h.container_path.clone(),
                    date_created: h.date_created.clone(),
                    color: None,
                })
                .collect(),
        }
    }
}

/// A Reader name made safe as one folder name: `/`, `:` and NUL become `-`
/// so the name never opens subfolders (Review Focus 5).
pub fn safe_dir_name(name: &str) -> String {
    let safe: String = name
        .chars()
        .map(|c| if matches!(c, '/' | ':' | '\0') { '-' } else { c })
        .collect();
    let safe = safe.trim();
    if safe.is_empty() || safe == "." || safe == ".." {
        "Leitor".to_string()
    } else {
        safe.to_string()
    }
}

const META_LAST_READER: &str = "last_reader";

const BOOK_COLUMNS: &str = "id, title, author, isbn, publisher, language, description, date_last_read, cover_file";

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

impl From<ExportError> for LibraryError {
    fn from(e: ExportError) -> Self {
        match e {
            ExportError::Io(e) => LibraryError::Io(e),
        }
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

    /// Every book of the Reader, by title; works with no Kobo connected (R17).
    pub fn books(&self, reader_id: u32) -> Result<Vec<LibraryBook>> {
        self.query_books(
            &format!(
                "SELECT {} FROM books WHERE reader_id = ?1 ORDER BY title COLLATE NOCASE, id",
                BOOK_COLUMNS
            ),
            &[&reader_id],
        )
    }

    /// The Reader's books among `ids`; ids of other Readers are ignored.
    pub fn books_by_ids(&self, reader_id: u32, ids: &[u32]) -> Result<Vec<LibraryBook>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let placeholders = vec!["?"; ids.len()].join(", ");
        let sql = format!(
            "SELECT {} FROM books WHERE reader_id = ? AND id IN ({}) ORDER BY title COLLATE NOCASE, id",
            BOOK_COLUMNS, placeholders
        );
        let mut values: Vec<&dyn rusqlite::ToSql> = vec![&reader_id];
        values.extend(ids.iter().map(|id| id as &dyn rusqlite::ToSql));
        self.query_books(&sql, &values)
    }

    /// R19: only a book whose highlights were all removed from the Kobo can
    /// be deleted. Its highlights, sources and cover go with it.
    pub fn delete_book(&mut self, reader_id: u32, book_id: u32) -> Result<()> {
        let tx = self.conn.transaction()?;
        let cover_file: Option<String> = tx
            .query_row(
                "SELECT cover_file FROM books WHERE id = ?1 AND reader_id = ?2",
                params![book_id, reader_id],
                |r| r.get(0),
            )
            .optional()?
            .ok_or(LibraryError::NotFound)?;
        let live: u32 = tx.query_row(
            "SELECT COUNT(*) FROM highlights WHERE book_id = ?1 AND removed_at IS NULL",
            [book_id],
            |r| r.get(0),
        )?;
        if live > 0 {
            return Err(LibraryError::BookHasLiveHighlights);
        }
        tx.execute("DELETE FROM books WHERE id = ?1", [book_id])?;
        tx.commit()?;

        if let Some(file) = cover_file {
            if let Err(e) = std::fs::remove_file(self.covers_dir.join(file)) {
                log::warn!("Could not delete cover of book {}: {}", book_id, e);
            }
        }
        Ok(())
    }

    /// The Reader's own export folder, or `base/<safe Reader name>` (R21).
    pub fn export_dir(&self, reader_id: u32, base: &str) -> Result<PathBuf> {
        let (name, export_path): (String, Option<String>) = self
            .conn
            .query_row(
                "SELECT name, export_path FROM readers WHERE id = ?1",
                [reader_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?
            .ok_or(LibraryError::NotFound)?;
        Ok(match export_path {
            Some(path) => PathBuf::from(path),
            None => Path::new(base).join(safe_dir_name(&name)),
        })
    }

    /// Exports the Reader's books `ids` as Markdown into the Reader's folder.
    /// Same ids and same config give the same bytes (R22).
    pub fn export(&self, reader_id: u32, ids: &[u32], config: &ExportConfig) -> Result<Vec<PathBuf>> {
        let dir = self.export_dir(reader_id, &config.export_path)?;
        // Created here so a bad path is an error, not the exporter's panic.
        std::fs::create_dir_all(&dir)?;
        let books: Vec<Book> = self.books_by_ids(reader_id, ids)?.iter().map(Book::from).collect();
        MarkdownExporter::new(dir)
            .export_books(&books, config)
            .into_iter()
            .map(|r| r.map_err(LibraryError::from))
            .collect()
    }

    fn query_books(&self, sql: &str, values: &[&dyn rusqlite::ToSql]) -> Result<Vec<LibraryBook>> {
        let mut stmt = self.conn.prepare(sql)?;
        let mut books = stmt
            .query_map(values, |r| {
                let cover_file: Option<String> = r.get(8)?;
                Ok(LibraryBook {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    author: r.get(2)?,
                    isbn: r.get(3)?,
                    publisher: r.get(4)?,
                    language: r.get(5)?,
                    description: r.get(6)?,
                    date_last_read: r.get(7)?,
                    cover_path: cover_file
                        .map(|f| self.covers_dir.join(f).to_string_lossy().into_owned()),
                    highlights: Vec::new(),
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        let mut stmt = self.conn.prepare(
            "SELECT bookmark_id, text, date_created, annotation, chapter_title, container_path,
                    removed_at, chapter_progress
             FROM highlights WHERE book_id = ?1
             ORDER BY chapter_progress, date_created",
        )?;
        for book in &mut books {
            book.highlights = stmt
                .query_map([book.id], |r| {
                    Ok(LibraryHighlight {
                        id: r.get(0)?,
                        text: r.get(1)?,
                        date_created: r.get::<_, Option<String>>(2)?.unwrap_or_default(),
                        annotation: r.get(3)?,
                        chapter_title: r.get(4)?,
                        container_path: r.get(5)?,
                        removed_at: r.get(6)?,
                        chapter_progress: r.get(7)?,
                    })
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
        }
        Ok(books)
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
