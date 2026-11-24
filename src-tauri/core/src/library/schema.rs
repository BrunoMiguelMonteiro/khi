//! Library schema, as numbered migrations. Migration N (1-based) brings the
//! database to `PRAGMA user_version = N`. Never edit a shipped migration:
//! append a new one.

pub const MIGRATIONS: &[&str] = &[
    // v1
    "CREATE TABLE readers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        export_path TEXT
    );
    CREATE TABLE kobos (
        serial TEXT PRIMARY KEY,
        reader_id INTEGER NOT NULL REFERENCES readers(id),
        last_sync_at TEXT
    );
    CREATE TABLE books (
        id INTEGER PRIMARY KEY,
        reader_id INTEGER NOT NULL REFERENCES readers(id),
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        isbn TEXT,
        isbn_key TEXT,
        title_key TEXT,
        publisher TEXT,
        language TEXT,
        description TEXT,
        date_last_read TEXT,
        cover_file TEXT
    );
    CREATE TABLE book_sources (
        reader_id INTEGER NOT NULL REFERENCES readers(id),
        volume_id TEXT NOT NULL,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        PRIMARY KEY (reader_id, volume_id)
    );
    CREATE TABLE highlights (
        reader_id INTEGER NOT NULL REFERENCES readers(id),
        bookmark_id TEXT NOT NULL,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        kobo_serial TEXT,
        text TEXT NOT NULL,
        annotation TEXT,
        chapter_title TEXT,
        chapter_progress REAL,
        container_path TEXT,
        date_created TEXT,
        date_modified TEXT,
        removed_at TEXT,
        PRIMARY KEY (reader_id, bookmark_id)
    );
    CREATE INDEX highlights_book ON highlights(book_id);
    CREATE TABLE meta (
        key TEXT PRIMARY KEY,
        value TEXT
    );",
    // v2: the sync sequence behind «novo»
    "ALTER TABLE highlights ADD COLUMN synced_seq INTEGER;
    ALTER TABLE highlights ADD COLUMN synced_at TEXT;
    ALTER TABLE books ADD COLUMN opened_seq INTEGER;",
];
