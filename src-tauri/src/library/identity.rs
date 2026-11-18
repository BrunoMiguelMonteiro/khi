//! How the Library recognises a Kobo book it already has (R10).

use super::Result;
use crate::models::KoboBook;
use rusqlite::{params, OptionalExtension, Transaction};
use unicode_normalization::char::is_combining_mark;
use unicode_normalization::UnicodeNormalization;

/// Lowercase, accents stripped (NFD minus combining marks), punctuation
/// dropped and whitespace collapsed.
fn normalize(s: &str) -> String {
    let cleaned: String = s
        .nfd()
        .filter(|c| !is_combining_mark(*c))
        .flat_map(char::to_lowercase)
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect();
    cleaned.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// `"{title}|{author}"`, normalised. `None` when the Kobo has no real title.
pub fn title_key(title: &str, author: &str) -> Option<String> {
    let title = normalize(title);
    if title.is_empty() || title == "unknown title" {
        return None;
    }
    Some(format!("{}|{}", title, normalize(author)))
}

/// Digits and `X` only. `None` when shorter than an ISBN-10.
pub fn isbn_key(isbn: &str) -> Option<String> {
    let key: String = isbn
        .chars()
        .filter_map(|c| match c {
            '0'..='9' => Some(c),
            'x' | 'X' => Some('X'),
            _ => None,
        })
        .collect();
    (key.len() >= 10).then_some(key)
}

/// Finds the Library book this Kobo book is, within one Reader: first by the
/// path on the Kobo, then by ISBN, then by title and author.
pub(crate) fn resolve_book(tx: &Transaction, reader_id: u32, book: &KoboBook) -> Result<Option<u32>> {
    let by_source: Option<u32> = tx
        .query_row(
            "SELECT book_id FROM book_sources WHERE reader_id = ?1 AND volume_id = ?2",
            params![reader_id, book.volume_id],
            |r| r.get(0),
        )
        .optional()?;
    if by_source.is_some() {
        return Ok(by_source);
    }

    let lookups = [
        ("isbn_key", book.isbn.as_deref().and_then(isbn_key)),
        ("title_key", title_key(&book.title, &book.author)),
    ];
    for (column, key) in lookups {
        let Some(key) = key else { continue };
        let found: Option<u32> = tx
            .query_row(
                &format!(
                    "SELECT id FROM books WHERE reader_id = ?1 AND {} = ?2 ORDER BY id LIMIT 1",
                    column
                ),
                params![reader_id, key],
                |r| r.get(0),
            )
            .optional()?;
        if found.is_some() {
            return Ok(found);
        }
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn title_key_ignores_case_accents_punctuation_and_spacing() {
        assert_eq!(
            title_key("Confiança", "Hernán Díaz"),
            title_key("CONFIANCA!", "hernan  diaz")
        );
        assert_eq!(
            title_key("Confiança", "Hernán Díaz").as_deref(),
            Some("confianca|hernan diaz")
        );
    }

    #[test]
    fn title_key_is_none_for_unknown_or_empty_title() {
        assert_eq!(title_key("Unknown Title", "Unknown Author"), None);
        assert_eq!(title_key("  ", "Someone"), None);
    }

    #[test]
    fn isbn_key_keeps_only_digits_and_x() {
        assert_eq!(isbn_key("978-972-0-04567-8"), isbn_key("9789720045678"));
        assert_eq!(isbn_key("0-306-40615-x").as_deref(), Some("030640615X"));
    }

    #[test]
    fn isbn_key_is_none_when_too_short() {
        assert_eq!(isbn_key("12-34"), None);
        assert_eq!(isbn_key(""), None);
    }
}
