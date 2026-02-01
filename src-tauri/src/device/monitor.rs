use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::device::DeviceDetector;
use crate::models::KoboDevice;

/// Event emitted when a device is detected
#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct DeviceDetectedEvent {
    pub device: KoboDevice,
}

/// Event emitted when a device is disconnected  
#[derive(Clone, serde::Serialize)]
pub struct DeviceDisconnectedEvent;

/// Monitors for Kobo device connections/disconnections
/// Emits events: "device-detected", "device-disconnected"
pub struct DeviceMonitor {
    app_handle: AppHandle,
}

impl DeviceMonitor {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    /// Start monitoring for device changes (polling every 2 seconds)
    /// Uses std::thread instead of tokio to avoid runtime dependency issues
    pub fn start_monitoring(self) {
        // Use Arc<Mutex<>> for thread-safe shared state
        let last_device = Arc::new(Mutex::new(None::<KoboDevice>));
        let app_handle = self.app_handle.clone();

        thread::spawn(move || {
            log::info!("[DeviceMonitor] Starting device monitoring thread (2s interval)");

            loop {
                // Sleep at the start of each iteration
                thread::sleep(Duration::from_secs(2));

                let volumes_path = PathBuf::from("/Volumes");
                let detector = DeviceDetector::new(volumes_path);

                match detector.scan_for_kobo() {
                    Ok(current_device) => {
                        let mut last = last_device.lock().unwrap();

                        match (&*last, &current_device) {
                            // Device connected (first detection)
                            (None, Some(device)) => {
                                log::info!(
                                    "[DeviceMonitor] Device connected: {} at {}",
                                    device.name,
                                    device.path
                                );
                                let event = DeviceDetectedEvent {
                                    device: device.clone(),
                                };
                                if let Err(e) = app_handle.emit("device-detected", event) {
                                    log::error!(
                                        "[DeviceMonitor] Failed to emit device-detected event: {}",
                                        e
                                    );
                                }
                                *last = Some(device.clone());
                            }
                            // Device disconnected
                            (Some(_), None) => {
                                log::info!("[DeviceMonitor] Device disconnected");
                                let event = DeviceDisconnectedEvent;
                                if let Err(e) = app_handle.emit("device-disconnected", event) {
                                    log::error!("[DeviceMonitor] Failed to emit device-disconnected event: {}", e);
                                }
                                *last = None;
                            }
                            // Same device still connected - no event needed
                            (Some(last_dev), Some(current_dev)) => {
                                if last_dev.path != current_dev.path
                                    || last_dev.serial_number != current_dev.serial_number
                                {
                                    // Different device connected
                                    log::info!(
                                        "[DeviceMonitor] Device changed: {} at {}",
                                        current_dev.name,
                                        current_dev.path
                                    );
                                    let event = DeviceDetectedEvent {
                                        device: current_dev.clone(),
                                    };
                                    if let Err(e) = app_handle.emit("device-detected", event) {
                                        log::error!("[DeviceMonitor] Failed to emit device-detected event: {}", e);
                                    }
                                    *last = Some(current_dev.clone());
                                }
                                // Same device, do nothing
                            }
                            // No device connected, no change
                            (None, None) => {}
                        }
                    }
                    Err(e) => {
                        log::error!("[DeviceMonitor] Error scanning for device: {}", e);
                    }
                }
            }
        });

        log::info!("[DeviceMonitor] Device monitoring thread started successfully");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use std::fs;
    use tempfile::TempDir;

    fn create_mock_kobo_device(temp_dir: &std::path::Path, name: &str) -> PathBuf {
        let device_path = temp_dir.join(name);
        let kobo_dir = device_path.join(".kobo");
        fs::create_dir_all(&kobo_dir).unwrap();

        // Create a valid SQLite database
        let sqlite_path = kobo_dir.join("KoboReader.sqlite");
        let conn = Connection::open(&sqlite_path).unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY)",
            [],
        )
        .unwrap();
        conn.execute("INSERT INTO test (id) VALUES (1)", [])
            .unwrap();
        drop(conn);

        // Create version file with serial number
        fs::write(kobo_dir.join("version"), "SN12345678").unwrap();

        device_path
    }

    #[test]
    fn test_device_detected_event_structure() {
        // Verify event structure is correct
        let device = KoboDevice {
            name: "KOBOeReader".to_string(),
            path: "/Volumes/KOBOeReader".to_string(),
            is_valid: true,
            serial_number: Some("SN12345678".to_string()),
        };

        let event = DeviceDetectedEvent { device };
        let json = serde_json::to_string(&event).unwrap();

        // Verify it can be deserialized
        let deserialized: DeviceDetectedEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.device.name, "KOBOeReader");
        assert_eq!(
            deserialized.device.serial_number,
            Some("SN12345678".to_string())
        );
    }

    #[test]
    fn test_device_disconnected_event_structure() {
        let event = DeviceDisconnectedEvent;
        let json = serde_json::to_string(&event).unwrap();

        // Should serialize to empty object or unit
        assert!(json == "{}" || json == "null" || json.is_empty());
    }

    #[test]
    fn test_device_detector_finds_mock_device() {
        let temp = TempDir::new().unwrap();
        create_mock_kobo_device(temp.path(), "KOBOeReader");

        let detector = DeviceDetector::new(temp.path().to_path_buf());
        let device = detector.scan_for_kobo().unwrap();

        assert!(device.is_some());
        let device = device.unwrap();
        assert_eq!(device.name, "KOBOeReader");
        assert!(device.is_valid);
        assert_eq!(device.serial_number, Some("SN12345678".to_string()));
    }

    #[test]
    fn test_device_detector_returns_none_when_no_device() {
        let temp = TempDir::new().unwrap();
        // Create a non-kobo directory
        fs::create_dir(temp.path().join("RegularUSB")).unwrap();

        let detector = DeviceDetector::new(temp.path().to_path_buf());
        let device = detector.scan_for_kobo().unwrap();

        assert!(device.is_none());
    }
}
