use crate::jwt::JwtManager;

#[tauri::command]
pub async fn refresh_token(token: String) -> Result<String, String> {
    let jwt_manager = JwtManager::new().map_err(|e| e.to_string())?;
    jwt_manager.refresh_token(&token).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn logout_user(token: String) -> Result<String, String> {
    let jwt_manager = JwtManager::new().map_err(|e| e.to_string())?;
    jwt_manager.revoke_token(&token).map_err(|e| e.to_string())?;
    Ok("Logged out successfully".to_string())
}

#[tauri::command]
pub async fn validate_session(token: String) -> Result<bool, String> {
    let jwt_manager = JwtManager::new().map_err(|e| e.to_string())?;
    match jwt_manager.validate_token(&token) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn get_token_info(token: String) -> Result<serde_json::Value, String> {
    let jwt_manager = JwtManager::new().map_err(|e| e.to_string())?;
    let claims = jwt_manager.validate_token(&token).map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "user_id": claims.sub,
        "username": claims.username,
        "role": claims.role,
        "expires_at": claims.exp,
        "issued_at": claims.iat,
        "expires_soon": jwt_manager.is_token_expiring_soon(&token, 60).unwrap_or(false)
    }))
}
