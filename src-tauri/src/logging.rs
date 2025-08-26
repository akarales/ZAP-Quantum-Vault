use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogLevel {
    Error,
    Warn,
    Info,
    Debug,
    Trace,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: DateTime<Utc>,
    pub level: LogLevel,
    pub module: String,
    pub message: String,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitcoinKeyEvent {
    pub event_type: String,
    pub key_id: Option<String>,
    pub vault_id: String,
    pub key_type: Option<String>,
    pub network: Option<String>,
    pub success: bool,
    pub error_message: Option<String>,
    pub duration_ms: Option<u64>,
}

pub struct Logger {
    log_file_path: String,
}

impl Logger {
    pub fn new(log_file_path: &str) -> Self {
        // Ensure log directory exists
        if let Some(parent) = Path::new(log_file_path).parent() {
            std::fs::create_dir_all(parent).ok();
        }
        
        Self {
            log_file_path: log_file_path.to_string(),
        }
    }

    pub fn log(&self, level: LogLevel, module: &str, message: &str, metadata: Option<serde_json::Value>) {
        let entry = LogEntry {
            timestamp: Utc::now(),
            level,
            module: module.to_string(),
            message: message.to_string(),
            metadata,
        };

        // Print to console
        match entry.level {
            LogLevel::Error => eprintln!("[ERROR] [{}] {}: {}", entry.timestamp, entry.module, entry.message),
            LogLevel::Warn => println!("[WARN] [{}] {}: {}", entry.timestamp, entry.module, entry.message),
            LogLevel::Info => println!("[INFO] [{}] {}: {}", entry.timestamp, entry.module, entry.message),
            LogLevel::Debug => println!("[DEBUG] [{}] {}: {}", entry.timestamp, entry.module, entry.message),
            LogLevel::Trace => println!("[TRACE] [{}] {}: {}", entry.timestamp, entry.module, entry.message),
        }

        // Write to file
        if let Ok(json_entry) = serde_json::to_string(&entry) {
            if let Ok(mut file) = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&self.log_file_path)
            {
                writeln!(file, "{}", json_entry).ok();
            }
        }
    }

    pub fn error(&self, module: &str, message: &str, metadata: Option<serde_json::Value>) {
        self.log(LogLevel::Error, module, message, metadata);
    }

    pub fn warn(&self, module: &str, message: &str, metadata: Option<serde_json::Value>) {
        self.log(LogLevel::Warn, module, message, metadata);
    }

    pub fn info(&self, module: &str, message: &str, metadata: Option<serde_json::Value>) {
        self.log(LogLevel::Info, module, message, metadata);
    }

    pub fn debug(&self, module: &str, message: &str, metadata: Option<serde_json::Value>) {
        self.log(LogLevel::Debug, module, message, metadata);
    }

    pub fn trace(&self, module: &str, message: &str, metadata: Option<serde_json::Value>) {
        self.log(LogLevel::Trace, module, message, metadata);
    }

    pub fn log_bitcoin_event(&self, event: BitcoinKeyEvent) {
        let metadata = serde_json::to_value(&event).ok();
        let level = if event.success { LogLevel::Info } else { LogLevel::Error };
        let message = format!("Bitcoin key event: {}", event.event_type);
        self.log(level, "bitcoin_keys", &message, metadata);
    }
}

// Global logger instance
use std::sync::OnceLock;
static LOGGER: OnceLock<Logger> = OnceLock::new();

pub fn init_logger() -> &'static Logger {
    LOGGER.get_or_init(|| {
        let log_path = if cfg!(debug_assertions) {
            "./logs/zap_vault_debug.log"
        } else {
            "./logs/zap_vault.log"
        };
        Logger::new(log_path)
    })
}

// Convenience macros
#[macro_export]
macro_rules! log_error {
    ($module:expr, $message:expr) => {
        crate::logging::init_logger().error($module, $message, None);
    };
    ($module:expr, $message:expr, $metadata:expr) => {
        crate::logging::init_logger().error($module, $message, Some($metadata));
    };
}

#[macro_export]
macro_rules! log_warn {
    ($module:expr, $message:expr) => {
        crate::logging::init_logger().warn($module, $message, None);
    };
    ($module:expr, $message:expr, $metadata:expr) => {
        crate::logging::init_logger().warn($module, $message, Some($metadata));
    };
}

#[macro_export]
macro_rules! log_info {
    ($module:expr, $message:expr) => {
        crate::logging::init_logger().info($module, $message, None);
    };
    ($module:expr, $message:expr, $metadata:expr) => {
        crate::logging::init_logger().info($module, $message, Some($metadata));
    };
}

#[macro_export]
macro_rules! log_debug {
    ($module:expr, $message:expr) => {
        crate::logging::init_logger().debug($module, $message, None);
    };
    ($module:expr, $message:expr, $metadata:expr) => {
        crate::logging::init_logger().debug($module, $message, Some($metadata));
    };
}

#[macro_export]
macro_rules! log_bitcoin_event {
    ($event:expr) => {
        crate::logging::init_logger().log_bitcoin_event($event);
    };
}
