//! Shared fixtures for integration tests. Everything is created inside the
//! caller's temp dir; the personal KoboReader.sqlite never enters the repo.
#![allow(dead_code)]

use khi_lib::models::{KoboBook, KoboHighlight, KoboSnapshot};
use rusqlite::Connection;
use std::path::{Path, PathBuf};

pub fn hl(bookmark_id: &str, text: &str) -> KoboHighlight {
    KoboHighlight {
        bookmark_id: bookmark_id.to_string(),
        text: text.to_string(),
        date_created: "2026-10-01T10:00:00Z".to_string(),
        ..Default::default()
    }
}

pub fn kobo_book(volume_id: &str, title: &str, author: &str, highlights: Vec<KoboHighlight>) -> KoboBook {
    KoboBook {
        volume_id: volume_id.to_string(),
        title: title.to_string(),
        author: author.to_string(),
        highlights,
        ..Default::default()
    }
}

pub fn snapshot(books: Vec<KoboBook>) -> KoboSnapshot {
    KoboSnapshot { books }
}

/// Opens library.sqlite in `dir` with a plain connection, to check what the
/// Library wrote without depending on its read API.
pub fn library_conn(dir: &Path) -> Connection {
    Connection::open(dir.join("library.sqlite")).unwrap()
}

pub const BOOK_A: &str = "file:///mnt/onboard/a.epub";
pub const BOOK_B: &str = "file:///mnt/onboard/b.epub";

/// Creates a minimal KoboReader.sqlite with the columns the Khi reads:
/// two books (A with ISBN and description), three highlights with text,
/// one bookmark with empty text, and a TOC entry for A's chapter.
pub fn kobo_db(dir: &Path) -> PathBuf {
    let path = dir.join("KoboReader.sqlite");
    let conn = Connection::open(&path).unwrap();
    conn.execute_batch(
        "CREATE TABLE content (
            ContentID TEXT NOT NULL, ContentType INTEGER, BookTitle TEXT, Title TEXT,
            Attribution TEXT, ISBN TEXT, Publisher TEXT, Language TEXT,
            Description TEXT, DateLastRead TEXT, PRIMARY KEY (ContentID));
         CREATE TABLE Bookmark (
            BookmarkID TEXT NOT NULL, VolumeID TEXT NOT NULL, ContentID TEXT NOT NULL,
            StartContainerPath TEXT, Text TEXT, Annotation TEXT, DateCreated TEXT,
            ChapterProgress REAL NOT NULL DEFAULT 0, DateModified TEXT,
            PRIMARY KEY (BookmarkID));

         INSERT INTO content VALUES ('file:///mnt/onboard/a.epub', 6, NULL, 'Confiança',
            'Hernán Díaz', '978-972-0-04567-8', 'Pub A', 'pt', 'Uma descrição', '2026-11-01T10:00:00Z');
         INSERT INTO content VALUES ('file:///mnt/onboard/a.epub!OEBPS!ch1.xhtml', 9, 'Confiança',
            'ch1.xhtml', NULL, NULL, NULL, NULL, NULL, NULL);
         INSERT INTO content VALUES ('file:///mnt/onboard/a.epub!OEBPS!ch1.xhtml-1', 899, 'Confiança',
            'Capítulo 1', NULL, NULL, NULL, NULL, NULL, NULL);
         INSERT INTO content VALUES ('file:///mnt/onboard/b.epub', 6, NULL, 'Duly Noted',
            'Jorge Arango', NULL, NULL, 'en', NULL, NULL);

         INSERT INTO Bookmark VALUES ('a1', 'file:///mnt/onboard/a.epub',
            'file:///mnt/onboard/a.epub!OEBPS!ch1.xhtml', 'OEBPS/ch1.xhtml', 'Primeiro', 'Nota a1',
            '2026-10-01T10:00:00Z', 0.1, '2026-10-02T10:00:00Z');
         INSERT INTO Bookmark VALUES ('a2', 'file:///mnt/onboard/a.epub',
            'file:///mnt/onboard/a.epub!OEBPS!ch1.xhtml', 'OEBPS/ch1.xhtml', 'Segundo', NULL,
            '2026-10-03T10:00:00Z', 0.2, NULL);
         INSERT INTO Bookmark VALUES ('b1', 'file:///mnt/onboard/b.epub',
            'file:///mnt/onboard/b.epub!ch.xhtml', 'ch.xhtml', 'Terceiro', NULL,
            '2026-10-04T10:00:00Z', 0.5, NULL);
         INSERT INTO Bookmark VALUES ('b-empty', 'file:///mnt/onboard/b.epub',
            'file:///mnt/onboard/b.epub!ch.xhtml', 'ch.xhtml', '', NULL,
            '2026-10-05T10:00:00Z', 0.6, NULL);

         ALTER TABLE content ADD COLUMN ImageId TEXT;
         -- Not the ContentID: on a real Kobo the two differ
         UPDATE content SET ImageId = 'c6c0e484-4956-40c0-83a0-c9b4e01c0645'
            WHERE ContentID = 'file:///mnt/onboard/a.epub';",
    )
    .unwrap();
    path
}
