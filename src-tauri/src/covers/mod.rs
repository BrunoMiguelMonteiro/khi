use std::fs;
use std::io::{Read, Seek, Write};
use std::path::{Path, PathBuf};
use sha2::{Sha256, Digest};
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
    fn find_cover_path<R: Read + Seek>(&self, archive: &mut ZipArchive<R>) -> Result<Option<String>, CoverError> {
        // Common cover image paths
        let common_paths = [
            "OEBPS/cover.jpg",
            "OEBPS/cover.jpeg",
            "OEBPS/cover.png",
            "OPS/cover.jpg",
            "OPS/cover.jpeg",
            "OPS/cover.png",
            "cover.jpg",
            "cover.jpeg",
            "cover.png",
        ];

        // Try common paths first
        for path in &common_paths {
            if archive.by_name(path).is_ok() {
                return Ok(Some(path.to_string()));
            }
        }

        // Search for any image with "cover" in the name
        for i in 0..archive.len() {
            let file = archive.by_index(i)?;
            let name = file.name().to_lowercase();
            if name.contains("cover") && (name.ends_with(".jpg") || name.ends_with(".jpeg") || name.ends_with(".png")) {
                return Ok(Some(file.name().to_string()));
            }
        }

        Ok(None)
    }

    /// Generate a placeholder SVG when no cover is found
    fn generate_placeholder(&self, cache_key: &str) -> Result<PathBuf, CoverError> {
        let placeholder_path = self.cache_dir.join(format!("{}_placeholder.svg", cache_key));
        
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
    use tempfile::TempDir;
    use std::io::Write;

    fn create_mock_epub_with_cover(temp_dir: &Path) -> PathBuf {
        let epub_path = temp_dir.join("test_with_cover.epub");
        
        // Create a minimal EPUB with a cover
        let file = fs::File::create(&epub_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        
        let options = zip::write::FileOptions::default()
            .compression_method(zip::CompressionMethod::Stored);
        
        // Add mimetype
        zip.start_file("mimetype", options).unwrap();
        zip.write_all(b"application/epub+zip").unwrap();
        
        // Add a fake cover image (just JPEG header bytes)
        zip.start_file("OEBPS/cover.jpg", options).unwrap();
        // Minimal JPEG header
        zip.write_all(&[0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]).unwrap();
        
        zip.finish().unwrap();
        
        epub_path
    }

    fn create_mock_epub_without_cover(temp_dir: &Path) -> PathBuf {
        let epub_path = temp_dir.join("test_without_cover.epub");
        
        let file = fs::File::create(&epub_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        
        let options = zip::write::FileOptions::default()
            .compression_method(zip::CompressionMethod::Stored);
        
        // Add mimetype only
        zip.start_file("mimetype", options).unwrap();
        zip.write_all(b"application/epub+zip").unwrap();
        
        zip.finish().unwrap();
        
        epub_path
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
