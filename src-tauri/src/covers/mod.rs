use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Seek, Write};
use std::path::{Path, PathBuf};
use zip::ZipArchive;

pub struct CoverExtractor {
    cache_dir: PathBuf,
}

impl CoverExtractor {
    pub fn new(cache_dir: PathBuf) -> Self {
        // Ensure cache directory exists
        if !cache_dir.exists() {
            fs::create_dir_all(&cache_dir).expect("Failed to create cache directory");
        }
        Self { cache_dir }
    }

    /// Extract cover from EPUB file
    pub fn extract_cover(&self, epub_path: &Path) -> Result<Option<PathBuf>, CoverError> {
        // Check cache first
        let cache_key = self.compute_cache_key(epub_path)?;
        let cached_path = self.cache_dir.join(format!("{}.jpg", cache_key));

        if cached_path.exists() {
            return Ok(Some(cached_path));
        }

        // Open EPUB as ZIP
        let file = fs::File::open(epub_path)?;
        let mut archive = ZipArchive::new(file)?;

        // Try to find cover image
        let cover_path = self.find_cover_path(&mut archive)?;

        match cover_path {
            Some(path_in_epub) => {
                // Extract cover image
                let mut cover_file = archive.by_name(&path_in_epub)?;
                let mut cover_data = Vec::new();
                cover_file.read_to_end(&mut cover_data)?;

                // Save to cache
                let mut output = fs::File::create(&cached_path)?;
                output.write_all(&cover_data)?;

                Ok(Some(cached_path))
            }
            None => {
                // Generate placeholder
                let placeholder_path = self.generate_placeholder(&cache_key)?;
                Ok(Some(placeholder_path))
            }
        }
    }

    /// Compute cache key from file path and modification time
    fn compute_cache_key(&self, epub_path: &Path) -> Result<String, CoverError> {
        let metadata = fs::metadata(epub_path)?;
        let modified = metadata.modified()?;
        let modified_secs = modified
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let path_str = epub_path.to_string_lossy();
        let input = format!("{}:{}", path_str, modified_secs);

        let mut hasher = Sha256::new();
        hasher.update(input.as_bytes());
        let result = hasher.finalize();

        Ok(format!("{:x}", result)[..16].to_string())
    }

    /// Find cover image path in EPUB
    /// Find cover image path in EPUB by parsing manifest
    fn find_cover_path<R: Read + Seek>(
        &self,
        archive: &mut ZipArchive<R>,
    ) -> Result<Option<String>, CoverError> {
        // 1. Find the OPF file path from container.xml
        let opf_path = self.get_opf_path(archive)?;
        
        if let Some(path) = opf_path {
            // 2. Parse OPF to find cover image
            if let Ok(cover_href) = self.parse_opf_for_cover(archive, &path) {
                return Ok(Some(cover_href));
            }
        }

        // Fallback to filename-based search if OPF parsing fails
        self.fallback_find_cover_path(archive)
    }

    fn get_opf_path<R: Read + Seek>(&self, archive: &mut ZipArchive<R>) -> Result<Option<String>, CoverError> {
        let mut container = match archive.by_name("META-INF/container.xml") {
            Ok(file) => file,
            Err(_) => return Ok(None),
        };
        
        let mut content = String::new();
        container.read_to_string(&mut content)?;
        
        // Simple regex-less extraction of full-path
        if let Some(start) = content.find("full-path=\"") {
            let sub = &content[start + 11..];
            if let Some(end) = sub.find('\"') {
                return Ok(Some(sub[..end].to_string()));
            }
        }
        
        Ok(None)
    }

    fn parse_opf_for_cover<R: Read + Seek>(&self, archive: &mut ZipArchive<R>, opf_path: &str) -> Result<String, CoverError> {
        let mut opf_file = archive.by_name(opf_path)?;
        let mut content = String::new();
        opf_file.read_to_string(&mut content)?;

        let opf_dir = Path::new(opf_path).parent().unwrap_or_else(|| Path::new(""));
        
        // Try EPUB 3 style (properties="cover-image")
        if let Some(pos) = content.find("properties=\"cover-image\"") {
            // Look backwards for href
            let pre_content = &content[..pos];
            if let Some(href_start) = pre_content.rfind("href=\"") {
                let sub = &pre_content[href_start + 6..];
                if let Some(href_end) = sub.find('\"') {
                    let href = &sub[..href_end];
                    return Ok(opf_dir.join(href).to_string_lossy().to_string());
                }
            }
        }

        // Try EPUB 2 style (<meta name="cover" content="item_id"/>)
        if let Some(pos) = content.find("name=\"cover\"") {
            let sub = &content[pos..];
            if let Some(content_start) = sub.find("content=\"") {
                let sub_id = &sub[content_start + 9..];
                if let Some(content_end) = sub_id.find('\"') {
                    let cover_id = &sub_id[..content_end];
                    
                    // Now find the item with this ID in the manifest
                    let item_pattern = format!("id=\"{}\"", cover_id);
                    if let Some(item_pos) = content.find(&item_pattern) {
                        let item_sub = &content[item_pos..];
                        if let Some(href_start) = item_sub.find("href=\"") {
                            let href_sub = &item_sub[href_start + 6..];
                            if let Some(href_end) = href_sub.find('\"') {
                                let href = &href_sub[..href_end];
                                return Ok(opf_dir.join(href).to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }
        }

        Err(CoverError::NoCoverFound)
    }

    fn fallback_find_cover_path<R: Read + Seek>(
        &self,
        archive: &mut ZipArchive<R>,
    ) -> Result<Option<String>, CoverError> {
        // Common explicit paths
        let common_paths = [
            "OEBPS/cover.jpg",
            "OEBPS/cover.jpeg",
            "OEBPS/cover.png",
            "OEBPS/Images/cover.jpg",
            "OEBPS/images/cover.jpg",
            "OPS/cover.jpg",
            "OPS/cover.jpeg",
            "OPS/images/cover.jpg",
            "cover.jpg",
            "cover.jpeg",
            "cover.png",
        ];

        for path in &common_paths {
            if archive.by_name(path).is_ok() {
                return Ok(Some(path.to_string()));
            }
        }

        // Search for any image file that has "cover" in its name
        let mut best_match: Option<(String, usize)> = None;

        for i in 0..archive.len() {
            let file = archive.by_index(i)?;
            let name = file.name();
            let name_lower = name.to_lowercase();
            
            if name_lower.ends_with(".jpg") || name_lower.ends_with(".jpeg") || name_lower.ends_with(".png") {
                if name_lower.contains("cover") {
                    let depth = name.split('/').count();
                    match best_match {
                        None => best_match = Some((name.to_string(), depth)),
                        Some((_, d)) if depth < d => best_match = Some((name.to_string(), depth)),
                        _ => {}
                    }
                }
            }
        }

        Ok(best_match.map(|(path, _)| path))
    }

    /// Generate a placeholder SVG when no cover is found
    fn generate_placeholder(&self, cache_key: &str) -> Result<PathBuf, CoverError> {
        let placeholder_path = self
            .cache_dir
            .join(format!("{}_placeholder.svg", cache_key));

        let svg = r##"<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300">
            <rect width="200" height="300" fill="#f0f0f0"/>
            <rect x="20" y="40" width="160" height="200" fill="#e0e0e0" stroke="#ccc" stroke-width="2"/>
            <text x="100" y="150" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#999">
                Sem Capa
            </text>
        </svg>"##;

        let mut file = fs::File::create(&placeholder_path)?;
        file.write_all(svg.as_bytes())?;

        Ok(placeholder_path)
    }

    /// Clear the cache directory
    pub fn clear_cache(&self) -> Result<(), CoverError> {
        if self.cache_dir.exists() {
            for entry in fs::read_dir(&self.cache_dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_file() {
                    fs::remove_file(path)?;
                }
            }
        }
        Ok(())
    }

    /// Get cache directory path
    pub fn cache_dir(&self) -> &Path {
        &self.cache_dir
    }
}

#[derive(Debug)]
pub enum CoverError {
    Io(std::io::Error),
    Zip(zip::result::ZipError),
    NoCoverFound,
}

impl std::fmt::Display for CoverError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CoverError::Io(e) => write!(f, "IO error: {}", e),
            CoverError::Zip(e) => write!(f, "ZIP error: {}", e),
            CoverError::NoCoverFound => write!(f, "No cover found in EPUB"),
        }
    }
}

impl std::error::Error for CoverError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            CoverError::Io(e) => Some(e),
            CoverError::Zip(e) => Some(e),
            CoverError::NoCoverFound => None,
        }
    }
}

impl From<std::io::Error> for CoverError {
    fn from(err: std::io::Error) -> Self {
        CoverError::Io(err)
    }
}

impl From<zip::result::ZipError> for CoverError {
    fn from(err: zip::result::ZipError) -> Self {
        CoverError::Zip(err)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    fn create_mock_epub_with_cover(temp_dir: &Path) -> PathBuf {
        let epub_path = temp_dir.join("test_with_cover.epub");

        // Create a minimal EPUB with a cover
        let file = fs::File::create(&epub_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);

        let options =
            zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Stored);

        // Add mimetype
        zip.start_file("mimetype", options).unwrap();
        zip.write_all(b"application/epub+zip").unwrap();

        // Add a fake cover image (just JPEG header bytes)
        zip.start_file("OEBPS/cover.jpg", options).unwrap();
        // Minimal JPEG header
        zip.write_all(&[0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46])
            .unwrap();

        zip.finish().unwrap();

        epub_path
    }

    fn create_mock_epub_without_cover(temp_dir: &Path) -> PathBuf {
        let epub_path = temp_dir.join("test_without_cover.epub");

        let file = fs::File::create(&epub_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);

        let options =
            zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Stored);

        // Add mimetype only
        zip.start_file("mimetype", options).unwrap();
        zip.write_all(b"application/epub+zip").unwrap();

        zip.finish().unwrap();

        epub_path
    }

    fn create_mock_epub_with_nested_cover(temp_dir: &Path) -> PathBuf {
        let epub_path = temp_dir.join("test_nested.epub");
        let file = fs::File::create(&epub_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Stored);

        // Add a nested "cover" (e.g. in a chapter)
        zip.start_file("OEBPS/ch1/images/cover.jpg", options).unwrap();
        zip.write_all(&[0x00]).unwrap();

        // Add the main "cover" (higher up)
        zip.start_file("OEBPS/cover.jpg", options).unwrap();
        zip.write_all(&[0xFF, 0xD8]).unwrap();

        zip.finish().unwrap();
        epub_path
    }

    #[test]
    fn test_extract_nested_cover_preference() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.path().join("cache");
        let epub_path = create_mock_epub_with_nested_cover(temp.path());

        let extractor = CoverExtractor::new(cache_dir);
        let cover = extractor.extract_cover(&epub_path).unwrap();

        assert!(cover.is_some());
        // Should find the one at OEBPS/cover.jpg
        let data = fs::read(cover.unwrap()).unwrap();
        assert_eq!(data[0], 0xFF);
    }

    #[test]
    fn test_extract_cover_from_epub() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.path().join("cache");
        let epub_path = create_mock_epub_with_cover(temp.path());

        let extractor = CoverExtractor::new(cache_dir.clone());
        let cover = extractor.extract_cover(&epub_path).unwrap();

        assert!(cover.is_some());
        let cover_path = cover.unwrap();
        assert!(cover_path.exists());
        assert!(cover_path.to_string_lossy().ends_with(".jpg"));
    }

    #[test]
    fn test_generate_placeholder_when_no_cover() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.path().join("cache");
        let epub_path = create_mock_epub_without_cover(temp.path());

        let extractor = CoverExtractor::new(cache_dir);
        let cover = extractor.extract_cover(&epub_path).unwrap();

        assert!(cover.is_some());
        let cover_path = cover.unwrap();
        assert!(cover_path.exists());
        assert!(cover_path.to_string_lossy().ends_with("_placeholder.svg"));

        // Verify it's a valid SVG
        let content = fs::read_to_string(&cover_path).unwrap();
        assert!(content.contains("<svg"));
        assert!(content.contains("Sem Capa"));
    }

    #[test]
    fn test_cover_cache() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.path().join("cache");
        let epub_path = create_mock_epub_with_cover(temp.path());

        let extractor = CoverExtractor::new(cache_dir);

        // First extraction
        let cover1 = extractor.extract_cover(&epub_path).unwrap();
        let cover1_path = cover1.unwrap().clone();
        let metadata1 = fs::metadata(&cover1_path).unwrap();
        let modified1 = metadata1.modified().unwrap();

        // Second extraction (should use cache)
        let cover2 = extractor.extract_cover(&epub_path).unwrap();
        let cover2_path = cover2.unwrap();
        let metadata2 = fs::metadata(&cover2_path).unwrap();
        let modified2 = metadata2.modified().unwrap();

        // Same file should be returned
        assert_eq!(cover1_path, cover2_path);
        assert_eq!(modified1, modified2);
    }

    #[test]
    fn test_clear_cache() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.path().join("cache");
        let epub_path = create_mock_epub_with_cover(temp.path());

        let extractor = CoverExtractor::new(cache_dir.clone());

        // Extract cover to populate cache
        let cover = extractor.extract_cover(&epub_path).unwrap();
        assert!(cover.is_some());

        // Verify cache has files
        let cache_files: Vec<_> = fs::read_dir(&cache_dir).unwrap().collect();
        assert!(!cache_files.is_empty());

        // Clear cache
        extractor.clear_cache().unwrap();

        // Verify cache is empty
        let cache_files: Vec<_> = fs::read_dir(&cache_dir).unwrap().collect();
        assert!(cache_files.is_empty());
    }

    #[test]
    fn test_cache_dir_created() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.path().join("new_cache_dir");

        assert!(!cache_dir.exists());

        let _extractor = CoverExtractor::new(cache_dir.clone());

        assert!(cache_dir.exists());
    }
}
