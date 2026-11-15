use crate::models::{KoboBook, KoboHighlight, KoboSnapshot};
use rusqlite::{Connection, OpenFlags, Result};

pub struct KoboDatabase {
    conn: Connection,
}

/// Every highlight with text, with its book's metadata, Description and
/// DateModified. The TOC title is a range lookup on content's primary key
/// instead of `LIKE ContentID || '%'`, which scanned the whole table per row.
const SNAPSHOT_QUERY: &str = "SELECT
        b.BookmarkID,
        b.VolumeID,
        b.Text,
        b.Annotation,
        b.StartContainerPath,
        b.ChapterProgress,
        b.DateCreated,
        b.DateModified,
        COALESCE(c_book.Title, c_book.BookTitle, c_chapter.BookTitle, c_chapter.Title, 'Unknown Title') AS BookTitle,
        COALESCE(
            (SELECT c_toc.Title FROM content c_toc
              WHERE c_toc.ContentType = 899
                AND c_toc.ContentID >= b.ContentID
                AND c_toc.ContentID < b.ContentID || '~'
              LIMIT 1),
            CASE WHEN c_chapter.Title IS NOT NULL
                      AND c_chapter.Title NOT LIKE '%.xhtml%'
                      AND c_chapter.Title NOT LIKE '%.html%'
                      AND c_chapter.Title NOT LIKE '%.htm%'
                      AND c_chapter.Title NOT LIKE '%/%'
                 THEN c_chapter.Title
            END
        ) AS ChapterTitle,
        c_book.Attribution,
        c_book.ISBN,
        c_book.Publisher,
        c_book.Language,
        c_book.Description,
        c_book.DateLastRead,
        c_book.ImageId
     FROM Bookmark b
     LEFT JOIN content c_book ON b.VolumeID = c_book.ContentID
     LEFT JOIN content c_chapter ON b.ContentID = c_chapter.ContentID
     WHERE b.Text IS NOT NULL AND b.Text != ''
     ORDER BY b.VolumeID, b.ChapterProgress, b.DateCreated";

impl KoboDatabase {
    pub fn new(path: &std::path::Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        Ok(Self { conn })
    }

    /// Opens the Kobo database without write access (spec R15).
    pub fn open_read_only(path: &std::path::Path) -> Result<Self> {
        let conn = Connection::open_with_flags(
            path,
            OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )?;
        Ok(Self { conn })
    }

    /// Reads every highlight with text, grouped by book, in one query.
    pub fn read_snapshot(&self) -> Result<KoboSnapshot> {
        let mut stmt = self.conn.prepare(SNAPSHOT_QUERY)?;
        let mut rows = stmt.query([])?;
        let mut books: Vec<KoboBook> = Vec::new();

        while let Some(row) = rows.next()? {
            let volume_id: String = row.get("VolumeID")?;
            if books.last().map(|b| &b.volume_id) != Some(&volume_id) {
                books.push(KoboBook {
                    volume_id: volume_id.clone(),
                    title: row.get("BookTitle")?,
                    author: row
                        .get::<_, Option<String>>("Attribution")?
                        .unwrap_or_else(|| "Unknown Author".to_string()),
                    isbn: row.get("ISBN")?,
                    publisher: row.get("Publisher")?,
                    language: row.get("Language")?,
                    description: row.get("Description")?,
                    date_last_read: row.get("DateLastRead")?,
                    image_id: row.get("ImageId")?,
                    highlights: Vec::new(),
                });
            }
            let book = books.last_mut().expect("pushed above");
            book.highlights.push(KoboHighlight {
                bookmark_id: row.get("BookmarkID")?,
                text: row.get("Text")?,
                annotation: row.get("Annotation")?,
                chapter_title: row.get("ChapterTitle")?,
                chapter_progress: row.get("ChapterProgress")?,
                container_path: row.get("StartContainerPath")?,
                date_created: row
                    .get::<_, Option<String>>("DateCreated")?
                    .unwrap_or_else(|| "Unknown".to_string()),
                date_modified: row.get("DateModified")?,
            });
        }

        Ok(KoboSnapshot { books })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Book;
    use rusqlite::Connection;
    use tempfile::NamedTempFile;

    /// Older fixtures predate DateModified and Description; add them before
    /// reading, so their positional INSERTs keep working.
    fn snapshot_books(path: &std::path::Path) -> Vec<KoboBook> {
        let conn = Connection::open(path).unwrap();
        let _ = conn.execute("ALTER TABLE Bookmark ADD COLUMN DateModified TEXT", []);
        let _ = conn.execute("ALTER TABLE Content ADD COLUMN Description TEXT", []);
        let _ = conn.execute("ALTER TABLE Content ADD COLUMN ImageId TEXT", []);
        drop(conn);
        KoboDatabase::open_read_only(path).unwrap().read_snapshot().unwrap().books
    }

    fn create_mock_db() -> NamedTempFile {
        let temp = NamedTempFile::new().unwrap();
        let conn = Connection::open(temp.path()).unwrap();

        // Create Bookmark table
        conn.execute(
            "CREATE TABLE Bookmark (
                BookmarkID TEXT PRIMARY KEY,
                ContentID TEXT,
                VolumeID TEXT,
                Text TEXT,
                Annotation TEXT,
                StartContainerPath TEXT,
                ChapterProgress REAL,
                DateCreated TEXT,
                Color TEXT
            )",
            [],
        )
        .unwrap();

        // Create Content table
        conn.execute(
            "CREATE TABLE Content (
                ContentID TEXT PRIMARY KEY,
                BookTitle TEXT,
                Title TEXT,
                Attribution TEXT,
                ISBN TEXT,
                Publisher TEXT,
                Language TEXT,
                DateLastRead TEXT,
                ContentType INTEGER
            )",
            [],
        )
        .unwrap();

        // Insert test data - Book content
        conn.execute(
            "INSERT INTO Content VALUES ('vol1', NULL, NULL, 'Test Author', 
             '123456789', 'Test Publisher', 'en', '2025-01-24', 6)",
            [],
        )
        .unwrap();

        // Insert test data - Chapter content
        conn.execute(
            "INSERT INTO Content VALUES ('vol1!section1', 'Test Book', 'Chapter 1', 
             'Test Author', '123456789', 'Test Publisher', 'en', '2025-01-24', 6)",
            [],
        )
        .unwrap();

        // Insert test highlight
        conn.execute(
            "INSERT INTO Bookmark VALUES ('hl1', 'vol1!section1', 'vol1', 
             'Test highlight text', 'My note', 'OEBPS/ch01.xhtml', 0.25, 
             '2025-01-24', 'yellow')",
            [],
        )
        .unwrap();

        temp
    }

    #[test]
    fn test_connect_to_database() {
        let mock_db = create_mock_db();
        let result = KoboDatabase::new(mock_db.path());
        assert!(result.is_ok());
    }

    #[test]
    fn test_extract_highlights() {
        let mock_db = create_mock_db();
        let books = snapshot_books(mock_db.path());

        assert_eq!(books.len(), 1);
        assert_eq!(books[0].title, "Test Book");
        assert_eq!(books[0].author, "Test Author");
        assert_eq!(books[0].highlights.len(), 1);
        assert_eq!(books[0].highlights[0].text, "Test highlight text");
    }

    #[test]
    fn test_file_path_normalization() {
        let temp = tempfile::NamedTempFile::new().unwrap();
        let conn = rusqlite::Connection::open(temp.path()).unwrap();

        // Create tables with all columns used in the query
        conn.execute("CREATE TABLE Bookmark (
            BookmarkID TEXT, 
            ContentID TEXT, 
            VolumeID TEXT, 
            Text TEXT, 
            Annotation TEXT,
            StartContainerPath TEXT,
            ChapterProgress REAL,
            DateCreated TEXT
        )", []).unwrap();
        
        conn.execute("CREATE TABLE Content (
            ContentID TEXT PRIMARY KEY, 
            BookTitle TEXT, 
            Title TEXT,
            Attribution TEXT, 
            ISBN TEXT,
            Publisher TEXT,
            Language TEXT,
            DateLastRead TEXT,
            ContentType INTEGER
        )", []).unwrap();

        // Insert book with Kobo style path
        let kobo_path = "file:///mnt/onboard/Books/MyBook.epub";
        conn.execute("INSERT INTO Content (ContentID, BookTitle, Attribution, ContentType) VALUES (?1, 'Title', 'Author', 6)", [kobo_path]).unwrap();
        conn.execute("INSERT INTO Bookmark (BookmarkID, ContentID, VolumeID, Text, DateCreated) VALUES ('hl1', 'chapter1', ?1, 'text', 'date')", [kobo_path]).unwrap();

        let books = snapshot_books(temp.path());

        assert_eq!(books.len(), 1);
        assert_eq!(Book::from(books[0].clone()).file_path, Some("Books/MyBook.epub".to_string()));
    }

    #[test]
    fn test_handle_null_annotation() {
        let mock_db = create_mock_db();
        let conn = Connection::open(mock_db.path()).unwrap();

        // Insert highlight without annotation
        conn.execute(
            "INSERT INTO Bookmark VALUES ('hl2', 'vol1!section1', 'vol1', 
             'Second highlight', NULL, 'OEBPS/ch01.xhtml', 0.50, 
             '2025-01-25', 'blue')",
            [],
        )
        .unwrap();

        let books = snapshot_books(mock_db.path());

        let second_highlight = books[0].highlights.iter().find(|h| h.bookmark_id == "hl2").unwrap();

        assert!(second_highlight.annotation.is_none());
    }

    #[test]
    fn test_empty_highlights_filtered() {
        let mock_db = create_mock_db();
        let conn = Connection::open(mock_db.path()).unwrap();

        // Insert bookmark with empty text (should be ignored)
        conn.execute(
            "INSERT INTO Bookmark VALUES ('hl3', 'vol1!section1', 'vol1',
             '', NULL, 'OEBPS/ch01.xhtml', 0.75, '2025-01-26', 'red')",
            [],
        )
        .unwrap();

        // Insert bookmark with NULL text (should be ignored)
        conn.execute(
            "INSERT INTO Bookmark VALUES ('hl4', 'vol1!section1', 'vol1',
             NULL, NULL, 'OEBPS/ch01.xhtml', 0.80, '2025-01-27', 'green')",
            [],
        )
        .unwrap();

        let books = snapshot_books(mock_db.path());

        // Should only have hl1, not hl3 or hl4
        assert_eq!(books[0].highlights.len(), 1);
        assert_eq!(books[0].highlights[0].bookmark_id, "hl1");
    }

    /// Helper to create a mock DB with ContentType 9 (pages) and 899 (TOC entries)
    fn create_mock_db_with_toc() -> NamedTempFile {
        let temp = NamedTempFile::new().unwrap();
        let conn = Connection::open(temp.path()).unwrap();

        conn.execute(
            "CREATE TABLE Bookmark (
                BookmarkID TEXT PRIMARY KEY,
                ContentID TEXT,
                VolumeID TEXT,
                Text TEXT,
                Annotation TEXT,
                StartContainerPath TEXT,
                ChapterProgress REAL,
                DateCreated TEXT,
                Color TEXT
            )",
            [],
        )
        .unwrap();

        conn.execute(
            "CREATE TABLE Content (
                ContentID TEXT,
                BookTitle TEXT,
                Title TEXT,
                Attribution TEXT,
                ISBN TEXT,
                Publisher TEXT,
                Language TEXT,
                DateLastRead TEXT,
                ContentType INTEGER
            )",
            [],
        )
        .unwrap();

        // Book-level entry (ContentType 6)
        conn.execute(
            "INSERT INTO Content VALUES ('file:///mnt/onboard/book.epub', 'My Book', 'My Book',
             'Author Name', '978-0000000000', 'Publisher', 'en', '2025-01-24', 6)",
            [],
        )
        .unwrap();

        // Chapter page entry (ContentType 9) — Title is a filename
        conn.execute(
            "INSERT INTO Content VALUES ('file:///mnt/onboard/book.epub!xhtml/chapter3.xhtml',
             'My Book', 'xhtml/chapter3.xhtml', 'Author Name', NULL, NULL, NULL, NULL, 9)",
            [],
        )
        .unwrap();

        // TOC entry (ContentType 899) — Title is the real chapter title
        conn.execute(
            "INSERT INTO Content VALUES ('file:///mnt/onboard/book.epub!xhtml/chapter3.xhtml-1',
             'My Book', 'Chapter 3: Connect Your Notes', NULL, NULL, NULL, NULL, NULL, 899)",
            [],
        )
        .unwrap();

        // Highlight pointing to the chapter page
        conn.execute(
            "INSERT INTO Bookmark VALUES ('hl-toc', 'file:///mnt/onboard/book.epub!xhtml/chapter3.xhtml',
             'file:///mnt/onboard/book.epub', 'A highlight text', NULL, NULL, 0.30,
             '2025-01-24', NULL)",
            [],
        )
        .unwrap();

        temp
    }

    #[test]
    fn test_chapter_title_from_toc() {
        // TOC entry (ContentType 899) should be preferred over page title (ContentType 9)
        let mock_db = create_mock_db_with_toc();
        let books = snapshot_books(mock_db.path());

        assert_eq!(books.len(), 1);
        assert_eq!(books[0].highlights.len(), 1);
        assert_eq!(
            books[0].highlights[0].chapter_title,
            Some("Chapter 3: Connect Your Notes".to_string())
        );
    }

    #[test]
    fn test_chapter_title_filename_filtered() {
        // When there's no TOC entry (899) and the CT9 title is a filename, it should be NULL
        let temp = NamedTempFile::new().unwrap();
        let conn = Connection::open(temp.path()).unwrap();

        conn.execute(
            "CREATE TABLE Bookmark (
                BookmarkID TEXT, ContentID TEXT, VolumeID TEXT, Text TEXT,
                Annotation TEXT, StartContainerPath TEXT, ChapterProgress REAL,
                DateCreated TEXT, Color TEXT
            )",
            [],
        )
        .unwrap();

        conn.execute(
            "CREATE TABLE Content (
                ContentID TEXT, BookTitle TEXT, Title TEXT, Attribution TEXT,
                ISBN TEXT, Publisher TEXT, Language TEXT, DateLastRead TEXT,
                ContentType INTEGER
            )",
            [],
        )
        .unwrap();

        // Book entry
        conn.execute(
            "INSERT INTO Content VALUES ('vol2', 'Filename Book', 'Filename Book',
             'Author', NULL, NULL, NULL, NULL, 6)",
            [],
        )
        .unwrap();

        // Chapter page with filename as title (no TOC entry exists)
        conn.execute(
            "INSERT INTO Content VALUES ('vol2!Text/011.xhtml', 'Filename Book',
             'Text/011.xhtml', 'Author', NULL, NULL, NULL, NULL, 9)",
            [],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO Bookmark VALUES ('hl-fn', 'vol2!Text/011.xhtml', 'vol2',
             'Some highlight', NULL, NULL, 0.10, '2025-01-25', NULL)",
            [],
        )
        .unwrap();

        let books = snapshot_books(temp.path());

        assert_eq!(books.len(), 1);
        // Filename should be filtered to NULL (not shown)
        assert_eq!(books[0].highlights[0].chapter_title, None);
    }

    #[test]
    fn test_chapter_title_fallback_to_ct9() {
        // When there's no TOC entry but CT9 title is a good title (not a filename),
        // it should be used as fallback
        let temp = NamedTempFile::new().unwrap();
        let conn = Connection::open(temp.path()).unwrap();

        conn.execute(
            "CREATE TABLE Bookmark (
                BookmarkID TEXT, ContentID TEXT, VolumeID TEXT, Text TEXT,
                Annotation TEXT, StartContainerPath TEXT, ChapterProgress REAL,
                DateCreated TEXT, Color TEXT
            )",
            [],
        )
        .unwrap();

        conn.execute(
            "CREATE TABLE Content (
                ContentID TEXT, BookTitle TEXT, Title TEXT, Attribution TEXT,
                ISBN TEXT, Publisher TEXT, Language TEXT, DateLastRead TEXT,
                ContentType INTEGER
            )",
            [],
        )
        .unwrap();

        // Book entry (sideloaded EPUB with good chapter titles in CT9)
        conn.execute(
            "INSERT INTO Content VALUES ('vol3', 'Good Book', 'Good Book',
             'Good Author', NULL, NULL, NULL, NULL, 6)",
            [],
        )
        .unwrap();

        // Chapter page with a good human-readable title (no TOC entry)
        conn.execute(
            "INSERT INTO Content VALUES ('vol3!ch1', 'Good Book',
             'Introduction', 'Good Author', NULL, NULL, NULL, NULL, 9)",
            [],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO Bookmark VALUES ('hl-good', 'vol3!ch1', 'vol3',
             'A good highlight', NULL, NULL, 0.05, '2025-01-26', NULL)",
            [],
        )
        .unwrap();

        let books = snapshot_books(temp.path());

        assert_eq!(books.len(), 1);
        // Good title from CT9 should be used as fallback
        assert_eq!(
            books[0].highlights[0].chapter_title,
            Some("Introduction".to_string())
        );
    }

    #[test]
    fn opening_is_read_only() {
        let mock_db = create_mock_db();
        let db = KoboDatabase::open_read_only(mock_db.path()).unwrap();

        let err = db.conn.execute("DELETE FROM Bookmark", []).unwrap_err();

        assert_eq!(
            err.sqlite_error_code(),
            Some(rusqlite::ErrorCode::ReadOnly)
        );
    }
}
