use chrono::Local;
use log::{Level, Metadata, Record};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::sync::Mutex;

static LOGGER: SimpleLogger = SimpleLogger {
    file: Mutex::new(None),
};

struct SimpleLogger {
    file: Mutex<Option<File>>,
}

impl log::Log for SimpleLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= Level::Info
    }

    fn log(&self, record: &Record) {
        if self.enabled(record.metadata()) {
            let now = Local::now();
            let msg = format!(
                "{} [{}] - {}
",
                now.format("%Y-%m-%d %H:%M:%S"),
                record.level(),
                record.args()
            );

            // Print to stdout anyway (for dev)
            print!("{}", msg);

            // Write to file if available
            if let Ok(mut lock) = self.file.lock() {
                if let Some(ref mut file) = *lock {
                    let _ = file.write_all(msg.as_bytes());
                }
            }
        }
    }

    fn flush(&self) {}
}

pub fn init() -> Result<(), String> {
    let log_dir = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join("Library/Logs/com.bruno.kobo-highlights-exporter");

    fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;

    let log_path = log_dir.join("app.log");

    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .map_err(|e| e.to_string())?;

    if let Ok(mut lock) = LOGGER.file.lock() {
        *lock = Some(file);
    }

    log::set_logger(&LOGGER)
        .map(|()| log::set_max_level(log::LevelFilter::Info))
        .map_err(|e| e.to_string())?;

    log::info!("Logger initialized");
    Ok(())
}
