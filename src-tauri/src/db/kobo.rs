use crate::models::{Book, Highlight};
use rusqlite::{Connection, Result};
use std::collections::HashMap;

pub struct KoboDatabase {
    conn: Connection,
}

impl KoboDatabase {
    pub fn new(path: &std::path::Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        Ok(Self { conn })
    }

    pub fn extract_books_with_highlights(&self) -> Result<Vec<Book>> {
        log::info!("Starting extract_books_with_highlights");

        // First, check if tables exist and have data
        let count_result: Result<i64, _> = self.conn.query_row(
            "SELECT COUNT(*) FROM Bookmark WHERE Text IS NOT NULL AND Text != ''",
            [],
            |row| row.get(0),
        );

        match count_result {
            Ok(count) => log::info!("Found {} bookmarks with text", count),
            Err(e) => {
                log::error!("Error counting bookmarks: {}", e);
                // Continue anyway to try the main query and get detailed error
            }
        }

        // Query to get all bookmarks (highlights) with their content info
        // We need three JOINs:
        // 1. c_book: joined by VolumeID to get book metadata (author, ISBN, etc.)
        // 2. c_chapter: joined by ContentID to get chapter title (ContentType 9 — XHTML page)
        // 3. c_toc: joined by ContentID prefix to get real chapter title (ContentType 899 — TOC entry)
        //    TOC entries have ContentID = page ContentID + suffix "-N" (e.g., "-1", "-2")
        let query = "SELECT
                b.BookmarkID,
                b.ContentID,
                b.VolumeID,
                b.Text,
                b.Annotation,
                b.StartContainerPath,
                b.ChapterProgress,
                b.DateCreated,
                COALESCE(c_book.Title, c_book.BookTitle, c_chapter.BookTitle, c_chapter.Title, 'Unknown Title') as BookTitle,
                COALESCE(
                    c_toc.Title,
                    CASE WHEN c_chapter.Title IS NOT NULL
                              AND c_chapter.Title NOT LIKE '%.xhtml%'
                              AND c_chapter.Title NOT LIKE '%.html%'
                              AND c_chapter.Title NOT LIKE '%.htm%'
                              AND c_chapter.Title NOT LIKE '%/%'
                         THEN c_chapter.Title
                         ELSE NULL
                    END
                ) as ChapterTitle,
                c_book.Attribution,
                c_book.ISBN,
                c_book.Publisher,
                c_book.Language,
                c_book.DateLastRead
             FROM Bookmark b
             LEFT JOIN content c_book ON b.VolumeID = c_book.ContentID
             LEFT JOIN content c_chapter ON b.ContentID = c_chapter.ContentID
             LEFT JOIN content c_toc ON c_toc.ContentType = 899
                AND c_toc.ContentID LIKE b.ContentID || '%'
             WHERE b.Text IS NOT NULL AND b.Text != ''
             ORDER BY BookTitle, b.DateCreated";

        let mut stmt = self.conn.prepare(query).map_err(|e| {
            log::error!("Failed to prepare query: {}", e);
            e
        })?;

        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>("BookmarkID")?,
                // Use VolumeID as the grouping key for the book, as ContentID is specific to the chapter/fragment
                row.get::<_, String>("VolumeID")?,
                row.get::<_, Option<String>>("BookTitle")?,
                row.get::<_, Option<String>>("ChapterTitle")?,
                row.get::<_, Option<String>>("Attribution")?,
                row.get::<_, Option<String>>("Text")?,
                row.get::<_, Option<String>>("Annotation")?,
                row.get::<_, Option<String>>("StartContainerPath")?,
                row.get::<_, Option<f64>>("ChapterProgress")?,
                row.get::<_, Option<String>>("DateCreated")?,
                row.get::<_, Option<String>>("ISBN")?,
                row.get::<_, Option<String>>("Publisher")?,
                row.get::<_, Option<String>>("Language")?,
                row.get::<_, Option<String>>("DateLastRead")?,
            ))
        })?;

        // Group highlights by book
        let mut books_map: HashMap<String, Book> = HashMap::new();

        for row in rows {
            let (
                bookmark_id,
                volume_id, // This is our book ID
                book_title,
                chapter_title,
                attribution,
                text,
                annotation,
                container_path,
                chapter_progress,
                date_created,
                isbn,
                publisher,
                language,
                date_last_read,
            ) = row?;

            // Skip if no text
            let text = match text {
                Some(t) if !t.is_empty() => t,
                _ => continue,
            };

            // Get or create book using volume_id as key
            let book = books_map.entry(volume_id.clone()).or_insert_with(|| {
                let mut b = Book::new(
                    volume_id.clone(),
                    book_title
                        .clone()
                        .unwrap_or_else(|| "Unknown Title".to_string()),
                    attribution
                        .clone()
                        .unwrap_or_else(|| "Unknown Author".to_string()),
                );

                // Set file path if it looks like a local file
                if volume_id.starts_with("file:///mnt/onboard/") {
                    b.file_path = Some(volume_id.replace("file:///mnt/onboard/", ""));
                }
                
                b
            });

            // Update book metadata if available
            if book.isbn.is_none() && isbn.is_some() {
                book.isbn = isbn;
            }
            if book.publisher.is_none() && publisher.is_some() {
                book.publisher = publisher;
            }
            if book.language.is_none() && language.is_some() {
                book.language = language;
            }
            if book.date_last_read.is_none() && date_last_read.is_some() {
                book.date_last_read = date_last_read;
            }

            // Create highlight
            let highlight = Highlight {
                id: bookmark_id,
                text,
                annotation,
                chapter_title,
                chapter_progress,
                container_path,
                date_created: date_created.unwrap_or_else(|| "Unknown".to_string()),
                color: None, // Color não disponível neste modelo
            };

            book.highlights.push(highlight);
        }

        // Convert HashMap to Vec
        let mut books: Vec<Book> = books_map.into_values().collect();

        log::info!("Total distinct books collected in HashMap: {}", books.len());
        for b in &books {
            log::info!(
                "Book collected: '{}' by '{}' with {} highlights",
                b.title,
                b.author,
                b.highlights.len()
            );
        }

        // Sort books by title
        books.sort_by(|a, b| a.title.cmp(&b.title));

        Ok(books)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use tempfile::NamedTempFile;

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
        let db = KoboDatabase::new(mock_db.path()).unwrap();

        let books = db.extract_books_with_highlights().unwrap();

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

        let db = KoboDatabase::new(temp.path()).unwrap();
        let books = db.extract_books_with_highlights().unwrap();

        assert_eq!(books.len(), 1);
        assert_eq!(books[0].file_path, Some("Books/MyBook.epub".to_string()));
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

        let db = KoboDatabase::new(mock_db.path()).unwrap();
        let books = db.extract_books_with_highlights().unwrap();

        let second_highlight = books[0].highlights.iter().find(|h| h.id == "hl2").unwrap();

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

        let db = KoboDatabase::new(mock_db.path()).unwrap();
        let books = db.extract_books_with_highlights().unwrap();

        // Should only have hl1, not hl3 or hl4
        assert_eq!(books[0].highlights.len(), 1);
        assert_eq!(books[0].highlights[0].id, "hl1");
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
        let db = KoboDatabase::new(mock_db.path()).unwrap();

        let books = db.extract_books_with_highlights().unwrap();

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

        let db = KoboDatabase::new(temp.path()).unwrap();
        let books = db.extract_books_with_highlights().unwrap();

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

        let db = KoboDatabase::new(temp.path()).unwrap();
        let books = db.extract_books_with_highlights().unwrap();

        assert_eq!(books.len(), 1);
        // Good title from CT9 should be used as fallback
        assert_eq!(
            books[0].highlights[0].chapter_title,
            Some("Introduction".to_string())
        );
    }
}
