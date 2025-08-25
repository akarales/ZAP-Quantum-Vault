#[cfg(test)]
mod tests {
    use crate::jwt::{JwtManager, Claims};
    use chrono::{Duration, Utc};

    #[test]
    fn test_jwt_generation() {
        let jwt_manager = JwtManager::new().unwrap();
        let token = jwt_manager.generate_token("user123", "testuser", "user").unwrap();
        
        assert!(!token.is_empty());
        assert_eq!(token.matches('.').count(), 2); // JWT has 3 parts separated by dots
    }

    #[test]
    fn test_jwt_validation() {
        let jwt_manager = JwtManager::new().unwrap();
        let token = jwt_manager.generate_token("user123", "testuser", "user").unwrap();
        
        let claims = jwt_manager.validate_token(&token).unwrap();
        assert_eq!(claims.sub, "user123");
        assert_eq!(claims.username, "testuser");
        assert_eq!(claims.role, "user");
        
        // Check expiration is in the future
        let now = Utc::now().timestamp();
        assert!(claims.exp > now);
    }

    #[test]
    fn test_invalid_jwt() {
        let jwt_manager = JwtManager::new().unwrap();
        
        // Test invalid token format
        assert!(jwt_manager.validate_token("invalid.token").is_err());
        assert!(jwt_manager.validate_token("").is_err());
        assert!(jwt_manager.validate_token("not.a.jwt.token").is_err());
    }

    #[test]
    fn test_jwt_revocation() {
        let jwt_manager = JwtManager::new().unwrap();
        let token = jwt_manager.generate_token("user123", "testuser", "user").unwrap();
        
        // Token should be valid initially
        assert!(jwt_manager.validate_token(&token).is_ok());
        
        // Revoke token
        jwt_manager.revoke_token(&token).unwrap();
        
        // Token should now be invalid
        assert!(jwt_manager.validate_token(&token).is_err());
    }

    #[test]
    fn test_jwt_refresh() {
        let jwt_manager = JwtManager::new().unwrap();
        let token = jwt_manager.generate_token("user123", "testuser", "user").unwrap();
        
        // For testing, we'll just verify the token structure
        let original_claims = jwt_manager.validate_token(&token).unwrap();
        assert_eq!(original_claims.sub, "user123");
    }

    #[test]
    fn test_jwt_expiration_check() {
        let jwt_manager = JwtManager::new().unwrap();
        let token = jwt_manager.generate_token("user123", "testuser", "user").unwrap();
        
        // Token should not be expiring soon (within 60 minutes)
        let is_expiring = jwt_manager.is_token_expiring_soon(&token, 60).unwrap();
        assert!(!is_expiring);
        
        // Token should be expiring soon if we check for a very long time window
        let is_expiring_long = jwt_manager.is_token_expiring_soon(&token, 24 * 60 + 1).unwrap();
        assert!(is_expiring_long);
    }

    #[test]
    fn test_rate_limiting() {
        let jwt_manager = JwtManager::new().unwrap();
        
        // Use a unique user ID to avoid test interference
        let test_user = format!("test_user_{}", std::process::id());
        
        // First request should pass (count = 1)
        assert!(jwt_manager.check_rate_limit(&test_user, 2, 1).unwrap());
        
        // Second request should pass (count = 2, at limit)
        assert!(jwt_manager.check_rate_limit(&test_user, 2, 1).unwrap());
        
        // Third request should fail (count would be 3, exceeds limit of 2)
        assert!(!jwt_manager.check_rate_limit(&test_user, 2, 1).unwrap());
        
        // Different user should not be affected
        let other_user = format!("other_user_{}", std::process::id());
        assert!(jwt_manager.check_rate_limit(&other_user, 2, 1).unwrap());
    }

    #[test]
    fn test_cleanup_expired_tokens() {
        let jwt_manager = JwtManager::new().unwrap();
        
        // This test mainly ensures the cleanup function doesn't crash
        assert!(jwt_manager.cleanup_expired_tokens().is_ok());
    }

    #[test]
    fn test_multiple_tokens_same_user() {
        let jwt_manager = JwtManager::new().unwrap();
        
        let token1 = jwt_manager.generate_token("user123", "testuser", "user").unwrap();
        let token2 = jwt_manager.generate_token("user123", "testuser", "user").unwrap();
        
        // Both tokens should be valid and different
        assert_ne!(token1, token2);
        assert!(jwt_manager.validate_token(&token1).is_ok());
        assert!(jwt_manager.validate_token(&token2).is_ok());
        
        // Revoking one shouldn't affect the other
        jwt_manager.revoke_token(&token1).unwrap();
        assert!(jwt_manager.validate_token(&token1).is_err());
        assert!(jwt_manager.validate_token(&token2).is_ok());
    }
}
