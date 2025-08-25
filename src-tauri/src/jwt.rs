use anyhow::{anyhow, Result};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,      // Subject (user ID)
    pub username: String, // Username
    pub role: String,     // User role
    pub exp: i64,         // Expiration time
    pub iat: i64,         // Issued at
    pub jti: String,      // JWT ID (for revocation)
}

#[derive(Clone)]
pub struct JwtManager {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    algorithm: Algorithm,
    expiration_hours: i64,
}

// Global session store for token revocation
static REVOKED_TOKENS: Lazy<Arc<Mutex<HashMap<String, i64>>>> = Lazy::new(|| {
    Arc::new(Mutex::new(HashMap::new()))
});

// Rate limiting store
static RATE_LIMIT_STORE: Lazy<Arc<Mutex<HashMap<String, (i64, u32)>>>> = Lazy::new(|| {
    Arc::new(Mutex::new(HashMap::new()))
});

impl JwtManager {
    pub fn new() -> Result<Self> {
        // In production, this should be loaded from environment or secure storage
        let secret = std::env::var("JWT_SECRET")
            .unwrap_or_else(|_| "zap_quantum_vault_jwt_secret_2025_secure_key".to_string());
        
        let encoding_key = EncodingKey::from_secret(secret.as_ref());
        let decoding_key = DecodingKey::from_secret(secret.as_ref());
        
        Ok(Self {
            encoding_key,
            decoding_key,
            algorithm: Algorithm::HS256,
            expiration_hours: 24, // 24 hours default
        })
    }

    /// Generate a new JWT token for a user
    pub fn generate_token(&self, user_id: &str, username: &str, role: &str) -> Result<String> {
        let now = Utc::now();
        let exp = now + Duration::hours(self.expiration_hours);
        let jti = uuid::Uuid::new_v4().to_string();

        let claims = Claims {
            sub: user_id.to_string(),
            username: username.to_string(),
            role: role.to_string(),
            exp: exp.timestamp(),
            iat: now.timestamp(),
            jti,
        };

        let header = Header::new(self.algorithm);
        encode(&header, &claims, &self.encoding_key)
            .map_err(|e| anyhow!("Failed to generate token: {}", e))
    }

    /// Validate and decode a JWT token
    pub fn validate_token(&self, token: &str) -> Result<Claims> {
        let mut validation = Validation::new(self.algorithm);
        validation.validate_exp = true;
        validation.validate_nbf = false;

        let token_data = decode::<Claims>(token, &self.decoding_key, &validation)
            .map_err(|e| anyhow!("Invalid token: {}", e))?;

        // Check if token is revoked
        let revoked_tokens = REVOKED_TOKENS.lock()
            .map_err(|e| anyhow!("Failed to access revoked tokens: {}", e))?;
        
        if revoked_tokens.contains_key(&token_data.claims.jti) {
            return Err(anyhow!("Token has been revoked"));
        }

        Ok(token_data.claims)
    }

    /// Revoke a token by adding its JTI to the revoked list
    pub fn revoke_token(&self, token: &str) -> Result<()> {
        let claims = self.validate_token(token)?;
        
        let mut revoked_tokens = REVOKED_TOKENS.lock()
            .map_err(|e| anyhow!("Failed to access revoked tokens: {}", e))?;
        
        revoked_tokens.insert(claims.jti, claims.exp);
        
        // Clean up expired revoked tokens
        let now = Utc::now().timestamp();
        revoked_tokens.retain(|_, exp| *exp > now);
        
        Ok(())
    }

    /// Check if a user has exceeded rate limits
    pub fn check_rate_limit(&self, user_id: &str, max_requests: u32, window_minutes: i64) -> Result<bool> {
        let mut rate_store = RATE_LIMIT_STORE.lock()
            .map_err(|e| anyhow!("Failed to access rate limit store: {}", e))?;
        
        let now = Utc::now().timestamp();
        let window_start = now - (window_minutes * 60);
        
        match rate_store.get_mut(user_id) {
            Some((last_reset, count)) => {
                if *last_reset < window_start {
                    // Reset window - start fresh
                    *last_reset = now;
                    *count = 1;
                    Ok(true)
                } else {
                    // Within the same window - check before incrementing
                    if *count >= max_requests {
                        Ok(false) // Rate limit exceeded
                    } else {
                        *count += 1;
                        Ok(true)
                    }
                }
            }
            None => {
                // First request for this user
                rate_store.insert(user_id.to_string(), (now, 1));
                Ok(true)
            }
        }
    }

    /// Refresh a token (generate new token with extended expiration)
    pub fn refresh_token(&self, token: &str) -> Result<String> {
        let claims = self.validate_token(token)?;
        
        // Check if token is close to expiration (within 1 hour)
        let now = Utc::now().timestamp();
        let time_until_exp = claims.exp - now;
        
        if time_until_exp > 3600 {
            return Err(anyhow!("Token is not eligible for refresh yet"));
        }
        
        // Revoke old token
        self.revoke_token(token)?;
        
        // Generate new token
        self.generate_token(&claims.sub, &claims.username, &claims.role)
    }

    /// Clean up expired revoked tokens (should be called periodically)
    pub fn cleanup_expired_tokens(&self) -> Result<()> {
        let mut revoked_tokens = REVOKED_TOKENS.lock()
            .map_err(|e| anyhow!("Failed to access revoked tokens: {}", e))?;
        
        let now = Utc::now().timestamp();
        let initial_count = revoked_tokens.len();
        
        revoked_tokens.retain(|_, exp| *exp > now);
        
        let cleaned_count = initial_count - revoked_tokens.len();
        if cleaned_count > 0 {
            println!("Cleaned up {} expired revoked tokens", cleaned_count);
        }
        
        Ok(())
    }

    /// Get token expiration time
    pub fn get_token_expiration(&self, token: &str) -> Result<i64> {
        let claims = self.validate_token(token)?;
        Ok(claims.exp)
    }

    /// Check if token is about to expire (within specified minutes)
    pub fn is_token_expiring_soon(&self, token: &str, minutes: i64) -> Result<bool> {
        let claims = self.validate_token(token)?;
        let now = Utc::now().timestamp();
        let threshold = now + (minutes * 60);
        
        Ok(claims.exp <= threshold)
    }
}

impl Default for JwtManager {
    fn default() -> Self {
        Self::new().expect("Failed to create JWT manager")
    }
}

/// Middleware function to validate JWT tokens in commands
pub fn validate_jwt_middleware(token: &str) -> Result<Claims> {
    let jwt_manager = JwtManager::new()?;
    jwt_manager.validate_token(token)
}

/// Helper function to extract user ID from token
pub fn extract_user_id_from_token(token: &str) -> Result<String> {
    let claims = validate_jwt_middleware(token)?;
    Ok(claims.sub)
}

/// Helper function to check if user has required role
pub fn check_user_role(token: &str, required_role: &str) -> Result<bool> {
    let claims = validate_jwt_middleware(token)?;
    Ok(claims.role == required_role || claims.role == "admin")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jwt_generation_and_validation() {
        let jwt_manager = JwtManager::new().unwrap();
        let token = jwt_manager.generate_token("user123", "testuser", "user").unwrap();
        
        let claims = jwt_manager.validate_token(&token).unwrap();
        assert_eq!(claims.sub, "user123");
        assert_eq!(claims.username, "testuser");
        assert_eq!(claims.role, "user");
    }

    #[test]
    fn test_token_revocation() {
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
    fn test_rate_limiting() {
        let jwt_manager = JwtManager::new().unwrap();
        
        // First request should pass (count becomes 1)
        assert!(jwt_manager.check_rate_limit("user123", 2, 1).unwrap());
        
        // Second request should pass (count becomes 2, at limit)
        assert!(jwt_manager.check_rate_limit("user123", 2, 1).unwrap());
        
        // Third request should fail (count is 2, >= max_requests of 2)
        assert!(!jwt_manager.check_rate_limit("user123", 2, 1).unwrap());
    }
}
