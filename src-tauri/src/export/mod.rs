use crate::models::{Book, DateFormat, ExportConfig, Highlight, Language};
use chrono::Datelike;
use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

/// Structured data for a single highlight (for frontend export)
#[derive(Serialize)]
pub struct ExportHighlightData {
    pub id: String,
    pub text: String,
    pub chapter: Option<String>,
    pub location: String,
    pub date: String,
    pub note: Option<String>,
    pub is_edited: bool,
}

/// Structured data for a book export (for frontend export)
#[derive(Serialize)]
pub struct ExportBookData {
    pub title: String,
    pub author: String,
    pub isbn: Option<String>,
    pub publisher: Option<String>,
    pub language: Option<String>,
    pub read_date: Option<String>,
    pub description: Option<String>,
    pub highlights: Vec<ExportHighlightData>,
}

pub struct MarkdownExporter {
    export_dir: PathBuf,
    language: Language,
}

/// The words the Markdown writes around the book's own text.
struct Labels {
    author: &'static str,
    publisher: &'static str,
    last_read: &'static str,
    language: &'static str,
    note: &'static str,
    months: [&'static str; 12],
}

const PT: Labels = Labels {
    author: "Autor",
    publisher: "Editora",
    last_read: "Data de leitura",
    language: "Idioma",
    note: "Nota",
    months: [
        "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro",
        "outubro", "novembro", "dezembro",
    ],
};

const EN: Labels = Labels {
    author: "Author",
    publisher: "Publisher",
    last_read: "Last read",
    language: "Language",
    note: "Note",
    months: [
        "January", "February", "March", "April", "May", "June", "July", "August", "September",
        "October", "November", "December",
    ],
};

const ES: Labels = Labels {
    author: "Autor",
    publisher: "Editorial",
    last_read: "Fecha de lectura",
    language: "Idioma",
    note: "Nota",
    months: [
        "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre",
        "octubre", "noviembre", "diciembre",
    ],
};

const FR: Labels = Labels {
    author: "Auteur",
    publisher: "Éditeur",
    last_read: "Date de lecture",
    language: "Langue",
    note: "Note",
    months: [
        "janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre",
        "octobre", "novembre", "décembre",
    ],
};

fn labels(language: Language) -> &'static Labels {
    match language {
        Language::Pt => &PT,
        Language::En => &EN,
        Language::Es => &ES,
        Language::Fr => &FR,
    }
}

impl MarkdownExporter {
    pub fn new(export_dir: PathBuf) -> Self {
        log::info!("[EXPORTER] Criando MarkdownExporter");
        log::info!("[EXPORTER] Export directory: {:?}", export_dir);

        // Ensure export directory exists
        if !export_dir.exists() {
            log::info!("[EXPORTER] Diretório não existe, a criar...");
            match fs::create_dir_all(&export_dir) {
                Ok(_) => log::info!("[EXPORTER] ✅ Diretório criado com sucesso"),
                Err(e) => {
                    log::error!("[EXPORTER] ❌ Erro fatal ao criar diretório: {}", e);
                    panic!("Failed to create export directory: {}", e);
                }
            }
        } else {
            log::info!("[EXPORTER] ✅ Diretório já existe");
        }
        // Portuguese is what the exporter always wrote before the setting
        Self { export_dir, language: Language::Pt }
    }

    /// Writes the Markdown's labels and month names in `language`.
    pub fn with_language(mut self, language: Language) -> Self {
        self.language = language;
        self
    }

    /// Export a single book to markdown
    pub fn export_book(&self, book: &Book, config: &ExportConfig) -> Result<PathBuf, ExportError> {
        log::info!("[EXPORTER] A exportar livro: '{}'", book.title);

        log::info!("[EXPORTER] A gerar filename...");
        let filename = generate_filename(book);
        log::info!("[EXPORTER] Filename gerado: {}", filename);

        let file_path = self.export_dir.join(&filename);
        log::info!("[EXPORTER] Path completo: {:?}", file_path);

        log::info!("[EXPORTER] A gerar markdown...");
        let markdown = self.generate_markdown(book, config);
        log::info!("[EXPORTER] Markdown gerado ({} bytes)", markdown.len());

        log::info!("[EXPORTER] A criar ficheiro...");
        let mut file = fs::File::create(&file_path)?;
        log::info!("[EXPORTER] A escrever conteúdo...");
        file.write_all(markdown.as_bytes())?;
        log::info!(
            "[EXPORTER] ✅ Ficheiro escrito com sucesso: {:?}",
            file_path
        );

        Ok(file_path)
    }

    /// Export multiple books to markdown files
    pub fn export_books(
        &self,
        books: &[Book],
        config: &ExportConfig,
    ) -> Vec<Result<PathBuf, ExportError>> {
        log::info!("[EXPORTER] ==========================================");
        log::info!(
            "[EXPORTER] Iniciando exportação de {} livro(s)",
            books.len()
        );
        log::info!("[EXPORTER] Diretório de exportação: {:?}", self.export_dir);

        // Verificar se diretório existe
        if !self.export_dir.exists() {
            log::info!("[EXPORTER] Diretório não existe, a criar...");
            match fs::create_dir_all(&self.export_dir) {
                Ok(_) => log::info!("[EXPORTER] ✅ Diretório criado com sucesso"),
                Err(e) => {
                    log::error!("[EXPORTER] ❌ Falha ao criar diretório: {}", e);
                    return vec![Err(ExportError::Io(e))];
                }
            }
        } else {
            log::info!("[EXPORTER] ✅ Diretório já existe");
        }

        let mut results = Vec::new();

        for (i, book) in books.iter().enumerate() {
            log::info!(
                "[EXPORTER] --- A processar livro {}/{} ---",
                i + 1,
                books.len()
            );
            let result = self.export_book(book, config);
            results.push(result);
        }

        let success_count = results.iter().filter(|r| r.is_ok()).count();
        let error_count = results.len() - success_count;
        log::info!("[EXPORTER] ==========================================");
        log::info!(
            "[EXPORTER] Exportação concluída: {} sucesso, {} erro(s)",
            success_count,
            error_count
        );

        results
    }

    /// Export book as structured data for frontend processing
    pub fn export_book_data(&self, book: &Book, config: &ExportConfig) -> ExportBookData {
        // Use all highlights (editing features removed)
        let highlights: Vec<&Highlight> = book.highlights.iter().collect();

        // Convert highlights to export data
        let highlights_data: Vec<ExportHighlightData> = highlights
            .iter()
            .map(|h| {
                // Build location string
                let mut location_parts: Vec<String> = Vec::new();
                if let Some(chapter_title) = &h.chapter_title {
                    location_parts.push(chapter_title.clone());
                }
                if let Some(progress) = h.chapter_progress {
                    location_parts.push(format!("{}%", (progress * 100.0) as i32));
                }
                let location = location_parts.join(" · ");

                ExportHighlightData {
                    id: h.id.clone(),
                    text: h.text.clone(),
                    chapter: h.chapter_title.clone(),
                    location,
                    date: h.date_created.clone(),
                    note: note_text(h).map(str::to_string),
                    is_edited: false,
                }
            })
            .collect();

        // Format read date if present
        let read_date = book
            .date_last_read
            .as_ref()
            .map(|d| format_date(d, &config.date_format, self.language));

        ExportBookData {
            title: book.title.clone(),
            author: book.author.clone(),
            isbn: book.isbn.clone(),
            publisher: book.publisher.clone(),
            language: book.language.clone(),
            read_date,
            description: book.description.clone(),
            highlights: highlights_data,
        }
    }

    /// Generate markdown content for a book
    fn generate_markdown(&self, book: &Book, config: &ExportConfig) -> String {
        let words = labels(self.language);
        let mut lines: Vec<String> = Vec::new();

        // Title
        lines.push(format!("# {}", book.title));
        lines.push(String::new());

        // Metadata
        let mut metadata: Vec<String> = Vec::new();

        if config.metadata.author && !book.author.is_empty() {
            metadata.push(format!("**{}**: {}", words.author, book.author));
        }
        if config.metadata.isbn && book.isbn.is_some() {
            metadata.push(format!("**ISBN**: {}", book.isbn.as_ref().unwrap()));
        }
        if config.metadata.publisher && book.publisher.is_some() {
            metadata.push(format!(
                "**{}**: {}",
                words.publisher,
                book.publisher.as_ref().unwrap()
            ));
        }
        if config.metadata.date_last_read && book.date_last_read.is_some() {
            let formatted =
                format_date(book.date_last_read.as_ref().unwrap(), &config.date_format, self.language);
            metadata.push(format!("**{}**: {}", words.last_read, formatted));
        }
        if config.metadata.language && book.language.is_some() {
            metadata.push(format!("**{}**: {}", words.language, book.language.as_ref().unwrap()));
        }
        if config.metadata.description && book.description.is_some() {
            metadata.push(String::new());
            metadata.push(book.description.as_ref().unwrap().clone());
        }

        if !metadata.is_empty() {
            lines.extend(metadata);
            lines.push(String::new());
        }

        if book.highlights.is_empty() {
            return lines.join("\n");
        }

        lines.push("---".to_string());
        lines.push(String::new());

        // Render highlights sequentially (no chapter grouping)
        for highlight in &book.highlights {
            lines.push(self.generate_highlight_markdown(highlight, config));
        }

        lines.join("\n")
    }

    /// Generate markdown for a single highlight
    fn generate_highlight_markdown(&self, highlight: &Highlight, _config: &ExportConfig) -> String {
        let mut lines: Vec<String> = Vec::new();

        // Highlight text as blockquote
        lines.push(format!("> {}", highlight.text));

        // Kobo note, if any, right under its quote
        if let Some(note) = note_text(highlight) {
            let body: Vec<&str> = note
                .lines()
                .map(str::trim)
                .filter(|l| !l.is_empty())
                .collect();
            lines.push(String::new());
            lines.push(format!("**{}:** {}", labels(self.language).note, body.join("  \n")));
        }

        // Location info (no label, just the value)
        let mut location_parts: Vec<String> = Vec::new();
        if let Some(chapter_title) = &highlight.chapter_title {
            location_parts.push(chapter_title.clone());
        }
        if let Some(progress) = highlight.chapter_progress {
            location_parts.push(format!("{}%", (progress * 100.0) as i32));
        }

        if !location_parts.is_empty() {
            lines.push(String::new());
            lines.push(location_parts.join(" · "));
            lines.push(String::new());
        }

        lines.join("\n")
    }

    /// Get the export directory path
    pub fn export_dir(&self) -> &Path {
        &self.export_dir
    }
}

/// The highlight's Kobo note, or `None` when it has none. Kobo stores `""`
/// for highlights without a note, so empty and whitespace-only count as none.
fn note_text(highlight: &Highlight) -> Option<&str> {
    highlight
        .annotation
        .as_deref()
        .map(str::trim)
        .filter(|n| !n.is_empty())
}

/// Generate a filename for the book
pub fn generate_filename(book: &Book) -> String {
    let sanitized_title = sanitize_filename(&book.title);
    let sanitized_author = sanitize_filename(&book.author);
    format!("{} - {}.md", sanitized_title, sanitized_author)
}

/// Sanitize a filename by removing invalid characters
fn sanitize_filename(filename: &str) -> String {
    if filename.trim().is_empty() {
        return "Untitled".to_string();
    }

    filename
        .trim()
        .replace(':', " -")
        .replace(['/', '\\', '?', '*', '|', '"', '<', '>'], "-")
        .replace(|c: char| c.is_ascii_control(), "")
}

/// Format a date according to the specified format
fn format_date(date_str: &str, format: &DateFormat, language: Language) -> String {
    // Try to parse the date
    if let Ok(date) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        match format {
            DateFormat::DdMmYyyy => date.format("%d/%m/%Y").to_string(),
            DateFormat::DdMonthYyyy => {
                let month_name = labels(language).months[(date.month() - 1) as usize];
                match language {
                    Language::Pt | Language::Es => format!("{} de {} de {}", date.day(), month_name, date.year()),
                    Language::En => format!("{:02} {} {}", date.day(), month_name, date.year()),
                    // The first of the month is «1er»
                    Language::Fr if date.day() == 1 => format!("1er {} {}", month_name, date.year()),
                    Language::Fr => format!("{} {} {}", date.day(), month_name, date.year()),
                }
            }
            DateFormat::Iso8601 => date.format("%Y-%m-%d").to_string(),
        }
    } else {
        date_str.to_string()
    }
}

#[derive(Debug)]
pub enum ExportError {
    Io(std::io::Error),
}

impl std::fmt::Display for ExportError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExportError::Io(e) => write!(f, "IO error: {}", e),
        }
    }
}

impl std::error::Error for ExportError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ExportError::Io(e) => Some(e),
        }
    }
}

impl From<std::io::Error> for ExportError {
    fn from(err: std::io::Error) -> Self {
        ExportError::Io(err)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_book() -> Book {
        Book {
            content_id: "book1".to_string(),
            title: "Test Book".to_string(),
            author: "Test Author".to_string(),
            isbn: Some("978-1234567890".to_string()),
            publisher: Some("Test Publisher".to_string()),
            language: Some("en".to_string()),
            date_last_read: Some("2025-01-24".to_string()),
            description: Some("A test book description".to_string()),
            file_path: None,
            cover_path: None,
            highlights: vec![
                Highlight {
                    id: "hl1".to_string(),
                    text: "First highlight".to_string(),
                    annotation: None,
                    chapter_title: Some("Chapter 1".to_string()),
                    chapter_progress: Some(0.25),
                    container_path: None,
                    date_created: "2025-01-24".to_string(),
                    color: Some("yellow".to_string()),
                },
                Highlight {
                    id: "hl2".to_string(),
                    text: "Second highlight".to_string(),
                    annotation: None,
                    chapter_title: Some("Chapter 1".to_string()),
                    chapter_progress: Some(0.50),
                    container_path: None,
                    date_created: "2025-01-25".to_string(),
                    color: None,
                },
            ],
        }
    }

    fn create_test_book_2() -> Book {
        Book {
            content_id: "book2".to_string(),
            title: "Another Book".to_string(),
            author: "Another Author".to_string(),
            isbn: None,
            publisher: None,
            language: None,
            date_last_read: None,
            description: None,
            file_path: None,
            cover_path: None,
            highlights: vec![Highlight {
                id: "hl3".to_string(),
                text: "Another highlight".to_string(),
                annotation: None,
                chapter_title: None,
                chapter_progress: None,
                container_path: None,
                date_created: "2025-01-26".to_string(),
                color: None,
            }],
        }
    }

    fn create_test_config() -> ExportConfig {
        ExportConfig {
            export_path: "/tmp/export".to_string(),
            metadata: crate::models::MetadataConfig {
                author: true,
                isbn: true,
                publisher: true,
                date_last_read: true,
                language: true,
                description: true,
            },
            date_format: DateFormat::DdMonthYyyy,
        }
    }

    #[test]
    fn test_export_single_book() {
        let temp = TempDir::new().unwrap();
        let book = create_test_book();
        let config = create_test_config();

        let exporter = MarkdownExporter::new(temp.path().to_path_buf());
        let result = exporter.export_book(&book, &config);

        assert!(result.is_ok());

        let file_path = result.unwrap();
        assert!(file_path.exists());

        let content = fs::read_to_string(file_path).unwrap();
        assert!(content.contains("# Test Book"));
        assert!(content.contains("Test Author"));
        assert!(content.contains("> First highlight"));
    }

    #[test]
    fn test_filename_sanitization() {
        let book = Book {
            content_id: "id1".to_string(),
            title: "Book: With / Invalid? Characters".to_string(),
            author: "Author".to_string(),
            isbn: None,
            publisher: None,
            language: None,
            date_last_read: None,
            description: None,
            file_path: None,
            cover_path: None,
            highlights: vec![],
        };

        let filename = generate_filename(&book);
        assert!(!filename.contains(':'));
        assert!(!filename.contains('/'));
        assert!(!filename.contains('?'));
        assert!(filename.ends_with(".md"));
    }

    #[test]
    fn test_export_multiple_books() {
        let temp = TempDir::new().unwrap();
        let books = vec![create_test_book(), create_test_book_2()];
        let config = create_test_config();

        let exporter = MarkdownExporter::new(temp.path().to_path_buf());
        let results = exporter.export_books(&books, &config);

        assert_eq!(results.len(), 2);
        assert!(results.iter().all(|r| r.is_ok()));

        // Verify files exist
        let files: Vec<_> = fs::read_dir(temp.path()).unwrap().collect();
        assert_eq!(files.len(), 2);
    }

    #[test]
    fn test_export_dir_created() {
        let temp = TempDir::new().unwrap();
        let export_dir = temp.path().join("new_export_dir");

        assert!(!export_dir.exists());

        let _exporter = MarkdownExporter::new(export_dir.clone());

        assert!(export_dir.exists());
    }

    #[test]
    fn test_sanitize_filename_empty() {
        let result = sanitize_filename("");
        assert_eq!(result, "Untitled");
    }

    #[test]
    fn test_sanitize_filename_whitespace() {
        let result = sanitize_filename("  Book Title  ");
        assert_eq!(result, "Book Title");
    }

    #[test]
    fn test_generate_filename_format() {
        let book = Book {
            content_id: "id1".to_string(),
            title: "My Book".to_string(),
            author: "John Doe".to_string(),
            isbn: None,
            publisher: None,
            language: None,
            date_last_read: None,
            description: None,
            file_path: None,
            cover_path: None,
            highlights: vec![],
        };

        let filename = generate_filename(&book);
        assert_eq!(filename, "My Book - John Doe.md");
    }
    fn book_with_annotation(annotation: Option<&str>) -> Book {
        let mut book = create_test_book_2();
        book.highlights[0].annotation = annotation.map(str::to_string);
        book
    }

    fn markdown_for(book: &Book) -> String {
        let temp = TempDir::new().unwrap();
        let exporter = MarkdownExporter::new(temp.path().to_path_buf());
        exporter.generate_markdown(book, &create_test_config())
    }

    #[test]
    fn test_markdown_writes_note_under_quote() {
        let md = markdown_for(&book_with_annotation(Some("My own thought")));
        assert!(
            md.contains("> Another highlight\n\n**Nota:** My own thought"),
            "note must follow its quote:\n{md}"
        );
    }

    #[test]
    fn test_markdown_note_keeps_line_breaks() {
        let md = markdown_for(&book_with_annotation(Some("  line one\nline two  ")));
        assert!(
            md.contains("**Nota:** line one  \nline two"),
            "multi-line note stays one paragraph with hard breaks:\n{md}"
        );
    }

    #[test]
    fn test_markdown_without_note_has_no_note_line() {
        let md = markdown_for(&book_with_annotation(None));
        assert!(md.contains("> Another highlight"));
        assert!(!md.contains("Nota:"), "{md}");
    }

    #[test]
    fn test_markdown_empty_string_note_is_no_note() {
        for empty in ["", "   ", "\n\t "] {
            let md = markdown_for(&book_with_annotation(Some(empty)));
            assert!(!md.contains("Nota:"), "{empty:?} must not write a note:\n{md}");
        }
    }

    fn full_markdown(language: Language) -> String {
        let mut book = create_test_book();
        book.highlights[0].annotation = Some("A thought\nsecond line".to_string());
        let temp = TempDir::new().unwrap();
        MarkdownExporter::new(temp.path().to_path_buf())
            .with_language(language)
            .generate_markdown(&book, &create_test_config())
    }

    #[test]
    fn portuguese_markdown_keeps_its_bytes_but_publisher() {
        // What v1 and v2 wrote before the language setting, with «Publisher»
        // now in Portuguese like the other labels
        let expected = "# Test Book\n\n**Autor**: Test Author\n**ISBN**: 978-1234567890\n**Editora**: Test Publisher\n**Data de leitura**: 24 de janeiro de 2025\n**Idioma**: en\n\nA test book description\n\n---\n\n> First highlight\n\n**Nota:** A thought  \nsecond line\n\nChapter 1 · 25%\n\n> Second highlight\n\nChapter 1 · 50%\n";
        assert_eq!(full_markdown(Language::Pt), expected);
    }

    #[test]
    fn english_markdown_has_english_labels_and_months() {
        let expected = "# Test Book\n\n**Author**: Test Author\n**ISBN**: 978-1234567890\n**Publisher**: Test Publisher\n**Last read**: 24 January 2025\n**Language**: en\n\nA test book description\n\n---\n\n> First highlight\n\n**Note:** A thought  \nsecond line\n\nChapter 1 · 25%\n\n> Second highlight\n\nChapter 1 · 50%\n";
        assert_eq!(full_markdown(Language::En), expected);
    }

    #[test]
    fn format_date_pt_long_has_de_lowercase_month_and_no_leading_zero() {
        assert_eq!(
            format_date("2025-01-24", &DateFormat::DdMonthYyyy, Language::Pt),
            "24 de janeiro de 2025"
        );
        assert_eq!(
            format_date("2025-01-01", &DateFormat::DdMonthYyyy, Language::Pt),
            "1 de janeiro de 2025"
        );
    }

    #[test]
    fn format_date_en_long_keeps_zero_padded_day() {
        assert_eq!(
            format_date("2025-01-24", &DateFormat::DdMonthYyyy, Language::En),
            "24 January 2025"
        );
        assert_eq!(
            format_date("2025-01-01", &DateFormat::DdMonthYyyy, Language::En),
            "01 January 2025"
        );
    }

    #[test]
    fn spanish_markdown_has_spanish_labels_and_months() {
        let expected = "# Test Book\n\n**Autor**: Test Author\n**ISBN**: 978-1234567890\n**Editorial**: Test Publisher\n**Fecha de lectura**: 24 de enero de 2025\n**Idioma**: en\n\nA test book description\n\n---\n\n> First highlight\n\n**Nota:** A thought  \nsecond line\n\nChapter 1 · 25%\n\n> Second highlight\n\nChapter 1 · 50%\n";
        assert_eq!(full_markdown(Language::Es), expected);
    }

    #[test]
    fn french_markdown_has_french_labels_and_months() {
        let expected = "# Test Book\n\n**Auteur**: Test Author\n**ISBN**: 978-1234567890\n**Éditeur**: Test Publisher\n**Date de lecture**: 24 janvier 2025\n**Langue**: en\n\nA test book description\n\n---\n\n> First highlight\n\n**Note:** A thought  \nsecond line\n\nChapter 1 · 25%\n\n> Second highlight\n\nChapter 1 · 50%\n";
        assert_eq!(full_markdown(Language::Fr), expected);
    }

    #[test]
    fn format_date_es_long_has_de_and_lowercase_month() {
        assert_eq!(format_date("2025-01-24", &DateFormat::DdMonthYyyy, Language::Es), "24 de enero de 2025");
        assert_eq!(format_date("2025-03-01", &DateFormat::DdMonthYyyy, Language::Es), "1 de marzo de 2025");
    }

    #[test]
    fn format_date_fr_long_has_lowercase_month_and_premier() {
        assert_eq!(format_date("2025-02-24", &DateFormat::DdMonthYyyy, Language::Fr), "24 février 2025");
        // The first of the month is «1er» in French
        assert_eq!(format_date("2025-08-01", &DateFormat::DdMonthYyyy, Language::Fr), "1er août 2025");
    }

    #[test]
    fn format_date_other_formats_unchanged() {
        for language in [Language::Pt, Language::En, Language::Es, Language::Fr] {
            assert_eq!(
                format_date("2025-01-01", &DateFormat::DdMmYyyy, language),
                "01/01/2025"
            );
            assert_eq!(
                format_date("2025-01-01", &DateFormat::Iso8601, language),
                "2025-01-01"
            );
        }
    }
}
