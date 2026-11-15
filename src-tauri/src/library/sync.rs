//! Merging a Kobo snapshot into the Library (R6 to R14).

use super::identity::{isbn_key, resolve_book, title_key};
use super::{Library, LibraryError, Result};
use crate::models::{KoboBook, KoboHighlight, KoboSnapshot};
use rusqlite::{params, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SyncReport {
    pub added: u32,
    pub updated: u32,
    pub removed: u32,
    pub restored: u32,
    pub books: u32,
}

fn has_text(h: &KoboHighlight) -> bool {
    !h.text.trim().is_empty()
}

impl Library {
    /// Brings the Library of the Reader that owns `serial` up to date with
    /// what the Kobo holds. All or nothing: any error or panic leaves the
    /// Library as it was (R14).
    pub fn sync(
        &mut self,
        serial: &str,
        snapshot: &KoboSnapshot,
        mut progress: impl FnMut(u32, u32),
    ) -> Result<SyncReport> {
        let reader_id = self.kobo(serial)?.ok_or(LibraryError::NotFound)?.reader_id;
        let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);

        let tx = self.conn.transaction()?;
        let mut report = SyncReport::default();
        let mut seen: HashSet<&str> = HashSet::new();
        let total = snapshot.books.len() as u32;

        for (index, book) in snapshot.books.iter().enumerate() {
            let highlights: Vec<&KoboHighlight> = book.highlights.iter().filter(|h| has_text(h)).collect();
            if let Some(book_id) = upsert_book(&tx, reader_id, book, !highlights.is_empty())? {
                for h in highlights {
                    seen.insert(h.bookmark_id.as_str());
                    upsert_highlight(&tx, reader_id, book_id, serial, h, &mut report)?;
                }
                report.books += 1;
            }
            progress(index as u32 + 1, total);
        }

        report.removed = mark_removed(&tx, reader_id, serial, &seen, &now)?;
        tx.execute(
            "UPDATE kobos SET last_sync_at = ?1 WHERE serial = ?2",
            params![now, serial],
        )?;
        tx.commit()?;
        Ok(report)
    }
}

/// Finds or creates the Library book (R10), refreshes its metadata (R11) and
/// records the Kobo path as one of its sources. A book never seen before is
/// only created when it brings highlights.
fn upsert_book(tx: &Transaction, reader_id: u32, book: &KoboBook, has_highlights: bool) -> Result<Option<u32>> {
    let isbn_k = book.isbn.as_deref().and_then(isbn_key);
    let title_k = title_key(&book.title, &book.author);

    let book_id = match resolve_book(tx, reader_id, book)? {
        Some(id) => {
            tx.execute(
                "UPDATE books SET title = ?1, author = ?2, isbn = ?3, isbn_key = ?4, title_key = ?5,
                 publisher = ?6, language = ?7, description = ?8, date_last_read = ?9
                 WHERE id = ?10",
                params![
                    book.title, book.author, book.isbn, isbn_k, title_k,
                    book.publisher, book.language, book.description, book.date_last_read, id
                ],
            )?;
            id
        }
        None if !has_highlights => return Ok(None),
        None => {
            tx.execute(
                "INSERT INTO books (reader_id, title, author, isbn, isbn_key, title_key,
                 publisher, language, description, date_last_read)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    reader_id, book.title, book.author, book.isbn, isbn_k, title_k,
                    book.publisher, book.language, book.description, book.date_last_read
                ],
            )?;
            tx.last_insert_rowid() as u32
        }
    };

    tx.execute(
        "INSERT OR IGNORE INTO book_sources (reader_id, volume_id, book_id) VALUES (?1, ?2, ?3)",
        params![reader_id, book.volume_id, book_id],
    )?;
    Ok(Some(book_id))
}

/// R8: new highlights are inserted with their origin Kobo; existing ones take
/// the Kobo's text, note, chapter and progress. Only the origin Kobo clears a
/// removal mark (Review Focus 1).
fn upsert_highlight(
    tx: &Transaction,
    reader_id: u32,
    book_id: u32,
    serial: &str,
    h: &KoboHighlight,
    report: &mut SyncReport,
) -> Result<()> {
    let existing: Option<(Option<String>, Option<String>)> = tx
        .query_row(
            "SELECT kobo_serial, removed_at FROM highlights WHERE reader_id = ?1 AND bookmark_id = ?2",
            params![reader_id, h.bookmark_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;

    let Some((origin, removed_at)) = existing else {
        tx.execute(
            "INSERT INTO highlights (reader_id, bookmark_id, book_id, kobo_serial, text, annotation,
             chapter_title, chapter_progress, container_path, date_created, date_modified)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                reader_id, h.bookmark_id, book_id, serial, h.text, h.annotation,
                h.chapter_title, h.chapter_progress, h.container_path, h.date_created, h.date_modified
            ],
        )?;
        report.added += 1;
        return Ok(());
    };

    let changed = tx.execute(
        "UPDATE highlights SET text = ?1, annotation = ?2, chapter_title = ?3, chapter_progress = ?4,
         container_path = ?5, date_modified = ?6
         WHERE reader_id = ?7 AND bookmark_id = ?8
           AND (text IS NOT ?1 OR annotation IS NOT ?2 OR chapter_title IS NOT ?3
                OR chapter_progress IS NOT ?4 OR container_path IS NOT ?5 OR date_modified IS NOT ?6)",
        params![
            h.text, h.annotation, h.chapter_title, h.chapter_progress,
            h.container_path, h.date_modified, reader_id, h.bookmark_id
        ],
    )?;
    if changed > 0 {
        report.updated += 1;
    }

    if removed_at.is_some() && origin.as_deref() == Some(serial) {
        tx.execute(
            "UPDATE highlights SET removed_at = NULL WHERE reader_id = ?1 AND bookmark_id = ?2",
            params![reader_id, h.bookmark_id],
        )?;
        report.restored += 1;
    }
    Ok(())
}

/// R9: highlights from this Kobo that it no longer holds get a removal date.
fn mark_removed(tx: &Transaction, reader_id: u32, serial: &str, seen: &HashSet<&str>, now: &str) -> Result<u32> {
    let ids: Vec<String> = {
        let mut stmt = tx.prepare(
            "SELECT bookmark_id FROM highlights
             WHERE reader_id = ?1 AND kobo_serial = ?2 AND removed_at IS NULL",
        )?;
        let rows = stmt.query_map(params![reader_id, serial], |r| r.get(0))?;
        rows.collect::<rusqlite::Result<_>>()?
    };

    let mut removed = 0;
    for id in ids.iter().filter(|id| !seen.contains(id.as_str())) {
        tx.execute(
            "UPDATE highlights SET removed_at = ?1 WHERE reader_id = ?2 AND bookmark_id = ?3",
            params![now, reader_id, id],
        )?;
        removed += 1;
    }
    Ok(removed)
}
