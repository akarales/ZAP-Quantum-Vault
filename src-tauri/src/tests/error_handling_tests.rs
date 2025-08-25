#[cfg(test)]
mod tests {
    use crate::error_handling::{VaultError, Validator, ErrorHandler};

    #[test]
    fn test_vault_error_display() {
        let error = VaultError::InvalidCredentials;
        assert_eq!(error.to_string(), "Invalid username or password");

        let error = VaultError::TokenExpired;
        assert_eq!(error.to_string(), "Authentication token has expired");

        let error = VaultError::InvalidInput("Test message".to_string());
        assert_eq!(error.to_string(), "Invalid input: Test message");
    }

    #[test]
    fn test_username_validation() {
        // Valid usernames
        assert!(Validator::validate_username("validuser").is_ok());
        assert!(Validator::validate_username("user123").is_ok());
        assert!(Validator::validate_username("user_name").is_ok());
        assert!(Validator::validate_username("user-name").is_ok());

        // Invalid usernames
        assert!(Validator::validate_username("").is_err());
        assert!(Validator::validate_username("ab").is_err()); // Too short
        assert!(Validator::validate_username("a".repeat(51).as_str()).is_err()); // Too long
        assert!(Validator::validate_username("user@name").is_err()); // Invalid characters
        assert!(Validator::validate_username("user name").is_err()); // Spaces not allowed
    }

    #[test]
    fn test_email_validation() {
        // Valid emails
        assert!(Validator::validate_email("user@example.com").is_ok());
        assert!(Validator::validate_email("test.email@domain.co.uk").is_ok());
        assert!(Validator::validate_email("user+tag@example.org").is_ok());

        // Invalid emails
        assert!(Validator::validate_email("").is_err());
        assert!(Validator::validate_email("invalid-email").is_err());
        assert!(Validator::validate_email("user@").is_err());
        assert!(Validator::validate_email("@domain.com").is_err());
        assert!(Validator::validate_email("user.domain.com").is_err());
    }

    #[test]
    fn test_password_validation() {
        // Valid passwords
        assert!(Validator::validate_password("StrongPass123!").is_ok());
        assert!(Validator::validate_password("MySecure@Pass1").is_ok());
        assert!(Validator::validate_password("Complex#Password9").is_ok());

        // Invalid passwords
        assert!(Validator::validate_password("").is_err()); // Empty
        assert!(Validator::validate_password("weak").is_err()); // Too short
        assert!(Validator::validate_password("nouppercase123!").is_err()); // No uppercase
        assert!(Validator::validate_password("NOLOWERCASE123!").is_err()); // No lowercase
        assert!(Validator::validate_password("NoDigits!").is_err()); // No digits
        assert!(Validator::validate_password("NoSpecialChars123").is_err()); // No special chars
        assert!(Validator::validate_password("a".repeat(129).as_str()).is_err()); // Too long
    }

    #[test]
    fn test_vault_name_validation() {
        // Valid vault names
        assert!(Validator::validate_vault_name("My Vault").is_ok());
        assert!(Validator::validate_vault_name("Personal Documents").is_ok());
        assert!(Validator::validate_vault_name("Work-Related Files").is_ok());

        // Invalid vault names
        assert!(Validator::validate_vault_name("").is_err()); // Empty
        assert!(Validator::validate_vault_name("a".repeat(101).as_str()).is_err()); // Too long
        assert!(Validator::validate_vault_name(" Leading Space").is_err()); // Leading space
        assert!(Validator::validate_vault_name("Trailing Space ").is_err()); // Trailing space
    }

    #[test]
    fn test_item_title_validation() {
        // Valid item titles
        assert!(Validator::validate_item_title("Login Credentials").is_ok());
        assert!(Validator::validate_item_title("Bank Account Info").is_ok());
        assert!(Validator::validate_item_title("SSH Key").is_ok());

        // Invalid item titles
        assert!(Validator::validate_item_title("").is_err()); // Empty
        assert!(Validator::validate_item_title("a".repeat(201).as_str()).is_err()); // Too long
    }

    #[test]
    fn test_uuid_validation() {
        // Valid UUIDs
        assert!(Validator::validate_uuid("550e8400-e29b-41d4-a716-446655440000").is_ok());
        assert!(Validator::validate_uuid("6ba7b810-9dad-11d1-80b4-00c04fd430c8").is_ok());

        // Invalid UUIDs
        assert!(Validator::validate_uuid("").is_err()); // Empty
        assert!(Validator::validate_uuid("not-a-uuid").is_err()); // Invalid format
        assert!(Validator::validate_uuid("550e8400-e29b-41d4-a716").is_err()); // Incomplete
        assert!(Validator::validate_uuid("550e8400-e29b-41d4-a716-446655440000-extra").is_err()); // Too long
    }

    #[test]
    fn test_jwt_token_validation() {
        // Valid JWT format (3 parts separated by dots)
        assert!(Validator::validate_jwt_token("header.payload.signature").is_ok());
        assert!(Validator::validate_jwt_token("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ").is_ok());

        // Invalid JWT formats
        assert!(Validator::validate_jwt_token("").is_err()); // Empty
        assert!(Validator::validate_jwt_token("invalid-token").is_err()); // No dots
        assert!(Validator::validate_jwt_token("header.payload").is_err()); // Only 2 parts
        assert!(Validator::validate_jwt_token("header.payload.signature.extra").is_err()); // Too many parts
    }

    #[test]
    fn test_error_sanitization() {
        // Validation errors should show detailed messages
        let validation_error = VaultError::InvalidInput("Username too short".to_string());
        let sanitized = ErrorHandler::sanitize_error(&validation_error);
        assert_eq!(sanitized, "Invalid input: Username too short");

        // Internal errors should show generic messages
        let internal_error = VaultError::DatabaseQuery("SELECT failed: connection timeout".to_string());
        let sanitized = ErrorHandler::sanitize_error(&internal_error);
        assert_eq!(sanitized, "Database operation failed");

        let file_error = VaultError::FileSystemError("Permission denied: /root/secret".to_string());
        let sanitized = ErrorHandler::sanitize_error(&file_error);
        assert_eq!(sanitized, "File system operation failed");

        // User-facing errors should show specific messages
        let user_error = VaultError::DriveNotFound;
        let sanitized = ErrorHandler::sanitize_error(&user_error);
        assert_eq!(sanitized, "USB drive not found");
    }

    #[test]
    fn test_error_conversion_from_io() {
        use std::io::{Error, ErrorKind};

        let permission_error = Error::new(ErrorKind::PermissionDenied, "Access denied");
        let vault_error = ErrorHandler::from_io(permission_error);
        assert!(matches!(vault_error, VaultError::PermissionDenied));

        let not_found_error = Error::new(ErrorKind::NotFound, "File not found");
        let vault_error = ErrorHandler::from_io(not_found_error);
        assert!(matches!(vault_error, VaultError::DriveNotFound));

        let other_error = Error::new(ErrorKind::InvalidData, "Invalid data");
        let vault_error = ErrorHandler::from_io(other_error);
        assert!(matches!(vault_error, VaultError::FileSystemError(_)));
    }

    #[test]
    fn test_error_types_coverage() {
        // Test that all error types can be created and displayed
        let errors = vec![
            VaultError::InvalidCredentials,
            VaultError::TokenExpired,
            VaultError::TokenRevoked,
            VaultError::InsufficientPermissions,
            VaultError::RateLimitExceeded,
            VaultError::InvalidInput("test".to_string()),
            VaultError::MissingRequiredField("field".to_string()),
            VaultError::InvalidFormat("format".to_string()),
            VaultError::DatabaseConnection,
            VaultError::DatabaseQuery("query".to_string()),
            VaultError::UserNotFound,
            VaultError::UserAlreadyExists,
            VaultError::EncryptionFailed("reason".to_string()),
            VaultError::DecryptionFailed("reason".to_string()),
            VaultError::KeyGenerationFailed,
            VaultError::InvalidKey,
            VaultError::DriveNotFound,
            VaultError::DriveNotMounted,
            VaultError::DriveNotTrusted,
            VaultError::DriveFormatFailed("reason".to_string()),
            VaultError::BackupFailed("reason".to_string()),
            VaultError::RestoreFailed("reason".to_string()),
            VaultError::FileSystemError("error".to_string()),
            VaultError::PermissionDenied,
            VaultError::NetworkError("error".to_string()),
            VaultError::ConfigurationError("error".to_string()),
            VaultError::InternalError("error".to_string()),
            VaultError::NotImplemented,
        ];

        for error in errors {
            let display_str = error.to_string();
            assert!(!display_str.is_empty());
        }
    }
}
