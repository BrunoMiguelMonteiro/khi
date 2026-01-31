use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub content_id: String,
    pub title: String,
    pub author: String,
    pub isbn: Option<String>,
    pub publisher: Option<String>,
    pub language: Option<String>,
    pub date_last_read: Option<String>,
    pub description: Option<String>,
    pub cover_path: Option<String>,
    pub highlights: Vec<Highlight>,
}

impl Book {
    pub fn new(content_id: String, title: String, author: String) -> Self {
        Self {
            content_id,
            title,
            author,
            isbn: None,
            publisher: None,
            language: None,
            date_last_read: None,
            description: None,
            cover_path: None,
            highlights: Vec::new(),
        }
    }

    pub fn highlight_count(&self) -> usize {
        self.highlights.len()
    }

    pub fn add_highlight(&mut self, highlight: Highlight) {
        self.highlights.push(highlight);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Highlight {
    pub id: String,
    pub text: String,
    pub annotation: Option<String>,
    pub personal_note: Option<String>,
    pub chapter_title: Option<String>,
    pub chapter_progress: Option<f64>,
    pub container_path: Option<String>,
    pub date_created: String,
    pub color: Option<String>,
    pub is_excluded: bool,
    pub edited_text: Option<String>,
}

impl Highlight {
    pub fn new(id: String, text: String, date_created: String) -> Self {
        Self {
            id,
            text,
            date_created,
            annotation: None,
            personal_note: None,
            chapter_title: None,
            chapter_progress: None,
            container_path: None,
            color: None,
            is_excluded: false,
            edited_text: None,
        }
    }

    pub fn display_text(&self) -> &str {
        self.edited_text.as_deref().unwrap_or(&self.text)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KoboDevice {
    pub name: String,
    pub path: String,
    pub is_valid: bool,
    pub serial_number: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProgress {
    pub current_book: String,
    pub books_processed: usize,
    pub total_books: usize,
    pub highlights_found: usize,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportConfig {
    #[serde(alias = "export_path")]
    pub export_path: String,
    pub metadata: MetadataConfig,
    #[serde(alias = "date_format")]
    pub date_format: DateFormat,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MetadataConfig {
    pub author: bool,
    pub isbn: bool,
    pub publisher: bool,
    #[serde(alias = "date_last_read")]
    pub date_last_read: bool,
    pub language: bool,
    pub description: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DateFormat {
    DdMmYyyy,
    DdMonthYyyy,
    Iso8601,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_book_creation() {
        let book = Book::new(
            "content123".to_string(),
            "Test Book".to_string(),
            "Test Author".to_string(),
        );
        assert_eq!(book.content_id, "content123");
        assert_eq!(book.title, "Test Book");
        assert_eq!(book.author, "Test Author");
        assert!(book.highlights.is_empty());
        assert_eq!(book.highlight_count(), 0);
    }

    #[test]
    fn test_book_add_highlight() {
        let mut book = Book::new("id1".to_string(), "Title".to_string(), "Author".to_string());
        let highlight = Highlight::new(
            "hl1".to_string(),
            "Test highlight".to_string(),
            "2025-01-24".to_string(),
        );
        
        book.add_highlight(highlight);
        
        assert_eq!(book.highlight_count(), 1);
        assert_eq!(book.highlights[0].text, "Test highlight");
    }

    #[test]
    fn test_highlight_creation() {
        let highlight = Highlight::new(
            "hl123".to_string(),
            "Test highlight text".to_string(),
            "2025-01-24".to_string(),
        );
        
        assert_eq!(highlight.id, "hl123");
        assert_eq!(highlight.text, "Test highlight text");
        assert_eq!(highlight.date_created, "2025-01-24");
        assert!(highlight.annotation.is_none());
        assert!(!highlight.is_excluded);
    }

    #[test]
    fn test_highlight_display_text() {
        let highlight = Highlight::new(
            "hl1".to_string(),
            "Original text".to_string(),
            "2025-01-24".to_string(),
        );
        
        assert_eq!(highlight.display_text(), "Original text");
        
        let mut edited_highlight = highlight.clone();
        edited_highlight.edited_text = Some("Edited text".to_string());
        
        assert_eq!(edited_highlight.display_text(), "Edited text");
    }

    #[test]
    fn test_highlight_serialization() {
        let highlight = Highlight {
            id: "hl123".to_string(),
            text: "Test highlight".to_string(),
            annotation: Some("My annotation".to_string()),
            personal_note: None,
            chapter_title: Some("Chapter 1".to_string()),
            chapter_progress: Some(0.25),
            container_path: Some("OEBPS/ch01.xhtml".to_string()),
            date_created: "2025-01-24".to_string(),
            color: Some("yellow".to_string()),
            is_excluded: false,
            edited_text: None,
        };
        
        let json = serde_json::to_string(&highlight).unwrap();
        assert!(json.contains("Test highlight"));
        // Expect camelCase keys
        assert!(json.contains("chapterTitle")); 
        
        let deserialized: Highlight = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, highlight);
    }

    #[test]
    fn test_book_serialization() {
        let mut book = Book::new("id1".to_string(), "Title".to_string(), "Author".to_string());
        book.isbn = Some("978-1234567890".to_string());
        
        let json = serde_json::to_string(&book).unwrap();
        assert!(json.contains("Title"));
        // Expect camelCase keys
        assert!(json.contains("contentId"));
        
        let deserialized: Book = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, book);
    }

    #[test]
    fn test_kobo_device_creation() {
        let device = KoboDevice {
            name: "KOBOeReader".to_string(),
            path: "/Volumes/KOBOeReader".to_string(),
            is_valid: true,
            serial_number: Some("SN12345".to_string()),
        };
        
        assert_eq!(device.name, "KOBOeReader");
        assert!(device.is_valid);
        
        let json = serde_json::to_string(&device).unwrap();
        // Expect camelCase keys
        assert!(json.contains("serialNumber"));
    }

    #[test]
    fn test_export_config_default() {
        let config = ExportConfig {
            export_path: "~/Documents/Kobo Highlights".to_string(),
            metadata: MetadataConfig {
                author: true,
                isbn: true,
                publisher: true,
                date_last_read: false,
                language: false,
                description: false,
            },
            date_format: DateFormat::DdMonthYyyy,
        };
        
        assert!(config.metadata.author);
        assert!(!config.metadata.description);
    }
}
