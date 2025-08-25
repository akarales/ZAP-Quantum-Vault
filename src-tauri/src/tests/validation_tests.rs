#[cfg(test)]
mod tests {
    use crate::error_handling::{VaultError, Validator};

    #[test]
    fn test_edge_case_validations() {
        // Test username edge cases
        assert!(Validator::validate_username("abc").is_ok()); // Minimum length
        assert!(Validator::validate_username(&"a".repeat(50)).is_ok()); // Maximum length
        assert!(Validator::validate_username("user_123-test").is_ok()); // Mixed valid chars
        
        // Test email edge cases
        assert!(Validator::validate_email("a@b.c").is_ok()); // Minimal valid email
        assert!(Validator::validate_email(&format!("{}@example.com", "a".repeat(243))).is_err()); // Too long (243 + 12 = 255 chars > 254 limit)
        
        // Test password complexity edge cases
        assert!(Validator::validate_password("Aa1!").is_err()); // Too short but has all requirements
        assert!(Validator::validate_password("Aa1!abcd").is_ok()); // Minimum valid
        
        // Test vault name edge cases
        assert!(Validator::validate_vault_name("A").is_ok()); // Single character
        assert!(Validator::validate_vault_name(&"a".repeat(100)).is_ok()); // Maximum length
        
        // Test UUID edge cases
        assert!(Validator::validate_uuid("00000000-0000-0000-0000-000000000000").is_ok()); // All zeros
        assert!(Validator::validate_uuid("FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF").is_ok()); // All F's uppercase
        assert!(Validator::validate_uuid("ffffffff-ffff-ffff-ffff-ffffffffffff").is_ok()); // All f's lowercase
    }

    #[test]
    fn test_validation_error_messages() {
        // Test that validation errors contain helpful messages
        match Validator::validate_username("") {
            Err(VaultError::MissingRequiredField(field)) => assert_eq!(field, "username"),
            _ => panic!("Expected MissingRequiredField error"),
        }

        match Validator::validate_username("ab") {
            Err(VaultError::InvalidInput(msg)) => assert!(msg.contains("at least 3 characters")),
            _ => panic!("Expected InvalidInput error"),
        }

        match Validator::validate_email("invalid") {
            Err(VaultError::InvalidFormat(msg)) => assert!(msg.contains("Invalid email format")),
            _ => panic!("Expected InvalidFormat error"),
        }

        match Validator::validate_password("weak") {
            Err(VaultError::InvalidInput(msg)) => assert!(msg.contains("at least 8 characters")),
            _ => panic!("Expected InvalidInput error"),
        }
    }

    #[test]
    fn test_password_complexity_requirements() {
        // Test each password requirement individually
        
        // Missing uppercase
        match Validator::validate_password("lowercase123!") {
            Err(VaultError::InvalidInput(msg)) => assert!(msg.contains("uppercase")),
            _ => panic!("Expected uppercase requirement error"),
        }

        // Missing lowercase  
        match Validator::validate_password("UPPERCASE123!") {
            Err(VaultError::InvalidInput(msg)) => assert!(msg.contains("lowercase")),
            _ => panic!("Expected lowercase requirement error"),
        }

        // Missing digit
        match Validator::validate_password("NoDigits!") {
            Err(VaultError::InvalidInput(msg)) => assert!(msg.contains("digit")),
            _ => panic!("Expected digit requirement error"),
        }

        // Missing special character
        match Validator::validate_password("NoSpecialChars123") {
            Err(VaultError::InvalidInput(msg)) => assert!(msg.contains("special character")),
            _ => panic!("Expected special character requirement error"),
        }
    }

    #[test]
    fn test_unicode_and_special_characters() {
        // Test usernames with various characters
        assert!(Validator::validate_username("user123").is_ok());
        assert!(Validator::validate_username("user_name").is_ok());
        assert!(Validator::validate_username("user-name").is_ok());
        assert!(Validator::validate_username("user.name").is_err()); // Dots not allowed
        assert!(Validator::validate_username("user@name").is_err()); // @ not allowed
        assert!(Validator::validate_username("user name").is_err()); // Spaces not allowed

        // Test passwords with various special characters
        assert!(Validator::validate_password("Password123!").is_ok());
        assert!(Validator::validate_password("Password123@").is_ok());
        assert!(Validator::validate_password("Password123#").is_ok());
        assert!(Validator::validate_password("Password123$").is_ok());
        assert!(Validator::validate_password("Password123%").is_ok());
        assert!(Validator::validate_password("Password123^").is_ok());
        assert!(Validator::validate_password("Password123&").is_ok());
        assert!(Validator::validate_password("Password123*").is_ok());
    }

    #[test]
    fn test_whitespace_handling() {
        // Test vault names with whitespace
        assert!(Validator::validate_vault_name("Normal Name").is_ok());
        assert!(Validator::validate_vault_name(" Leading Space").is_err());
        assert!(Validator::validate_vault_name("Trailing Space ").is_err());
        assert!(Validator::validate_vault_name("  Both Sides  ").is_err());
        assert!(Validator::validate_vault_name("\tTab Character").is_err());
        assert!(Validator::validate_vault_name("Name\nWith\nNewlines").is_ok()); // Internal whitespace OK

        // Test item titles (should allow leading/trailing spaces)
        assert!(Validator::validate_item_title("Normal Title").is_ok());
        assert!(Validator::validate_item_title(" Title with spaces ").is_ok());
    }

    #[test]
    fn test_boundary_conditions() {
        // Test exact boundary conditions for lengths
        
        // Username boundaries
        assert!(Validator::validate_username("ab").is_err()); // 2 chars (too short)
        assert!(Validator::validate_username("abc").is_ok()); // 3 chars (minimum)
        assert!(Validator::validate_username(&"a".repeat(50)).is_ok()); // 50 chars (maximum)
        assert!(Validator::validate_username(&"a".repeat(51)).is_err()); // 51 chars (too long)

        // Password boundaries
        assert!(Validator::validate_password("Aa1!abc").is_err()); // 7 chars (too short)
        assert!(Validator::validate_password("Aa1!abcd").is_ok()); // 8 chars (minimum)
        assert!(Validator::validate_password(&format!("Aa1!{}", "a".repeat(124))).is_ok()); // 128 chars (maximum)
        assert!(Validator::validate_password(&format!("Aa1!{}", "a".repeat(125))).is_err()); // 129 chars (too long)

        // Email boundaries
        assert!(Validator::validate_email(&format!("{}@example.com", "a".repeat(254 - 12))).is_ok()); // Near max
        assert!(Validator::validate_email(&format!("{}@example.com", "a".repeat(254 - 11))).is_err()); // Over max

        // Vault name boundaries
        assert!(Validator::validate_vault_name(&"a".repeat(100)).is_ok()); // 100 chars (maximum)
        assert!(Validator::validate_vault_name(&"a".repeat(101)).is_err()); // 101 chars (too long)

        // Item title boundaries
        assert!(Validator::validate_item_title(&"a".repeat(200)).is_ok()); // 200 chars (maximum)
        assert!(Validator::validate_item_title(&"a".repeat(201)).is_err()); // 201 chars (too long)
    }
}
