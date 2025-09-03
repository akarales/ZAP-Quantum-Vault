use crate::state::AppState;
use tauri::State;
use uuid::Uuid;
use sqlx::Row;
use serde::{Serialize, Deserialize};
use base64::{Engine as _, engine::general_purpose};

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

/// Get admin user ID from database
async fn get_admin_user_id(pool: &sqlx::SqlitePool) -> Result<String, String> {
    let row = sqlx::query("SELECT id FROM users WHERE username = 'admin' LIMIT 1")
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Failed to get admin user ID: {}", e))?;
    Ok(row.get("id"))
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
    println!("[PASSWORD_CMD] Starting save_usb_drive_password");
    println!("[PASSWORD_CMD] Parameters: user_id={}, drive_id={}, device_path={}, drive_label={:?}", 
             user_id, request.drive_id, request.device_path, request.drive_label);
    println!("[PASSWORD_CMD] Password length: {}, hint: {:?}", request.password.len(), request.password_hint);
    
    let pool = state.db.as_ref();
    
    // Encrypt the password
    println!("[PASSWORD_CMD] Encrypting password...");
    let encrypted_password = match crate::crypto::encrypt_data(&request.password) {
        Ok(encrypted) => {
            println!("[PASSWORD_CMD] ✅ Password encrypted successfully");
            encrypted
        },
        Err(e) => {
            println!("[PASSWORD_CMD] ❌ Failed to encrypt password: {}", e);
            return Err(format!("Failed to encrypt password: {}", e));
        }
    };
    
    let now = chrono::Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();
    println!("[PASSWORD_CMD] Generated ID: {}, timestamp: {}", id, now);
    
    // Insert or update the password
    // Get actual admin user ID from database
    let actual_user_id = match get_admin_user_id(&(*state.db)).await {
        Ok(admin_id) => {
            println!("[PASSWORD_CMD] Using admin user ID: {}", admin_id);
            admin_id
        },
        Err(e) => {
            println!("[PASSWORD_CMD] ❌ Failed to get admin user ID: {}, using provided user_id", e);
            user_id.clone()
        }
    };

    println!("[PASSWORD_CMD] Executing database INSERT OR REPLACE query...");
    let result = match sqlx::query(
        "INSERT OR REPLACE INTO usb_drive_passwords 
         (id, user_id, drive_id, device_path, drive_label, encrypted_password, password_hint, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&actual_user_id)
    .bind(&request.drive_id)
    .bind(&request.device_path)
    .bind(&request.drive_label)
    .bind(&encrypted_password)
    .bind(&request.password_hint)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await {
        Ok(result) => {
            println!("[PASSWORD_CMD] ✅ Database query executed successfully");
            println!("[PASSWORD_CMD] Rows affected: {}", result.rows_affected());
            result
        },
        Err(e) => {
            println!("[PASSWORD_CMD] ❌ Database query failed: {}", e);
            eprintln!("[PASSWORD_CMD] Database error details: {}", e);
            return Err(format!("Failed to save password: {}", e));
        }
    };
    
    if result.rows_affected() > 0 {
        println!("[PASSWORD_CMD] ✅ Password saved successfully for drive {}", request.drive_id);
        Ok("Password saved successfully".to_string())
    } else {
        println!("[PASSWORD_CMD] ❌ No rows affected - password save failed");
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

#[tauri::command]
pub async fn get_all_trusted_drives(
    state: State<'_, AppState>,
    user_id: String,
) -> Result<Vec<TrustedDriveInfo>, String> {
    let pool = state.db.as_ref();
    
    let rows = sqlx::query(
        "SELECT 
            t.drive_id, 
            t.device_path, 
            t.drive_label, 
            t.trust_level, 
            t.created_at, 
            t.updated_at,
            p.password_hint,
            p.last_used as password_last_used
         FROM usb_drive_trust t
         LEFT JOIN usb_drive_passwords p ON t.drive_id = p.drive_id AND t.user_id = p.user_id
         WHERE t.user_id = ? 
         ORDER BY t.updated_at DESC"
    )
    .bind(&user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to retrieve trusted drives: {}", e))?;
    
    let drives: Vec<TrustedDriveInfo> = rows
        .into_iter()
        .map(|row| TrustedDriveInfo {
            drive_id: row.get("drive_id"),
            device_path: row.get("device_path"),
            drive_label: row.get("drive_label"),
            trust_level: row.get("trust_level"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            password_hint: row.get("password_hint"),
            password_last_used: row.get("password_last_used"),
        })
        .collect();
    
    Ok(drives)
}

#[tauri::command]
pub async fn delete_trusted_drive(
    state: State<'_, AppState>,
    user_id: String,
    drive_id: String,
) -> Result<String, String> {
    let pool = state.db.as_ref();
    
    // Start a transaction to delete from both tables
    let mut tx = pool.begin().await.map_err(|e| format!("Failed to start transaction: {}", e))?;
    
    // Delete from trust table
    let trust_result = sqlx::query(
        "DELETE FROM usb_drive_trust WHERE user_id = ? AND drive_id = ?"
    )
    .bind(&user_id)
    .bind(&drive_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to delete trust entry: {}", e))?;
    
    // Delete from passwords table
    let password_result = sqlx::query(
        "DELETE FROM usb_drive_passwords WHERE user_id = ? AND drive_id = ?"
    )
    .bind(&user_id)
    .bind(&drive_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to delete password entry: {}", e))?;
    
    // Commit transaction
    tx.commit().await.map_err(|e| format!("Failed to commit transaction: {}", e))?;
    
    let total_deleted = trust_result.rows_affected() + password_result.rows_affected();
    
    if total_deleted > 0 {
        Ok(format!("Successfully deleted drive entries (removed {} records)", total_deleted))
    } else {
        Err("Drive not found".to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrustedDriveInfo {
    pub drive_id: String,
    pub device_path: String,
    pub drive_label: Option<String>,
    pub trust_level: String,
    pub created_at: String,
    pub updated_at: String,
    pub password_hint: Option<String>,
    pub password_last_used: Option<String>,
}
