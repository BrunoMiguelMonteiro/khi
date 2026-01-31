use std::fs;
use std::path::{Path, PathBuf};
use crate::models::KoboDevice;

pub struct DeviceDetector {
    volumes_path: PathBuf,
}

impl DeviceDetector {
    pub fn new(volumes_path: PathBuf) -> Self {
        Self { volumes_path }
    }

    /// Scan for connected Kobo devices
    pub fn scan_for_kobo(&self) -> Result<Option<KoboDevice>, DeviceError> {
        // Check if volumes directory exists
        if !self.volumes_path.exists() {
            return Ok(None);
        }

        // Iterate through mounted volumes
        for entry in fs::read_dir(&self.volumes_path)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_dir() {
                // Check if this is a Kobo device
                if let Some(device) = self.check_kobo_device(&path)? {
                    return Ok(Some(device));
                }
            }
        }

        Ok(None)
    }

    /// Check if a volume is a Kobo device
    fn check_kobo_device(&self, volume_path: &Path) -> Result<Option<KoboDevice>, DeviceError> {
        let name = volume_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();

        // Check for .kobo directory
        let kobo_dir = volume_path.join(".kobo");
        if !kobo_dir.exists() || !kobo_dir.is_dir() {
            return Ok(None);
        }

        // Check for KoboReader.sqlite
        let sqlite_path = kobo_dir.join("KoboReader.sqlite");
        let has_sqlite = sqlite_path.exists() && sqlite_path.is_file();

        // Try to validate SQLite accessibility
        let is_valid = if has_sqlite {
            self.validate_sqlite(&sqlite_path)
        } else {
            false
        };

        // Try to get serial number from version file
        let serial_number = self.read_serial_number(&kobo_dir);

        Ok(Some(KoboDevice {
            name,
            path: volume_path.to_string_lossy().to_string(),
            is_valid,
            serial_number,
        }))
    }

    /// Validate that the SQLite database is accessible
    fn validate_sqlite(&self, sqlite_path: &Path) -> bool {
        match rusqlite::Connection::open(sqlite_path) {
            Ok(conn) => {
                // Try a simple query to verify the database is valid
                // Use query_row instead of execute for SELECT statements
                conn.query_row("SELECT 1", [], |_| Ok(())).is_ok()
            }
            Err(_) => false,
        }
    }

    /// Read serial number from .kobo/version
    fn read_serial_number(&self, kobo_dir: &Path) -> Option<String> {
        let version_path = kobo_dir.join("version");
        if version_path.exists() {
            if let Ok(content) = fs::read_to_string(&version_path) {
                // The version file typically contains the serial number
                let trimmed = content.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
        None
    }

    /// Get the path to the Kobo SQLite database
    pub fn get_database_path(&self, device: &KoboDevice) -> Option<PathBuf> {
        let path = Path::new(&device.path);
        let sqlite_path = path.join(".kobo").join("KoboReader.sqlite");
        if sqlite_path.exists() {
            Some(sqlite_path)
        } else {
            None
        }
    }
}

#[derive(Debug)]
pub enum DeviceError {
    Io(std::io::Error),
    Database(rusqlite::Error),
}

impl std::fmt::Display for DeviceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DeviceError::Io(e) => write!(f, "IO error: {}", e),
            DeviceError::Database(e) => write!(f, "Database error: {}", e),
        }
    }
}

impl std::error::Error for DeviceError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            DeviceError::Io(e) => Some(e),
            DeviceError::Database(e) => Some(e),
        }
    }
}

impl From<std::io::Error> for DeviceError {
    fn from(err: std::io::Error) -> Self {
        DeviceError::Io(err)
    }
}

impl From<rusqlite::Error> for DeviceError {
    fn from(err: rusqlite::Error) -> Self {
        DeviceError::Database(err)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use rusqlite::Connection;

    fn create_mock_kobo_device(temp_dir: &Path, name: &str) -> PathBuf {
        let device_path = temp_dir.join(name);
        let kobo_dir = device_path.join(".kobo");
        fs::create_dir_all(&kobo_dir).unwrap();
        
        // Create a valid SQLite database
        let sqlite_path = kobo_dir.join("KoboReader.sqlite");
        let conn = Connection::open(&sqlite_path).unwrap();
        // Create a proper table that allows querying
        conn.execute("CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY)", []).unwrap();
        conn.execute("INSERT INTO test (id) VALUES (1)", []).unwrap();
        drop(conn);
        
        // Create version file with serial number
        fs::write(kobo_dir.join("version"), "SN12345678").unwrap();
        
        device_path
    }

    fn create_non_kobo_device(temp_dir: &Path, name: &str) -> PathBuf {
        let device_path = temp_dir.join(name);
        fs::create_dir_all(&device_path).unwrap();
        device_path
    }

    #[test]
    fn test_detect_kobo_by_sqlite_file() {
        let temp = TempDir::new().unwrap();
        create_mock_kobo_device(temp.path(), "KOBOeReader");
        
        let detector = DeviceDetector::new(temp.path().to_path_buf());
        let device = detector.scan_for_kobo().unwrap();
        
        assert!(device.is_some());
        let device = device.unwrap();
        assert_eq!(device.name, "KOBOeReader");
        assert!(device.is_valid);
    }

    #[test]
    fn test_ignore_non_kobo_volumes() {
        let temp = TempDir::new().unwrap();
        create_non_kobo_device(temp.path(), "MyUSB");
        
        let detector = DeviceDetector::new(temp.path().to_path_buf());
        let device = detector.scan_for_kobo().unwrap();
        
        assert!(device.is_none());
    }

    #[test]
    fn test_validate_sqlite_accessibility() {
        let temp = TempDir::new().unwrap();
        let device_path = temp.path().join("KOBOeReader");
        let kobo_dir = device_path.join(".kobo");
        fs::create_dir_all(&kobo_dir).unwrap();
        
        // Create a valid SQLite database
        let sqlite_path = kobo_dir.join("KoboReader.sqlite");
        let conn = Connection::open(&sqlite_path).unwrap();
        conn.execute("CREATE TABLE test (id INTEGER)", []).unwrap();
        drop(conn);
        
        let detector = DeviceDetector::new(temp.path().to_path_buf());
        let device = detector.scan_for_kobo().unwrap();
        
        assert!(device.is_some());
        assert!(device.unwrap().is_valid);
    }

    #[test]
    fn test_device_without_sqlite() {
        let temp = TempDir::new().unwrap();
        let device_path = temp.path().join("KOBOeReader");
        let kobo_dir = device_path.join(".kobo");
        fs::create_dir_all(&kobo_dir).unwrap();
        
        // Create .kobo directory but NO SQLite file
        // This simulates a device that has .kobo folder but no database
        
        let detector = DeviceDetector::new(temp.path().to_path_buf());
        let device = detector.scan_for_kobo().unwrap();
        
        assert!(device.is_some());
        // The device should be detected but marked as invalid because there's no SQLite
        let device = device.unwrap();
        assert!(!device.is_valid, "Device without SQLite file should be marked as invalid");
    }

    #[test]
    fn test_read_serial_number() {
        let temp = TempDir::new().unwrap();
        create_mock_kobo_device(temp.path(), "KOBOeReader");
        
        let detector = DeviceDetector::new(temp.path().to_path_buf());
        let device = detector.scan_for_kobo().unwrap();
        
        assert!(device.is_some());
        assert_eq!(device.unwrap().serial_number, Some("SN12345678".to_string()));
    }

    #[test]
    fn test_get_database_path() {
        let temp = TempDir::new().unwrap();
        create_mock_kobo_device(temp.path(), "KOBOeReader");
        
        let detector = DeviceDetector::new(temp.path().to_path_buf());
        let device = detector.scan_for_kobo().unwrap().unwrap();
        
        let db_path = detector.get_database_path(&device);
        assert!(db_path.is_some());
        assert!(db_path.unwrap().exists());
    }

    #[test]
    fn test_multiple_volumes() {
        let temp = TempDir::new().unwrap();
        create_non_kobo_device(temp.path(), "MyUSB");
        create_mock_kobo_device(temp.path(), "KOBOeReader");
        create_non_kobo_device(temp.path(), "AnotherDrive");
        
        let detector = DeviceDetector::new(temp.path().to_path_buf());
        let device = detector.scan_for_kobo().unwrap();
        
        assert!(device.is_some());
        assert_eq!(device.unwrap().name, "KOBOeReader");
    }
}
