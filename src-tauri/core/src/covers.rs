use std::path::Path;

/// The SVG `extract_cover` makes when the EPUB has no cover.
pub fn is_placeholder(path: &Path) -> bool {
    path.file_name()
        .and_then(|n| n.to_str())
        .is_some_and(|n| n.ends_with("_placeholder.svg"))
}
