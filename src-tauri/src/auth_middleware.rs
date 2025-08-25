use crate::jwt::validate_jwt_middleware;
use anyhow::{anyhow, Result};

/// Middleware to validate JWT tokens and extract user information
pub fn require_auth(token: &str) -> Result<String> {
    let claims = validate_jwt_middleware(token)?;
    Ok(claims.sub)
}

/// Middleware to require admin role
pub fn require_admin(token: &str) -> Result<String> {
    let claims = validate_jwt_middleware(token)?;
    if claims.role != "admin" {
        return Err(anyhow!("Admin access required"));
    }
    Ok(claims.sub)
}

/// Middleware to require user to be active
pub fn require_active_user(token: &str) -> Result<String> {
    let claims = validate_jwt_middleware(token)?;
    // In a full implementation, you'd check the database for user status
    // For now, we assume all JWT holders are active
    Ok(claims.sub)
}

/// Extract user ID from token without full validation (for logging purposes)
pub fn extract_user_id_safe(token: &str) -> Option<String> {
    match validate_jwt_middleware(token) {
        Ok(claims) => Some(claims.sub),
        Err(_) => None,
    }
}
