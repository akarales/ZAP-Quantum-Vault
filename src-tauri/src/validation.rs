use regex::Regex;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ValidationError {
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    #[error("Security violation: {0}")]
    SecurityViolation(String),
    #[error("Path validation failed: {0}")]
    PathValidation(String),
}

pub struct InputValidator;

impl InputValidator {
    /// Validate vault name - alphanumeric, spaces, hyphens, underscores only
    pub fn validate_vault_name(name: &str) -> Result<String, ValidationError> {
        if name.is_empty() {
            return Err(ValidationError::InvalidInput("Vault name cannot be empty".to_string()));
        }
        
        if name.len() > 255 {
            return Err(ValidationError::InvalidInput("Vault name too long (max 255 characters)".to_string()));
        }
        
        // Allow alphanumeric, spaces, hyphens, underscores
        let valid_chars = Regex::new(r"^[a-zA-Z0-9\s\-_]+$").unwrap();
        if !valid_chars.is_match(name) {
            return Err(ValidationError::InvalidInput("Vault name contains invalid characters".to_string()));
        }
        
        // Check for SQL injection patterns
        let sql_patterns = [
            "drop", "delete", "insert", "update", "select", "union", "exec", "execute",
            "--", "/*", "*/", ";", "'", "\"", "xp_", "sp_"
        ];
        
        let name_lower = name.to_lowercase();
        for pattern in &sql_patterns {
            if name_lower.contains(pattern) {
                return Err(ValidationError::SecurityViolation("Potentially malicious input detected".to_string()));
            }
        }
        
        // Sanitize and normalize
        Ok(name.trim().to_string())
    }
    
    /// Validate vault item title
    pub fn validate_item_title(title: &str) -> Result<String, ValidationError> {
        if title.is_empty() {
            return Err(ValidationError::InvalidInput("Item title cannot be empty".to_string()));
        }
        
        if title.len() > 500 {
            return Err(ValidationError::InvalidInput("Item title too long (max 500 characters)".to_string()));
        }
        
        // More permissive for titles but still safe
        let valid_chars = Regex::new(r"^[a-zA-Z0-9\s\-_.,!@#$%^&*()+=\[\]{}|;:,.<>?/\\]+$").unwrap();
        if !valid_chars.is_match(title) {
            return Err(ValidationError::InvalidInput("Item title contains invalid characters".to_string()));
        }
        
        Self::check_sql_injection(title)?;
        Ok(title.trim().to_string())
    }
    
    /// Validate drive ID - only safe characters
    pub fn validate_drive_id(drive_id: &str) -> Result<String, ValidationError> {
        if drive_id.is_empty() {
            return Err(ValidationError::InvalidInput("Drive ID cannot be empty".to_string()));
        }
        
        if drive_id.len() > 50 {
            return Err(ValidationError::InvalidInput("Drive ID too long (max 50 characters)".to_string()));
        }
        
        // Only allow safe characters for drive IDs
        let valid_pattern = Regex::new(r"^[a-zA-Z0-9_-]+$").unwrap();
        if !valid_pattern.is_match(drive_id) {
            return Err(ValidationError::InvalidInput("Drive ID contains invalid characters".to_string()));
        }
        
        Ok(drive_id.to_string())
    }
    
    /// Validate file paths and prevent path traversal attacks
    pub fn validate_file_path(path: &str) -> Result<PathBuf, ValidationError> {
        if path.is_empty() {
            return Err(ValidationError::PathValidation("Path cannot be empty".to_string()));
        }
        
        let path_obj = Path::new(path);
        
        // Prevent path traversal attacks
        if path.contains("..") {
            return Err(ValidationError::SecurityViolation("Path traversal attempt detected".to_string()));
        }
        
        // Check for null bytes and other dangerous characters
        if path.contains('\0') || path.contains('\x01') {
            return Err(ValidationError::SecurityViolation("Null bytes detected in path".to_string()));
        }
        
        // Prevent access to sensitive system directories
        let forbidden_paths = [
            "/etc/", "/proc/", "/sys/", "/dev/", "/root/", "/boot/",
            "/var/log/", "/var/run/", "/usr/bin/", "/usr/sbin/",
            "C:\\Windows\\", "C:\\Program Files\\", "C:\\Users\\Administrator\\",
        ];
        
        for forbidden in &forbidden_paths {
            if path.starts_with(forbidden) {
                return Err(ValidationError::SecurityViolation("Access to system directory denied".to_string()));
            }
        }
        
        // Only allow access to specific safe directories
        let allowed_bases = [
            "/media/", "/mnt/", "/tmp/zap-vault/", "/home/", "/Users/",
        ];
        
        let mut is_allowed = false;
        for base in &allowed_bases {
            if path.starts_with(base) {
                is_allowed = true;
                break;
            }
        }
        
        if !is_allowed {
            return Err(ValidationError::SecurityViolation("Path outside allowed directories".to_string()));
        }
        
        // Try to canonicalize the path to resolve any remaining issues
        match path_obj.canonicalize() {
            Ok(canonical) => Ok(canonical),
            Err(_) => {
                // If canonicalization fails, return the original path but validated
                Ok(path_obj.to_path_buf())
            }
        }
    }
    
    /// Validate UUID format
    pub fn validate_uuid(uuid: &str) -> Result<String, ValidationError> {
        if uuid.is_empty() {
            return Err(ValidationError::InvalidInput("UUID cannot be empty".to_string()));
        }
        
        // UUID format: 8-4-4-4-12 hexadecimal digits
        let uuid_pattern = Regex::new(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$").unwrap();
        if !uuid_pattern.is_match(uuid) {
            return Err(ValidationError::InvalidInput("Invalid UUID format".to_string()));
        }
        
        Ok(uuid.to_lowercase())
    }
    
    /// Validate backup name
    pub fn validate_backup_name(name: &str) -> Result<String, ValidationError> {
        if name.is_empty() {
            return Err(ValidationError::InvalidInput("Backup name cannot be empty".to_string()));
        }
        
        if name.len() > 100 {
            return Err(ValidationError::InvalidInput("Backup name too long (max 100 characters)".to_string()));
        }
        
        // Safe characters for backup names
        let valid_chars = Regex::new(r"^[a-zA-Z0-9\s\-_.]+$").unwrap();
        if !valid_chars.is_match(name) {
            return Err(ValidationError::InvalidInput("Backup name contains invalid characters".to_string()));
        }
        
        Self::check_sql_injection(name)?;
        Ok(name.trim().to_string())
    }
    
    /// Generic SQL injection check
    fn check_sql_injection(input: &str) -> Result<(), ValidationError> {
        let sql_patterns = [
            "drop table", "delete from", "insert into", "update set", "select from",
            "union select", "exec(", "execute(", "xp_cmdshell", "sp_executesql",
            "'; drop", "\"; drop", "' or '1'='1", "\" or \"1\"=\"1",
            "' union select", "\" union select", "' and 1=1", "\" and 1=1",
        ];
        
        let input_lower = input.to_lowercase();
        for pattern in &sql_patterns {
            if input_lower.contains(pattern) {
                return Err(ValidationError::SecurityViolation("SQL injection attempt detected".to_string()));
            }
        }
        
        Ok(())
    }
    
    /// Sanitize string for safe database storage
    pub fn sanitize_for_database(input: &str) -> String {
        input
            .replace("'", "''")      // Escape single quotes
            .replace("\\", "\\\\")   // Escape backslashes
            .replace("\0", "")       // Remove null bytes
            .replace("\x1a", "")     // Remove substitute character
    }
    
    /// Validate item type
    pub fn validate_item_type(item_type: &str) -> Result<String, ValidationError> {
        if item_type.is_empty() {
            return Err(ValidationError::InvalidInput("Item type cannot be empty".to_string()));
        }
        
        // Only allow predefined item types
        let valid_types = [
            "password", "note", "credit_card", "identity", "secure_note",
            "bitcoin_key", "ethereum_key", "crypto_key", "document", "file"
        ];
        
        if !valid_types.contains(&item_type) {
            return Err(ValidationError::InvalidInput("Invalid item type".to_string()));
        }
        
        Ok(item_type.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_vault_name_validation() {
        // Valid names
        assert!(InputValidator::validate_vault_name("My Vault").is_ok());
        assert!(InputValidator::validate_vault_name("Test_Vault-123").is_ok());
        
        // Invalid names
        assert!(InputValidator::validate_vault_name("").is_err());
        assert!(InputValidator::validate_vault_name("Vault'; DROP TABLE users; --").is_err());
        assert!(InputValidator::validate_vault_name("Vault<script>").is_err());
        
        // Too long
        let long_name = "a".repeat(256);
        assert!(InputValidator::validate_vault_name(&long_name).is_err());
    }
    
    #[test]
    fn test_drive_id_validation() {
        // Valid drive IDs
        assert!(InputValidator::validate_drive_id("usb_sdf").is_ok());
        assert!(InputValidator::validate_drive_id("drive-123").is_ok());
        
        // Invalid drive IDs
        assert!(InputValidator::validate_drive_id("").is_err());
        assert!(InputValidator::validate_drive_id("drive/path").is_err());
        assert!(InputValidator::validate_drive_id("drive with spaces").is_err());
    }
    
    #[test]
    fn test_path_validation() {
        // Valid paths
        assert!(InputValidator::validate_file_path("/media/usb/backup").is_ok());
        assert!(InputValidator::validate_file_path("/tmp/zap-vault/test").is_ok());
        
        // Path traversal attempts
        assert!(InputValidator::validate_file_path("../../../etc/passwd").is_err());
        assert!(InputValidator::validate_file_path("/media/../etc/passwd").is_err());
        
        // System directories
        assert!(InputValidator::validate_file_path("/etc/passwd").is_err());
        assert!(InputValidator::validate_file_path("/proc/version").is_err());
    }
    
    #[test]
    fn test_sql_injection_detection() {
        // SQL injection attempts
        assert!(InputValidator::validate_vault_name("'; DROP TABLE users; --").is_err());
        assert!(InputValidator::validate_vault_name("' UNION SELECT * FROM passwords").is_err());
        assert!(InputValidator::validate_item_title("test'; DELETE FROM vault_items; --").is_err());
    }
    
    #[test]
    fn test_uuid_validation() {
        // Valid UUIDs
        assert!(InputValidator::validate_uuid("123e4567-e89b-12d3-a456-426614174000").is_ok());
        assert!(InputValidator::validate_uuid("550E8400-E29B-41D4-A716-446655440000").is_ok());
        
        // Invalid UUIDs
        assert!(InputValidator::validate_uuid("").is_err());
        assert!(InputValidator::validate_uuid("not-a-uuid").is_err());
        assert!(InputValidator::validate_uuid("123e4567-e89b-12d3-a456").is_err()); // Too short
    }
    
    #[test]
    fn test_item_type_validation() {
        // Valid types
        assert!(InputValidator::validate_item_type("password").is_ok());
        assert!(InputValidator::validate_item_type("bitcoin_key").is_ok());
        
        // Invalid types
        assert!(InputValidator::validate_item_type("").is_err());
        assert!(InputValidator::validate_item_type("malicious_type").is_err());
        assert!(InputValidator::validate_item_type("script").is_err());
    }
}
