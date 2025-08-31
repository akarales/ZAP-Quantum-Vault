use crate::state::AppState;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsbDrivePassword {
    pub id: String,
    pub user_id: String,
    pub drive_id: String,
    pub device_path: String,
    pub drive_label: Option<String>,
    pub password_hint: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_used: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavePasswordRequest {
    pub drive_id: String,
    pub device_path: String,
    pub drive_label: Option<String>,
    pub password: String,
    pub password_hint: Option<String>,
}

#[tauri::command]
pub async fn save_usb_drive_password(
    state: State<'_, AppState>,
    user_id: String,
    request: SavePasswordRequest,
) -> Result<String, String> {
    let pool = state.db.as_ref();
    
    // Encrypt the password
    let encrypted_password = crate::crypto::encrypt_data(&request.password)
        .map_err(|e| format!("Failed to encrypt password: {}", e))?;
    
    let now = chrono::Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();
    
    // Insert or update the password
    let result = sqlx::query(
        "INSERT OR REPLACE INTO usb_drive_passwords 
         (id, user_id, drive_id, device_path, drive_label, encrypted_password, password_hint, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&user_id)
    .bind(&request.drive_id)
    .bind(&request.device_path)
    .bind(&request.drive_label)
    .bind(&encrypted_password)
    .bind(&request.password_hint)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to save password: {}", e))?;
    
    if result.rows_affected() > 0 {
        Ok("Password saved successfully".to_string())
    } else {
        Err("Failed to save password".to_string())
    }
}

#[tauri::command]
pub async fn get_usb_drive_password(
    state: State<'_, AppState>,
    user_id: String,
    drive_id: String,
) -> Result<Option<String>, String> {
    let pool = state.db.as_ref();
    
    let row = sqlx::query(
        "SELECT encrypted_password FROM usb_drive_passwords 
         WHERE user_id = ? AND drive_id = ?"
    )
    .bind(&user_id)
    .bind(&drive_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to retrieve password: {}", e))?;
    
    if let Some(row) = row {
        let encrypted_password: String = row.get("encrypted_password");
        
        // Decrypt the password
        let decrypted_password = crate::crypto::decrypt_data(&encrypted_password)
            .map_err(|e| format!("Failed to decrypt password: {}", e))?;
        
        // Update last_used timestamp
        let now = chrono::Utc::now().to_rfc3339();
        let _ = sqlx::query(
            "UPDATE usb_drive_passwords SET last_used = ? WHERE user_id = ? AND drive_id = ?"
        )
        .bind(&now)
        .bind(&user_id)
        .bind(&drive_id)
        .execute(pool)
        .await;
        
        Ok(Some(decrypted_password))
    } else {
        Ok(None)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsbDrivePasswordWithPassword {
    pub id: String,
    pub user_id: String,
    pub drive_id: String,
    pub device_path: String,
    pub drive_label: Option<String>,
    pub password: String,
    pub password_hint: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_used: Option<String>,
}

#[tauri::command]
pub async fn get_user_usb_drive_passwords(
    state: State<'_, AppState>,
    user_id: String,
) -> Result<Vec<UsbDrivePassword>, String> {
    let pool = state.db.as_ref();
    
    let rows = sqlx::query(
        "SELECT id, user_id, drive_id, device_path, drive_label, password_hint, 
         created_at, updated_at, last_used 
         FROM usb_drive_passwords 
         WHERE user_id = ? 
         ORDER BY updated_at DESC"
    )
    .bind(&user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to retrieve passwords: {}", e))?;
    
    let passwords: Vec<UsbDrivePassword> = rows
        .into_iter()
        .map(|row| UsbDrivePassword {
            id: row.get("id"),
            user_id: row.get("user_id"),
            drive_id: row.get("drive_id"),
            device_path: row.get("device_path"),
            drive_label: row.get("drive_label"),
            password_hint: row.get("password_hint"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            last_used: row.get("last_used"),
        })
        .collect();
    
    Ok(passwords)
}

#[tauri::command]
pub async fn get_user_usb_drive_passwords_with_passwords(
    state: State<'_, AppState>,
    user_id: String,
) -> Result<Vec<UsbDrivePasswordWithPassword>, String> {
    let pool = state.db.as_ref();
    
    let rows = sqlx::query(
        "SELECT id, user_id, drive_id, device_path, drive_label, encrypted_password, password_hint, 
         created_at, updated_at, last_used 
         FROM usb_drive_passwords 
         WHERE user_id = ? 
         ORDER BY updated_at DESC"
    )
    .bind(&user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to retrieve passwords: {}", e))?;
    
    let mut passwords_with_decrypted: Vec<UsbDrivePasswordWithPassword> = Vec::new();
    
    for row in rows {
        let encrypted_password: String = row.get("encrypted_password");
        
        // Decrypt the password
        let decrypted_password = crate::crypto::decrypt_data(&encrypted_password)
            .map_err(|e| format!("Failed to decrypt password: {}", e))?;
        
        passwords_with_decrypted.push(UsbDrivePasswordWithPassword {
            id: row.get("id"),
            user_id: row.get("user_id"),
            drive_id: row.get("drive_id"),
            device_path: row.get("device_path"),
            drive_label: row.get("drive_label"),
            password: decrypted_password,
            password_hint: row.get("password_hint"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            last_used: row.get("last_used"),
        });
    }
    
    Ok(passwords_with_decrypted)
}

#[tauri::command]
pub async fn delete_usb_drive_password(
    state: State<'_, AppState>,
    user_id: String,
    drive_id: String,
) -> Result<String, String> {
    let pool = state.db.as_ref();
    
    let result = sqlx::query(
        "DELETE FROM usb_drive_passwords WHERE user_id = ? AND drive_id = ?"
    )
    .bind(&user_id)
    .bind(&drive_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to delete password: {}", e))?;
    
    if result.rows_affected() > 0 {
        Ok("Password deleted successfully".to_string())
    } else {
        Err("Password not found".to_string())
    }
}

#[tauri::command]
pub async fn update_usb_drive_password_hint(
    state: State<'_, AppState>,
    user_id: String,
    drive_id: String,
    password_hint: Option<String>,
) -> Result<String, String> {
    let pool = state.db.as_ref();
    
    let now = chrono::Utc::now().to_rfc3339();
    let result = sqlx::query(
        "UPDATE usb_drive_passwords SET password_hint = ?, updated_at = ? 
         WHERE user_id = ? AND drive_id = ?"
    )
    .bind(&password_hint)
    .bind(&now)
    .bind(&user_id)
    .bind(&drive_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update password hint: {}", e))?;
    
    if result.rows_affected() > 0 {
        Ok("Password hint updated successfully".to_string())
    } else {
        Err("Password not found".to_string())
    }
}
