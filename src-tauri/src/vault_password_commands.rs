use crate::state::AppState;
use base64::{Engine, engine::general_purpose};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;
use uuid::Uuid;
use log::info;
use chrono::Utc;

const DEFAULT_USER_ID: &str = "default_user";

#[derive(Debug, Serialize, Deserialize)]
pub struct VaultPasswordInfo {
    pub vault_id: String,
    pub vault_name: String,
    pub password_hint: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveVaultPasswordRequest {
    pub vault_id: String,
    pub vault_name: String,
    pub password: String,
    pub password_hint: Option<String>,
}

#[tauri::command]
pub async fn save_vault_password(
    user_id: String,
    request: SaveVaultPasswordRequest,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("💾 Saving vault password for vault: {} ({})", request.vault_name, request.vault_id);
    let db = &*state.db;
    let crypto = &*state.crypto;
    
    // Encrypt the password
    let encrypted_password = crypto.encrypt(&request.password)
        .map_err(|e| format!("Failed to encrypt password: {}", e))?;
    
    let encrypted_password_b64 = general_purpose::STANDARD.encode(&encrypted_password);
    let now = Utc::now().to_rfc3339();
    
    // Check if password already exists for this vault
    let existing = sqlx::query(
        "SELECT id FROM vault_passwords WHERE user_id = ? AND vault_id = ?"
    )
    .bind(&user_id)
    .bind(&request.vault_id)
    .fetch_optional(db)
    .await
    .map_err(|e| format!("Failed to check existing password: {}", e))?;
    
    if existing.is_some() {
        // Update existing password
        sqlx::query(
            "UPDATE vault_passwords SET encrypted_password = ?, password_hint = ?, updated_at = ? 
             WHERE user_id = ? AND vault_id = ?"
        )
        .bind(&encrypted_password_b64)
        .bind(&request.password_hint)
        .bind(&now)
        .bind(&user_id)
        .bind(&request.vault_id)
        .execute(db)
        .await
        .map_err(|e| format!("Failed to update vault password: {}", e))?;
        
        info!("✅ Updated vault password for vault: {}", request.vault_name);
    } else {
        // Insert new password
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO vault_passwords (id, user_id, vault_id, vault_name, encrypted_password, password_hint, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(&user_id)
        .bind(&request.vault_id)
        .bind(&request.vault_name)
        .bind(&encrypted_password_b64)
        .bind(&request.password_hint)
        .bind(&now)
        .bind(&now)
        .execute(db)
        .await
        .map_err(|e| format!("Failed to save vault password: {}", e))?;
        
        info!("✅ Saved new vault password for vault: {}", request.vault_name);
    }
    
    Ok("Password saved successfully".to_string())
}

#[tauri::command]
pub async fn get_vault_password(
    user_id: String,
    vault_id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("🔍 Retrieving vault password for vault: {}", vault_id);
    let db = &*state.db;
    let crypto = &*state.crypto;
    
    let row = sqlx::query(
        "SELECT encrypted_password FROM vault_passwords WHERE user_id = ? AND vault_id = ?"
    )
    .bind(&user_id)
    .bind(&vault_id)
    .fetch_optional(db)
    .await
    .map_err(|e| format!("Failed to query vault password: {}", e))?;
    
    if let Some(row) = row {
        let encrypted_password_b64: String = row.get("encrypted_password");
        let encrypted_password = general_purpose::STANDARD.decode(&encrypted_password_b64)
            .map_err(|e| format!("Failed to decode encrypted password: {}", e))?;
        
        let decrypted_password = crypto.decrypt(&encrypted_password)
            .map_err(|e| format!("Failed to decrypt password: {}", e))?;
        
        info!("✅ Retrieved vault password for vault: {}", vault_id);
        Ok(decrypted_password)
    } else {
        Err("NO_STORED_PASSWORD".to_string())
    }
}

#[tauri::command]
pub async fn get_user_vault_passwords(
    user_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<VaultPasswordInfo>, String> {
    info!("📋 Retrieving all vault passwords for user: {}", user_id);
    let db = &*state.db;
    
    let rows = sqlx::query(
        "SELECT vault_id, vault_name, password_hint, created_at 
         FROM vault_passwords WHERE user_id = ? ORDER BY created_at DESC"
    )
    .bind(&user_id)
    .fetch_all(db)
    .await
    .map_err(|e| format!("Failed to query vault passwords: {}", e))?;
    
    let mut passwords = Vec::new();
    for row in rows {
        passwords.push(VaultPasswordInfo {
            vault_id: row.get("vault_id"),
            vault_name: row.get("vault_name"),
            password_hint: row.get("password_hint"),
            created_at: row.get("created_at"),
        });
    }
    
    info!("✅ Retrieved {} vault passwords for user: {}", passwords.len(), user_id);
    Ok(passwords)
}

#[tauri::command]
pub async fn delete_vault_password(
    user_id: String,
    vault_id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("🗑️ Deleting vault password for vault: {}", vault_id);
    let db = &*state.db;
    
    let result = sqlx::query(
        "DELETE FROM vault_passwords WHERE user_id = ? AND vault_id = ?"
    )
    .bind(&user_id)
    .bind(&vault_id)
    .execute(db)
    .await
    .map_err(|e| format!("Failed to delete vault password: {}", e))?;
    
    if result.rows_affected() > 0 {
        info!("✅ Deleted vault password for vault: {}", vault_id);
        Ok("Password deleted successfully".to_string())
    } else {
        Err("No password found for this vault".to_string())
    }
}

#[tauri::command]
pub async fn update_vault_password_hint(
    user_id: String,
    vault_id: String,
    hint: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("✏️ Updating password hint for vault: {}", vault_id);
    let db = &*state.db;
    let now = Utc::now().to_rfc3339();
    
    let result = sqlx::query(
        "UPDATE vault_passwords SET password_hint = ?, updated_at = ? 
         WHERE user_id = ? AND vault_id = ?"
    )
    .bind(&hint)
    .bind(&now)
    .bind(&user_id)
    .bind(&vault_id)
    .execute(db)
    .await
    .map_err(|e| format!("Failed to update password hint: {}", e))?;
    
    if result.rows_affected() > 0 {
        info!("✅ Updated password hint for vault: {}", vault_id);
        Ok("Password hint updated successfully".to_string())
    } else {
        Err("No password found for this vault".to_string())
    }
}
