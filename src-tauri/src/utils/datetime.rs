use chrono::{DateTime, Utc, NaiveDateTime};
use log::{error, debug};

pub fn now_rfc3339() -> String {
    Utc::now().to_rfc3339()
}

pub fn parse_datetime_safe(datetime_str: &str, context: &str) -> Result<DateTime<Utc>, String> {
    debug!("🔧 Parsing datetime: '{}' in context: {}", datetime_str, context);
    
    // Try RFC3339 first (preferred format)
    if let Ok(dt) = DateTime::parse_from_rfc3339(datetime_str) {
        debug!("✅ Parsed as RFC3339: {}", dt);
        return Ok(dt.with_timezone(&Utc));
    }
    
    // Try SQLite CURRENT_TIMESTAMP format: "YYYY-MM-DD HH:MM:SS"
    if let Ok(dt) = NaiveDateTime::parse_from_str(datetime_str, "%Y-%m-%d %H:%M:%S") {
        debug!("✅ Parsed as SQLite CURRENT_TIMESTAMP: {}", dt);
        return Ok(dt.and_utc());
    }
    
    // Try ISO format without timezone
    if let Ok(dt) = NaiveDateTime::parse_from_str(datetime_str, "%Y-%m-%dT%H:%M:%S") {
        debug!("✅ Parsed as ISO without timezone: {}", dt);
        return Ok(dt.and_utc());
    }
    
    // Try with microseconds
    if let Ok(dt) = NaiveDateTime::parse_from_str(datetime_str, "%Y-%m-%d %H:%M:%S%.f") {
        debug!("✅ Parsed as SQLite with microseconds: {}", dt);
        return Ok(dt.and_utc());
    }
    
    error!("❌ Failed to parse datetime '{}' in context: {}", datetime_str, context);
    Err(format!("Invalid datetime format: {} (context: {})", datetime_str, context))
}
