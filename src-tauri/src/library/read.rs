//! Read-only access to `library.sqlite`, for the khi-mcp. It never creates a
//! folder or a file, never migrates and never writes: the app owns the file.

use super::identity::normalize;
use super::{schema, IS_NEW};
use rusqlite::{Connection, ErrorCode, OpenFlags};
use serde::Serialize;
use sha2::{Digest, Sha256};
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
    /// A `since` that is neither `YYYY-MM-DD` nor an ISO 8601 date-time.
    InvalidDate,
    /// A search query shorter than 2 or longer than 200 characters.
    InvalidQuery,
    /// No such book.
    NotFound,
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
            ReadError::InvalidDate => write!(f, "Invalid date: use YYYY-MM-DD or an ISO 8601 date-time"),
            ReadError::InvalidQuery => write!(f, "Invalid query: use 2 to 200 characters with at least one word of 2 or more letters or digits"),
            ReadError::NotFound => write!(f, "No such book in the Library"),
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
    /// Strings were shortened to keep the answer under the ceiling.
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub truncated: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadersPage {
    pub readers: Vec<ReaderInfo>,
    pub next_cursor: Option<String>,
    /// Readers that match, not only the ones on this page.
    pub total: u32,
}

#[derive(Debug, Clone, Default)]
pub struct ListReaders {
    pub reader_id: Option<u32>,
    pub limit: Option<usize>,
    pub cursor: Option<String>,
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
    /// Strings were shortened to keep the answer under the ceiling.
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub truncated: bool,
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

    pub fn list_readers(&self, params: &ListReaders) -> Result<ReadersPage, ReadError> {
        let fp = fingerprint("list_readers", &[format!("{:?}", params.reader_id)]);
        let offset = match &params.cursor {
            Some(cursor) => decode_cursor(cursor, &fp)?,
            None => 0,
        };
        let limit = params.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
        let (readers, total) = self.read(|conn| {
            let total: u32 =
                conn.query_row("SELECT COUNT(*) FROM readers WHERE (?1 IS NULL OR id = ?1)", [params.reader_id], |r| r.get(0))?;
            let mut stmt = conn.prepare(&format!(
                "SELECT r.id, r.name,
                        (SELECT COUNT(*) FROM books b WHERE b.reader_id = r.id),
                        (SELECT COUNT(*) FROM highlights h WHERE h.reader_id = r.id AND h.removed_at IS NULL),
                        (SELECT COUNT(*) FROM highlights h JOIN books b ON b.id = h.book_id
                          WHERE b.reader_id = r.id AND {IS_NEW}),
                        (SELECT MIN(h.synced_at) FROM highlights h JOIN books b ON b.id = h.book_id
                          WHERE b.reader_id = r.id AND {IS_NEW})
                 FROM readers r WHERE (?1 IS NULL OR r.id = ?1) ORDER BY r.id LIMIT ?2 OFFSET ?3"
            ))?;
            let rows = stmt.query_map(rusqlite::params![params.reader_id, limit as i64, offset as i64], |r| {
                Ok(ReaderInfo {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    book_count: r.get(2)?,
                    highlight_count: r.get(3)?,
                    new_count: r.get(4)?,
                    new_since: r.get(5)?,
                    truncated: false,
                })
            })?;
            Ok((rows.collect::<rusqlite::Result<Vec<_>>>()?, total))
        })?;
        let (readers, next_cursor) = fit_page(
            &mut (),
            readers,
            offset,
            total as usize,
            &fp,
            |_, readers, cursor| {
                json_size(&ReadersPage { readers: readers.to_vec(), next_cursor: cursor.map(str::to_string), total })
            },
            |_, reader, excess| reader.is_some_and(|r| shorten_longest(vec![r], excess)),
        );
        Ok(ReadersPage { readers, next_cursor, total })
    }

    pub fn list_books(&self, params: &ListBooks) -> Result<BooksPage, ReadError> {
        let words: Vec<String> = params
            .query
            .as_deref()
            .map(|q| search_normalize(q).split(' ').filter(|w| !w.is_empty()).map(str::to_string).collect())
            .unwrap_or_default();
        let fp = fingerprint(
            "list_books",
            &[format!("{:?}", params.reader_id), params.has_new.to_string(), words.join(" "), format!("{:?}", params.sort)],
        );
        let offset = match &params.cursor {
            Some(cursor) => decode_cursor(cursor, &fp)?,
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

        let matching = self.read(|conn| {
            let mut books = Vec::new();
            for book in summaries(conn, params.reader_id, None, order)? {
                if params.has_new && book.new_count == 0 {
                    continue;
                }
                if !words.is_empty() {
                    let haystack = search_normalize(&format!("{} {}", book.title, book.author));
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
        let total32 = total as u32;
        let (books, next_cursor) = fit_page(
            &mut (),
            books,
            offset,
            total,
            &fp,
            |_, books, cursor| {
                json_size(&BooksPage { books: books.to_vec(), next_cursor: cursor.map(str::to_string), total: total32 })
            },
            |_, book, excess| book.is_some_and(|b| shorten_longest(vec![b], excess)),
        );
        Ok(BooksPage { books, next_cursor, total: total as u32 })
    }
}

/// Keeps the longest prefix of `items` whose serialized page fits the
/// ceiling and points `nextCursor` at the first one left out. `total` is how
/// many items match overall, so the last page has no cursor; `fingerprint`
/// is the one of the call, which the cursor carries. `size_of`
/// serializes the answer around a list of items and the cursor, and says how
/// many bytes it takes. When the one item left (or the answer around no item
/// at all) is still over the ceiling, `shrink` cuts the longest string of
/// `ctx` or of that item by the bytes in excess, and says whether it cut any.
fn fit_page<C, T>(
    ctx: &mut C,
    mut items: Vec<T>,
    offset: usize,
    total: usize,
    fingerprint: &str,
    size_of: impl Fn(&C, &[T], Option<&str>) -> usize,
    shrink: impl Fn(&mut C, Option<&mut T>, usize) -> bool,
) -> (Vec<T>, Option<String>) {
    let cursor_for = |kept: usize| {
        let next = offset + kept;
        (next < total).then(|| encode_cursor(next, fingerprint))
    };
    let mut kept = items.len();
    while kept > 1 && size_of(ctx, &items[..kept], cursor_for(kept).as_deref()) > CEILING_BYTES {
        kept -= 1;
    }
    items.truncate(kept);
    let cursor = cursor_for(kept);
    loop {
        let size = size_of(ctx, &items, cursor.as_deref());
        if size <= CEILING_BYTES || !shrink(ctx, items.first_mut(), size - CEILING_BYTES) {
            break;
        }
    }
    (items, cursor)
}

/// Something with strings that can be cut to keep an answer under the ceiling.
trait Shorten {
    fn strings(&mut self) -> Vec<&mut String>;
    /// Marks that a string was cut.
    fn flag(&mut self);
}

/// Bytes `c` takes inside a JSON string.
fn json_len(c: char) -> usize {
    match c {
        '"' | '\\' | '\n' | '\r' | '\t' | '\u{8}' | '\u{c}' => 2,
        c if c < ' ' => 6,
        c => c.len_utf8(),
    }
}

/// Cuts at least `excess` serialized bytes off the end of the longest string
/// of the longest-stringed part, on a char boundary, and flags that part.
/// False when every string is already empty.
fn shorten_longest(mut parts: Vec<&mut dyn Shorten>, excess: usize) -> bool {
    let lengths: Vec<usize> =
        parts.iter_mut().map(|p| p.strings().iter().map(|s| s.len()).max().unwrap_or(0)).collect();
    let Some((index, _)) = lengths.iter().enumerate().max_by_key(|(_, len)| **len) else {
        return false;
    };
    let part = &mut parts[index];
    {
        let mut strings = part.strings();
        let Some(string) = strings.iter_mut().max_by_key(|s| s.len()).filter(|s| !s.is_empty()) else {
            return false;
        };
        let mut cut = 0;
        while cut < excess {
            match string.pop() {
                Some(c) => cut += json_len(c),
                None => break,
            }
        }
    }
    part.flag();
    true
}

impl Shorten for HighlightInfo {
    fn strings(&mut self) -> Vec<&mut String> {
        [Some(&mut self.id), Some(&mut self.text), self.note.as_mut(), self.chapter.as_mut(),
         self.date_created.as_mut(), self.synced_at.as_mut()]
            .into_iter()
            .flatten()
            .collect()
    }
    fn flag(&mut self) {
        self.truncated = true;
    }
}

impl Shorten for BookSummary {
    fn strings(&mut self) -> Vec<&mut String> {
        [Some(&mut self.title), Some(&mut self.author), self.language.as_mut(), self.date_last_read.as_mut()]
            .into_iter()
            .flatten()
            .collect()
    }
    fn flag(&mut self) {
        self.truncated = true;
    }
}

impl Shorten for BookDetail {
    fn strings(&mut self) -> Vec<&mut String> {
        let mut strings = self.summary.strings();
        strings.extend([self.isbn.as_mut(), self.publisher.as_mut(), self.description.as_mut()].into_iter().flatten());
        strings
    }
    fn flag(&mut self) {
        self.summary.truncated = true;
    }
}

impl Shorten for BookRef {
    fn strings(&mut self) -> Vec<&mut String> {
        vec![&mut self.title, &mut self.author]
    }
    fn flag(&mut self) {
        self.truncated = true;
    }
}

impl Shorten for ReaderInfo {
    fn strings(&mut self) -> Vec<&mut String> {
        [Some(&mut self.name), self.new_since.as_mut()].into_iter().flatten().collect()
    }
    fn flag(&mut self) {
        self.truncated = true;
    }
}

fn json_size(value: &impl Serialize) -> usize {
    serde_json::to_vec(value).map(|v| v.len()).unwrap_or(0)
}

/// Book summaries, optionally of one Reader or one book, in `order`.
fn summaries(
    conn: &Connection,
    reader_id: Option<u32>,
    book_id: Option<u32>,
    order: &str,
) -> Result<Vec<BookSummary>, ReadError> {
    // The LEFT JOIN gives one all-NULL row to a book with no highlights:
    // only rows with a bookmark_id are highlights.
    let mut stmt = conn.prepare(&format!(
        "SELECT b.id, b.reader_id, b.title, b.author, b.language, b.date_last_read,
                COALESCE(SUM(h.bookmark_id IS NOT NULL AND h.removed_at IS NULL), 0) AS highlight_count,
                COALESCE(SUM(h.bookmark_id IS NOT NULL AND h.removed_at IS NULL AND TRIM(COALESCE(h.annotation, '')) <> ''), 0),
                COALESCE(SUM({IS_NEW}), 0),
                COALESCE(SUM(h.bookmark_id IS NOT NULL AND h.removed_at IS NOT NULL), 0)
         FROM books b LEFT JOIN highlights h ON h.book_id = b.id
         WHERE (?1 IS NULL OR b.reader_id = ?1) AND (?2 IS NULL OR b.id = ?2)
         GROUP BY b.id ORDER BY {order}"
    ))?;
    let rows = stmt.query_map(rusqlite::params![reader_id, book_id], |r| {
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
            truncated: false,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// A few bytes of the hash of a call's method, sort and filters (everything
/// but `limit` and `cursor`): the cursor of one call is no good for another.
fn fingerprint(method: &str, parts: &[String]) -> String {
    let mut hash = Sha256::new();
    hash.update(method);
    for part in parts {
        hash.update([0x1f]);
        hash.update(part);
    }
    hash.finalize().iter().take(4).map(|b| format!("{b:02x}")).collect()
}

/// `"v1:<offset>:<fingerprint>"` in hex: opaque to the caller, cheap to check.
fn encode_cursor(offset: usize, fingerprint: &str) -> String {
    format!("v1:{offset}:{fingerprint}").bytes().map(|b| format!("{b:02x}")).collect()
}

/// The offset of a cursor made for the call with this `fingerprint`.
fn decode_cursor(cursor: &str, fingerprint: &str) -> Result<usize, ReadError> {
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
        .and_then(|rest| rest.split_once(':'))
        .filter(|(n, fp)| !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()) && *fp == fingerprint)
        // SQLite offsets are signed 64-bit.
        .and_then(|(n, _)| n.parse::<i64>().ok())
        .and_then(|n| usize::try_from(n).ok())
        .ok_or(ReadError::InvalidCursor)
}

/// Longest text an answer carries whole, except in `get_book`.
const TEXT_CUT_CHARS: usize = 2000;
const DESCRIPTION_CUT_CHARS: usize = 1000;
const DEFAULT_BOOK_LIMIT: usize = 50;
const MAX_BOOK_LIMIT: usize = 200;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HighlightInfo {
    /// The Kobo's bookmark id: unique only inside a Reader, so `book_id` goes along.
    pub id: String,
    pub book_id: u32,
    pub text: String,
    pub note: Option<String>,
    pub chapter: Option<String>,
    pub progress: Option<f64>,
    pub date_created: Option<String>,
    pub synced_at: Option<String>,
    pub is_new: bool,
    pub removed: bool,
    /// The text was cut at 2000 characters.
    pub truncated: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookDetail {
    #[serde(flatten)]
    pub summary: BookSummary,
    pub isbn: Option<String>,
    pub publisher: Option<String>,
    /// Cut at 1000 characters: the Kobo sometimes stores long HTML.
    pub description: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookPage {
    pub book: BookDetail,
    pub highlights: Vec<HighlightInfo>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone)]
pub struct GetBook {
    pub book_id: u32,
    pub include_removed: bool,
    pub limit: Option<usize>,
    pub cursor: Option<String>,
}

impl Default for GetBook {
    fn default() -> Self {
        GetBook { book_id: 0, include_removed: true, limit: None, cursor: None }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NewGroup {
    pub book: BookSummary,
    pub highlights: Vec<HighlightInfo>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NewPage {
    pub groups: Vec<NewGroup>,
    pub next_cursor: Option<String>,
    pub total_highlights: u32,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub enum NewMode {
    /// What the app calls new: arrived after the book was last opened.
    #[default]
    Unseen,
    /// Arrived in the Library on or after this date (`synced_at`).
    SyncedSince(String),
}

#[derive(Debug, Clone, Default)]
pub struct NewHighlights {
    pub mode: NewMode,
    pub reader_id: Option<u32>,
    pub limit: Option<usize>,
    pub cursor: Option<String>,
}

/// The columns `highlight_from_row` reads, in this order, with `IS_NEW` in
/// the `h`/`b` aliases.
fn highlight_columns() -> String {
    format!(
        "h.bookmark_id, h.book_id, h.text, h.annotation, h.chapter_title, h.chapter_progress,
         h.date_created, h.synced_at, {IS_NEW}, h.removed_at IS NOT NULL"
    )
}

fn highlight_from_row(r: &rusqlite::Row, cut: bool) -> rusqlite::Result<HighlightInfo> {
    let mut text: String = r.get(2)?;
    let mut truncated = false;
    if cut {
        if let Some((end, _)) = text.char_indices().nth(TEXT_CUT_CHARS) {
            text.truncate(end);
            truncated = true;
        }
    }
    let note: Option<String> = r.get(3)?;
    Ok(HighlightInfo {
        id: r.get(0)?,
        book_id: r.get(1)?,
        text,
        note: note.filter(|n| !n.trim().is_empty()),
        chapter: r.get(4)?,
        progress: r.get(5)?,
        date_created: r.get(6)?,
        synced_at: r.get(7)?,
        is_new: r.get(8)?,
        removed: r.get(9)?,
        truncated,
    })
}

/// `YYYY-MM-DD` or an ISO 8601 date-time, as the UTC `synced_at` format.
fn normalize_since(input: &str) -> Result<String, ReadError> {
    use chrono::{DateTime, NaiveDate, NaiveDateTime};
    let input = input.trim();
    if let Ok(date) = NaiveDate::parse_from_str(input, "%Y-%m-%d") {
        return Ok(format!("{date}T00:00:00Z"));
    }
    if let Ok(at) = DateTime::parse_from_rfc3339(input) {
        return Ok(at.with_timezone(&chrono::Utc).format("%Y-%m-%dT%H:%M:%SZ").to_string());
    }
    // No seconds: `rfc3339` needs them. A date-time with no zone is UTC.
    if let Ok(at) = DateTime::parse_from_str(input, "%Y-%m-%dT%H:%M%:z") {
        return Ok(at.with_timezone(&chrono::Utc).format("%Y-%m-%dT%H:%M:%SZ").to_string());
    }
    let naive = input.strip_suffix(['Z', 'z']).unwrap_or(input);
    for format in ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"] {
        if let Ok(at) = NaiveDateTime::parse_from_str(naive, format) {
            return Ok(at.format("%Y-%m-%dT%H:%M:%SZ").to_string());
        }
    }
    Err(ReadError::InvalidDate)
}

impl ReadLibrary {
    pub fn get_book(&self, params: &GetBook) -> Result<BookPage, ReadError> {
        let fp = fingerprint("get_book", &[params.book_id.to_string(), params.include_removed.to_string()]);
        let offset = match &params.cursor {
            Some(cursor) => decode_cursor(cursor, &fp)?,
            None => 0,
        };
        let limit = params.limit.unwrap_or(DEFAULT_BOOK_LIMIT).clamp(1, MAX_BOOK_LIMIT);
        let (mut book, items, total) = self.read(|conn| {
            let summary = summaries(conn, None, Some(params.book_id), "b.id")?
                .pop()
                .ok_or(ReadError::NotFound)?;
            let (isbn, publisher, description) = conn.query_row(
                "SELECT isbn, publisher, description FROM books WHERE id = ?1",
                [params.book_id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get::<_, Option<String>>(2)?)),
            )?;
            let book = BookDetail {
                summary,
                isbn,
                publisher,
                description: description.map(|d| d.chars().take(DESCRIPTION_CUT_CHARS).collect()),
            };
            let total: usize = conn.query_row(
                "SELECT COUNT(*) FROM highlights h WHERE h.book_id = ?1 AND (?2 OR h.removed_at IS NULL)",
                rusqlite::params![params.book_id, params.include_removed],
                |r| r.get(0),
            )?;
            let mut stmt = conn.prepare(&format!(
                "SELECT {} FROM highlights h JOIN books b ON b.id = h.book_id
                 WHERE h.book_id = ?1 AND (?2 OR h.removed_at IS NULL)
                 ORDER BY h.chapter_progress, h.date_created, h.bookmark_id LIMIT ?3 OFFSET ?4",
                highlight_columns()
            ))?;
            // The text of a book's highlight is never cut here.
            let rows = stmt.query_map(
                rusqlite::params![params.book_id, params.include_removed, limit, offset],
                |r| highlight_from_row(r, false),
            )?;
            Ok((book, rows.collect::<rusqlite::Result<Vec<_>>>()?, total))
        })?;
        let (highlights, next_cursor) = fit_page(
            &mut book,
            items,
            offset,
            total,
            &fp,
            |book, kept, cursor| {
                json_size(&BookPage {
                    book: book.clone(),
                    highlights: kept.to_vec(),
                    next_cursor: cursor.map(str::to_string),
                })
            },
            |book, item, excess| {
                let mut parts: Vec<&mut dyn Shorten> = vec![book];
                parts.extend(item.map(|i| i as &mut dyn Shorten));
                shorten_longest(parts, excess)
            },
        );
        Ok(BookPage { book, highlights, next_cursor })
    }

    pub fn new_highlights(&self, params: &NewHighlights) -> Result<NewPage, ReadError> {
        let limit = params.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
        let (condition, since) = match &params.mode {
            NewMode::Unseen => (IS_NEW.to_string(), None),
            // A NULL synced_at compares as unknown, so it is never included.
            NewMode::SyncedSince(date) => ("h.synced_at >= ?3".to_string(), Some(normalize_since(date)?)),
        };
        let fp = fingerprint("new_highlights", &[format!("{since:?}"), format!("{:?}", params.reader_id)]);
        let offset = match &params.cursor {
            Some(cursor) => decode_cursor(cursor, &fp)?,
            None => 0,
        };
        let (items, total, mut books) = self.read(|conn| {
            let filter = format!("(?1 IS NULL OR b.reader_id = ?1) AND {condition}");
            let total: usize = {
                let sql = format!("SELECT COUNT(*) FROM highlights h JOIN books b ON b.id = h.book_id WHERE {filter}");
                let mut stmt = conn.prepare(&sql)?;
                match &since {
                    Some(since) => stmt.query_row(rusqlite::params![params.reader_id, 0, since], |r| r.get(0))?,
                    None => stmt.query_row(rusqlite::params![params.reader_id], |r| r.get(0))?,
                }
            };
            let sql = format!(
                "SELECT {} FROM highlights h JOIN books b ON b.id = h.book_id WHERE {filter}
                 ORDER BY b.title COLLATE NOCASE, b.id, h.chapter_progress, h.date_created, h.bookmark_id
                 LIMIT {limit} OFFSET {offset}",
                highlight_columns()
            );
            let mut stmt = conn.prepare(&sql)?;
            let map = |r: &rusqlite::Row| highlight_from_row(r, true);
            let items = match &since {
                Some(since) => stmt.query_map(rusqlite::params![params.reader_id, 0, since], map)?,
                None => stmt.query_map(rusqlite::params![params.reader_id], map)?,
            }
            .collect::<rusqlite::Result<Vec<_>>>()?;
            let books: std::collections::HashMap<u32, BookSummary> = summaries(conn, params.reader_id, None, "b.id")?
                .into_iter()
                .map(|b| (b.id, b))
                .collect();
            Ok((items, total, books))
        })?;
        let total32 = total as u32;
        let (items, next_cursor) = fit_page(
            &mut books,
            items,
            offset,
            total,
            &fp,
            |books, kept, cursor| {
                json_size(&NewPage {
                    groups: group_by_book(kept, books),
                    next_cursor: cursor.map(str::to_string),
                    total_highlights: total32,
                })
            },
            |books, item, excess| {
                let Some(item) = item else { return false };
                let mut parts: Vec<&mut dyn Shorten> = vec![];
                if let Some(book) = books.get_mut(&item.book_id) {
                    parts.push(book);
                }
                parts.push(item);
                shorten_longest(parts, excess)
            },
        );
        Ok(NewPage { groups: group_by_book(&items, &books), next_cursor, total_highlights: total32 })
    }
}

/// Consecutive highlights of the same book make one group.
fn group_by_book(items: &[HighlightInfo], books: &std::collections::HashMap<u32, BookSummary>) -> Vec<NewGroup> {
    let mut groups: Vec<NewGroup> = Vec::new();
    for item in items {
        match groups.last_mut() {
            Some(group) if group.book.id == item.book_id => group.highlights.push(item.clone()),
            _ => {
                if let Some(book) = books.get(&item.book_id) {
                    groups.push(NewGroup { book: book.clone(), highlights: vec![item.clone()] });
                }
            }
        }
    }
    groups
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SearchIn {
    #[default]
    Both,
    Text,
    Note,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum MatchedIn {
    Text,
    Note,
}

#[derive(Debug, Clone)]
pub struct SearchParams {
    pub query: String,
    pub search_in: SearchIn,
    pub reader_id: Option<u32>,
    pub book_id: Option<u32>,
    pub include_removed: bool,
    pub limit: Option<usize>,
    pub cursor: Option<String>,
}

impl Default for SearchParams {
    fn default() -> Self {
        SearchParams {
            query: String::new(),
            search_in: SearchIn::Both,
            reader_id: None,
            book_id: None,
            include_removed: true,
            limit: None,
            cursor: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookRef {
    pub id: u32,
    pub title: String,
    pub author: String,
    /// Strings were shortened to keep the answer under the ceiling.
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub truncated: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub highlight: HighlightInfo,
    pub book: BookRef,
    pub matched_in: MatchedIn,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchPage {
    pub results: Vec<SearchHit>,
    pub next_cursor: Option<String>,
}

/// Letters NFD does not take apart, folded to what a keyboard without them
/// types. For search only: the book identity keeps using `normalize` as is.
fn search_fold(c: char) -> Option<&'static str> {
    Some(match c {
        'ł' | 'Ł' => "l",
        'ø' | 'Ø' => "o",
        'ß' | 'ẞ' => "ss",
        'æ' | 'Æ' => "ae",
        'œ' | 'Œ' => "oe",
        'đ' | 'Đ' | 'ð' | 'Ð' => "d",
        'þ' | 'Þ' => "th",
        'ı' => "i",
        _ => return None,
    })
}

/// `normalize` after folding the letters NFD leaves alone.
fn search_normalize(s: &str) -> String {
    if !s.chars().any(|c| search_fold(c).is_some()) {
        return normalize(s);
    }
    let folded: String = s.chars().fold(String::with_capacity(s.len()), |mut out, c| {
        match search_fold(c) {
            Some(to) => out.push_str(to),
            None => out.push(c),
        }
        out
    });
    normalize(&folded)
}

/// Every term starts a word of `field` (both already normalized: words are
/// separated by one space). `spaced` holds each term with a space before it.
fn has_all(field: &str, terms: &[&str], spaced: &[String]) -> bool {
    terms.iter().zip(spaced).all(|(t, s)| field.starts_with(t) || field.contains(s.as_str()))
}

impl ReadLibrary {
    /// Scans the highlights in Rust: the Library has no text index, and
    /// SQLite's LIKE does not fold accents. The scan stops once the page and
    /// one more match are found.
    pub fn search_highlights(&self, params: &SearchParams) -> Result<SearchPage, ReadError> {
        let length = params.query.trim().chars().count();
        let query = search_normalize(&params.query);
        // A 1-character term would match nearly everything ("a" starts most
        // texts), so it is dropped; the query needs at least one longer term.
        let words: Vec<&str> = query.split(' ').filter(|w| w.chars().count() >= 2).collect();
        if !(2..=200).contains(&length) || words.is_empty() {
            return Err(ReadError::InvalidQuery);
        }
        let spaced: Vec<String> = words.iter().map(|w| format!(" {w}")).collect();
        let fp = fingerprint(
            "search_highlights",
            &[
                words.join(" "),
                format!("{:?}", params.search_in),
                format!("{:?}", params.reader_id),
                format!("{:?}", params.book_id),
                params.include_removed.to_string(),
            ],
        );
        let offset = match &params.cursor {
            Some(cursor) => decode_cursor(cursor, &fp)?,
            None => 0,
        };
        let limit = params.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
        let in_text = params.search_in != SearchIn::Note;
        let in_note = params.search_in != SearchIn::Text;

        let (hits, more) = self.read(|conn| {
            let mut stmt = conn.prepare(&format!(
                "SELECT {}, b.title, b.author FROM highlights h JOIN books b ON b.id = h.book_id
                 WHERE (?1 IS NULL OR b.reader_id = ?1) AND (?2 IS NULL OR b.id = ?2)
                   AND (?3 OR h.removed_at IS NULL)
                 ORDER BY b.title COLLATE NOCASE, b.id, h.chapter_progress, h.date_created, h.bookmark_id",
                highlight_columns()
            ))?;
            let mut rows = stmt.query(rusqlite::params![params.reader_id, params.book_id, params.include_removed])?;
            let (mut skipped, mut hits, mut more) = (0, Vec::new(), false);
            while let Some(row) = rows.next()? {
                let text: String = row.get(2)?;
                let note: Option<String> = row.get(3)?;
                let matched_in = if in_text && has_all(&search_normalize(&text), &words, &spaced) {
                    MatchedIn::Text
                } else if in_note && note.as_deref().is_some_and(|n| has_all(&search_normalize(n), &words, &spaced)) {
                    MatchedIn::Note
                } else {
                    continue;
                };
                if skipped < offset {
                    skipped += 1;
                    continue;
                }
                if hits.len() == limit {
                    more = true;
                    break;
                }
                hits.push(SearchHit {
                    highlight: highlight_from_row(row, true)?,
                    book: BookRef { id: row.get(1)?, title: row.get(10)?, author: row.get(11)?, truncated: false },
                    matched_in,
                });
            }
            Ok((hits, more))
        })?;
        // Only "is there more" is known, which is all fit_page needs.
        let total = offset + hits.len() + usize::from(more);
        let (results, next_cursor) = fit_page(
            &mut (),
            hits,
            offset,
            total,
            &fp,
            |_, kept, cursor| json_size(&SearchPage { results: kept.to_vec(), next_cursor: cursor.map(str::to_string) }),
            |_, hit, excess| {
                hit.is_some_and(|h| shorten_longest(vec![&mut h.highlight, &mut h.book], excess))
            },
        );
        Ok(SearchPage { results, next_cursor })
    }
}
