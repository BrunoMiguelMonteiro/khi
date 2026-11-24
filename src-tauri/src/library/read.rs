//! Read-only access to `library.sqlite`, for the khi-mcp. It never creates a
//! folder or a file, never migrates and never writes: the app owns the file.

use super::identity::normalize;
use super::{schema, IS_NEW};
use rusqlite::{Connection, ErrorCode, OpenFlags};
use serde::Serialize;
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
    /// A `cursor` that this tool did not hand out.
    InvalidCursor,
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
            ReadError::InvalidCursor => write!(f, "Invalid cursor: use the nextCursor of a previous answer as it was given"),
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

/// Biggest page of JSON an answer may carry (about 4 000 tokens).
const CEILING_BYTES: usize = 16 * 1024;
const DEFAULT_LIMIT: usize = 20;
const MAX_LIMIT: usize = 100;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReaderInfo {
    pub id: u32,
    pub name: String,
    pub book_count: u32,
    /// Highlights still on the Kobo; the removed ones are not counted.
    pub highlight_count: u32,
    pub new_count: u32,
    pub new_since: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookSummary {
    pub id: u32,
    pub reader_id: u32,
    pub title: String,
    pub author: String,
    pub language: Option<String>,
    pub date_last_read: Option<String>,
    /// Highlights still on the Kobo; `removed_count` counts the others.
    pub highlight_count: u32,
    pub note_count: u32,
    pub new_count: u32,
    pub removed_count: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BooksPage {
    pub books: Vec<BookSummary>,
    pub next_cursor: Option<String>,
    /// Books that match, not only the ones on this page.
    pub total: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum BookSort {
    /// The app's order: title without case, then id.
    #[default]
    Title,
    LastRead,
    HighlightCount,
}

#[derive(Debug, Clone, Default)]
pub struct ListBooks {
    pub reader_id: Option<u32>,
    /// Only books with at least one new highlight.
    pub has_new: bool,
    /// Words that all have to be in the title or the author.
    pub query: Option<String>,
    pub sort: BookSort,
    pub limit: Option<usize>,
    pub cursor: Option<String>,
}

impl ReadLibrary {
    /// Runs `f` in one deferred read transaction, after checking the schema
    /// inside it: a call sees one state of the Library, never two.
    fn read<T>(&self, f: impl FnOnce(&Connection) -> Result<T, ReadError>) -> Result<T, ReadError> {
        let tx = self.conn.unchecked_transaction()?;
        self.check_schema()?;
        let out = f(&tx)?;
        tx.commit()?;
        Ok(out)
    }

    pub fn list_readers(&self) -> Result<Vec<ReaderInfo>, ReadError> {
        self.read(|conn| {
            let mut stmt = conn.prepare(&format!(
                "SELECT r.id, r.name,
                        (SELECT COUNT(*) FROM books b WHERE b.reader_id = r.id),
                        (SELECT COUNT(*) FROM highlights h WHERE h.reader_id = r.id AND h.removed_at IS NULL),
                        (SELECT COUNT(*) FROM highlights h JOIN books b ON b.id = h.book_id
                          WHERE b.reader_id = r.id AND {IS_NEW}),
                        (SELECT MIN(h.synced_at) FROM highlights h JOIN books b ON b.id = h.book_id
                          WHERE b.reader_id = r.id AND {IS_NEW})
                 FROM readers r ORDER BY r.id"
            ))?;
            let rows = stmt.query_map([], |r| {
                Ok(ReaderInfo {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    book_count: r.get(2)?,
                    highlight_count: r.get(3)?,
                    new_count: r.get(4)?,
                    new_since: r.get(5)?,
                })
            })?;
            Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
        })
    }

    pub fn list_books(&self, params: &ListBooks) -> Result<BooksPage, ReadError> {
        let offset = match &params.cursor {
            Some(cursor) => decode_cursor(cursor)?,
            None => 0,
        };
        let limit = params.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
        let order = match params.sort {
            BookSort::Title => "b.title COLLATE NOCASE, b.id",
            BookSort::LastRead => {
                "b.date_last_read IS NULL, b.date_last_read DESC, b.title COLLATE NOCASE, b.id"
            }
            BookSort::HighlightCount => "highlight_count DESC, b.title COLLATE NOCASE, b.id",
        };
        let words: Vec<String> = params
            .query
            .as_deref()
            .map(|q| normalize(q).split(' ').filter(|w| !w.is_empty()).map(str::to_string).collect())
            .unwrap_or_default();

        let matching = self.read(|conn| {
            let mut stmt = conn.prepare(&format!(
                "SELECT b.id, b.reader_id, b.title, b.author, b.language, b.date_last_read,
                        COALESCE(SUM(h.bookmark_id IS NOT NULL AND h.removed_at IS NULL), 0) AS highlight_count,
                        COALESCE(SUM(h.bookmark_id IS NOT NULL AND h.removed_at IS NULL AND TRIM(COALESCE(h.annotation, '')) <> ''), 0),
                        COALESCE(SUM({IS_NEW}), 0),
                        COALESCE(SUM(h.bookmark_id IS NOT NULL AND h.removed_at IS NOT NULL), 0)
                 FROM books b LEFT JOIN highlights h ON h.book_id = b.id
                 WHERE (?1 IS NULL OR b.reader_id = ?1)
                 GROUP BY b.id ORDER BY {order}"
            ))?;
            let rows = stmt.query_map([params.reader_id], |r| {
                Ok(BookSummary {
                    id: r.get(0)?,
                    reader_id: r.get(1)?,
                    title: r.get(2)?,
                    author: r.get(3)?,
                    language: r.get(4)?,
                    date_last_read: r.get(5)?,
                    highlight_count: r.get(6)?,
                    note_count: r.get(7)?,
                    new_count: r.get(8)?,
                    removed_count: r.get(9)?,
                })
            })?;
            let mut books = Vec::new();
            for book in rows {
                let book = book?;
                if params.has_new && book.new_count == 0 {
                    continue;
                }
                if !words.is_empty() {
                    let haystack = normalize(&format!("{} {}", book.title, book.author));
                    if !words.iter().all(|w| haystack.contains(w.as_str())) {
                        continue;
                    }
                }
                books.push(book);
            }
            Ok(books)
        })?;

        let total = matching.len();
        let books: Vec<BookSummary> = matching.into_iter().skip(offset).take(limit).collect();
        let (books, next_cursor) = fit_page(books, offset, total, |books, next_cursor| BooksPage {
            books,
            next_cursor,
            total: total as u32,
        });
        Ok(BooksPage { books, next_cursor, total: total as u32 })
    }
}

/// Keeps the longest prefix of `items` whose serialized page fits the
/// ceiling (one item always stays) and points `nextCursor` at the first one
/// left out. `total` is how many items match overall, so the last page has
/// no cursor. `page` builds the answer around a list of items.
fn fit_page<T: Serialize, P: Serialize>(
    mut items: Vec<T>,
    offset: usize,
    total: usize,
    page: impl Fn(Vec<T>, Option<String>) -> P,
) -> (Vec<T>, Option<String>) {
    let cursor_for = |kept: usize| {
        let next = offset + kept;
        (next < total).then(|| encode_cursor(next))
    };
    let sizes: Vec<usize> = items
        .iter()
        .map(|item| serde_json::to_vec(item).map(|v| v.len()).unwrap_or(0))
        .collect();
    let mut kept = items.len();
    while kept > 1 {
        let shell = serde_json::to_vec(&page(Vec::new(), cursor_for(kept))).map(|v| v.len()).unwrap_or(0);
        // The items, and a comma between each pair.
        let bytes = shell + sizes[..kept].iter().sum::<usize>() + (kept - 1);
        if bytes <= CEILING_BYTES {
            break;
        }
        kept -= 1;
    }
    items.truncate(kept);
    (items, cursor_for(kept))
}

/// `"v1:<offset>"` in hex: opaque to the caller, cheap to check.
fn encode_cursor(offset: usize) -> String {
    format!("v1:{offset}").bytes().map(|b| format!("{b:02x}")).collect()
}

fn decode_cursor(cursor: &str) -> Result<usize, ReadError> {
    let bytes = cursor.as_bytes();
    if bytes.is_empty() || bytes.len() % 2 != 0 {
        return Err(ReadError::InvalidCursor);
    }
    let decoded: Option<Vec<u8>> = bytes
        .chunks(2)
        .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).ok()?, 16).ok())
        .collect();
    let text = String::from_utf8(decoded.ok_or(ReadError::InvalidCursor)?).map_err(|_| ReadError::InvalidCursor)?;
    text.strip_prefix("v1:")
        .filter(|n| !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()))
        .and_then(|n| n.parse().ok())
        .ok_or(ReadError::InvalidCursor)
}
