use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fmt;

/// Custom error types for the ZAP Quantum Vault application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VaultError {
    // Authentication errors
    InvalidCredentials,
    TokenExpired,
    TokenRevoked,
    InsufficientPermissions,
    RateLimitExceeded,
    
    // Validation errors
    InvalidInput(String),
    MissingRequiredField(String),
    InvalidFormat(String),
    
    // Database errors
    DatabaseConnection,
    DatabaseQuery(String),
    UserNotFound,
    UserAlreadyExists,
    
    // Cryptography errors
    EncryptionFailed(String),
    DecryptionFailed(String),
    KeyGenerationFailed,
    InvalidKey,
    
    // Cold storage errors
    DriveNotFound,
    DriveNotMounted,
    DriveNotTrusted,
    DriveFormatFailed(String),
    BackupFailed(String),
    RestoreFailed(String),
    
    // System errors
    FileSystemError(String),
    PermissionDenied,
    NetworkError(String),
    ConfigurationError(String),
    
    // Generic errors
    InternalError(String),
    NotImplemented,
}

impl fmt::Display for VaultError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            VaultError::InvalidCredentials => write!(f, "Invalid username or password"),
            VaultError::TokenExpired => write!(f, "Authentication token has expired"),
            VaultError::TokenRevoked => write!(f, "Authentication token has been revoked"),
            VaultError::InsufficientPermissions => write!(f, "Insufficient permissions for this operation"),
            VaultError::RateLimitExceeded => write!(f, "Rate limit exceeded. Please try again later"),
            
            VaultError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            VaultError::MissingRequiredField(field) => write!(f, "Missing required field: {}", field),
            VaultError::InvalidFormat(msg) => write!(f, "Invalid format: {}", msg),
            
            VaultError::DatabaseConnection => write!(f, "Failed to connect to database"),
            VaultError::DatabaseQuery(msg) => write!(f, "Database query failed: {}", msg),
            VaultError::UserNotFound => write!(f, "User not found"),
            VaultError::UserAlreadyExists => write!(f, "User already exists"),
            
            VaultError::EncryptionFailed(msg) => write!(f, "Encryption failed: {}", msg),
            VaultError::DecryptionFailed(msg) => write!(f, "Decryption failed: {}", msg),
            VaultError::KeyGenerationFailed => write!(f, "Failed to generate cryptographic keys"),
            VaultError::InvalidKey => write!(f, "Invalid cryptographic key"),
            
            VaultError::DriveNotFound => write!(f, "USB drive not found"),
            VaultError::DriveNotMounted => write!(f, "USB drive is not mounted"),
            VaultError::DriveNotTrusted => write!(f, "USB drive is not trusted"),
            VaultError::DriveFormatFailed(msg) => write!(f, "Drive formatting failed: {}", msg),
            VaultError::BackupFailed(msg) => write!(f, "Backup operation failed: {}", msg),
            VaultError::RestoreFailed(msg) => write!(f, "Restore operation failed: {}", msg),
            
            VaultError::FileSystemError(msg) => write!(f, "File system error: {}", msg),
            VaultError::PermissionDenied => write!(f, "Permission denied"),
            VaultError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            VaultError::ConfigurationError(msg) => write!(f, "Configuration error: {}", msg),
            
            VaultError::InternalError(msg) => write!(f, "Internal error: {}", msg),
            VaultError::NotImplemented => write!(f, "Feature not yet implemented"),
        }
    }
}

impl std::error::Error for VaultError {}

/// Input validation utilities
pub struct Validator;

impl Validator {
    /// Validate username format
    pub fn validate_username(username: &str) -> Result<(), VaultError> {
        if username.is_empty() {
            return Err(VaultError::MissingRequiredField("username".to_string()));
        }
        
        if username.len() < 3 {
            return Err(VaultError::InvalidInput("Username must be at least 3 characters long".to_string()));
        }
        
        if username.len() > 50 {
            return Err(VaultError::InvalidInput("Username must be less than 50 characters".to_string()));
        }
        
        if !username.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
            return Err(VaultError::InvalidInput("Username can only contain letters, numbers, underscores, and hyphens".to_string()));
        }
        
        Ok(())
    }
    
    /// Validate email format
    pub fn validate_email(email: &str) -> Result<(), VaultError> {
        if email.is_empty() {
            return Err(VaultError::MissingRequiredField("email".to_string()));
        }
        
        // Check basic email format requirements
        if !email.contains('@') || !email.contains('.') {
            return Err(VaultError::InvalidFormat("Invalid email format".to_string()));
        }
        
        // Email cannot start with @
        if email.starts_with('@') {
            return Err(VaultError::InvalidFormat("Invalid email format".to_string()));
        }
        
        // Email cannot end with @
        if email.ends_with('@') {
            return Err(VaultError::InvalidFormat("Invalid email format".to_string()));
        }
        
        // Must have content before and after @
        let parts: Vec<&str> = email.split('@').collect();
        if parts.len() != 2 || parts[0].is_empty() || parts[1].is_empty() {
            return Err(VaultError::InvalidFormat("Invalid email format".to_string()));
        }
        
        if email.len() > 254 {
            return Err(VaultError::InvalidInput("Email address is too long".to_string()));
        }
        
        Ok(())
    }
    
    /// Validate password strength
    pub fn validate_password(password: &str) -> Result<(), VaultError> {
        if password.is_empty() {
            return Err(VaultError::MissingRequiredField("password".to_string()));
        }
        
        if password.len() < 8 {
            return Err(VaultError::InvalidInput("Password must be at least 8 characters long".to_string()));
        }
        
        if password.len() > 128 {
            return Err(VaultError::InvalidInput("Password is too long".to_string()));
        }
        
        let has_uppercase = password.chars().any(|c| c.is_uppercase());
        let has_lowercase = password.chars().any(|c| c.is_lowercase());
        let has_digit = password.chars().any(|c| c.is_numeric());
        let has_special = password.chars().any(|c| !c.is_alphanumeric());
        
        if !has_uppercase {
            return Err(VaultError::InvalidInput("Password must contain at least one uppercase letter".to_string()));
        }
        
        if !has_lowercase {
            return Err(VaultError::InvalidInput("Password must contain at least one lowercase letter".to_string()));
        }
        
        if !has_digit {
            return Err(VaultError::InvalidInput("Password must contain at least one digit".to_string()));
        }
        
        if !has_special {
            return Err(VaultError::InvalidInput("Password must contain at least one special character".to_string()));
        }
        
        Ok(())
    }
    
    /// Validate vault name
    pub fn validate_vault_name(name: &str) -> Result<(), VaultError> {
        if name.is_empty() {
            return Err(VaultError::MissingRequiredField("vault name".to_string()));
        }
        
        if name.len() > 100 {
            return Err(VaultError::InvalidInput("Vault name is too long".to_string()));
        }
        
        if name.trim() != name {
            return Err(VaultError::InvalidInput("Vault name cannot have leading or trailing whitespace".to_string()));
        }
        
        Ok(())
    }
    
    /// Validate vault item title
    pub fn validate_item_title(title: &str) -> Result<(), VaultError> {
        if title.is_empty() {
            return Err(VaultError::MissingRequiredField("item title".to_string()));
        }
        
        if title.len() > 200 {
            return Err(VaultError::InvalidInput("Item title is too long".to_string()));
        }
        
        Ok(())
    }
    
    /// Validate UUID format
    pub fn validate_uuid(uuid: &str) -> Result<(), VaultError> {
        if uuid.is_empty() {
            return Err(VaultError::MissingRequiredField("UUID".to_string()));
        }
        
        if uuid::Uuid::parse_str(uuid).is_err() {
            return Err(VaultError::InvalidFormat("Invalid UUID format".to_string()));
        }
        
        Ok(())
    }
    
    /// Validate JWT token format
    pub fn validate_jwt_token(token: &str) -> Result<(), VaultError> {
        if token.is_empty() {
            return Err(VaultError::MissingRequiredField("authentication token".to_string()));
        }
        
        let parts: Vec<&str> = token.split('.').collect();
        if parts.len() != 3 {
            return Err(VaultError::InvalidFormat("Invalid JWT token format".to_string()));
        }
        
        Ok(())
    }
}

/// Error handling utilities
pub struct ErrorHandler;

impl ErrorHandler {
    /// Convert anyhow::Error to VaultError
    pub fn from_anyhow(error: anyhow::Error) -> VaultError {
        VaultError::InternalError(error.to_string())
    }
    
    /// Convert sqlx::Error to VaultError
    pub fn from_sqlx(error: sqlx::Error) -> VaultError {
        match error {
            sqlx::Error::RowNotFound => VaultError::UserNotFound,
            sqlx::Error::Database(db_err) => {
                if db_err.message().contains("UNIQUE constraint failed") {
                    VaultError::UserAlreadyExists
                } else {
                    VaultError::DatabaseQuery(db_err.message().to_string())
                }
            }
            _ => VaultError::DatabaseQuery(error.to_string()),
        }
    }
    
    /// Convert std::io::Error to VaultError
    pub fn from_io(error: std::io::Error) -> VaultError {
        match error.kind() {
            std::io::ErrorKind::PermissionDenied => VaultError::PermissionDenied,
            std::io::ErrorKind::NotFound => VaultError::DriveNotFound,
            _ => VaultError::FileSystemError(error.to_string()),
        }
    }
    
    /// Log error with context
    pub fn log_error(error: &VaultError, context: &str) {
        eprintln!("[ERROR] {}: {}", context, error);
    }
    
    /// Log warning with context
    pub fn log_warning(message: &str, context: &str) {
        eprintln!("[WARNING] {}: {}", context, message);
    }
    
    /// Create a sanitized error message for frontend
    pub fn sanitize_error(error: &VaultError) -> String {
        match error {
            // Return detailed messages for validation errors
            VaultError::InvalidInput(_) |
            VaultError::MissingRequiredField(_) |
            VaultError::InvalidFormat(_) => error.to_string(),
            
            // Return generic messages for security-sensitive errors
            VaultError::DatabaseQuery(_) => "Database operation failed".to_string(),
            VaultError::InternalError(_) => "An internal error occurred".to_string(),
            VaultError::FileSystemError(_) => "File system operation failed".to_string(),
            
            // Return specific messages for user-facing errors
            _ => error.to_string(),
        }
    }
}

/// Result type alias for convenience
pub type VaultResult<T> = Result<T, VaultError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_username_validation() {
        assert!(Validator::validate_username("validuser").is_ok());
        assert!(Validator::validate_username("user_123").is_ok());
        assert!(Validator::validate_username("user-name").is_ok());
        
        assert!(Validator::validate_username("").is_err());
        assert!(Validator::validate_username("ab").is_err());
        assert!(Validator::validate_username("user@name").is_err());
    }

    #[test]
    fn test_email_validation() {
        assert!(Validator::validate_email("user@example.com").is_ok());
        assert!(Validator::validate_email("test.email@domain.co.uk").is_ok());
        
        assert!(Validator::validate_email("").is_err());
        assert!(Validator::validate_email("invalid-email").is_err());
        assert!(Validator::validate_email("user@").is_err());
    }

    #[test]
    fn test_password_validation() {
        assert!(Validator::validate_password("StrongPass123!").is_ok());
        
        assert!(Validator::validate_password("").is_err());
        assert!(Validator::validate_password("weak").is_err());
        assert!(Validator::validate_password("nouppercase123!").is_err());
        assert!(Validator::validate_password("NOLOWERCASE123!").is_err());
        assert!(Validator::validate_password("NoDigits!").is_err());
        assert!(Validator::validate_password("NoSpecialChars123").is_err());
    }
}
