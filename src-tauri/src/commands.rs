use crate::crypto::{hash_password, verify_password};
use crate::models::{CreateUserRequest, LoginRequest, AuthResponse, User};
use crate::state::AppState;
use chrono::Utc;
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn register_user(
    state: State<'_, AppState>,
    request: CreateUserRequest,
) -> Result<AuthResponse, String> {
    let db = &*state.db;
    
    // Check if username or email already exists
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE username = ? OR email = ?")
        .bind(&request.username)
        .bind(&request.email)
        .fetch_one(db)
        .await
        .map_err(|e| e.to_string())?;
    
    if count > 0 {
        return Err("Username or email already exists".to_string());
    }
    
    // Hash password
    let (password_hash, salt) = hash_password(&request.password)
        .map_err(|e| e.to_string())?;
    
    // Create user
    let user_id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let created_at = now.to_rfc3339();
    let updated_at = created_at.clone();
    
    // Check if this is the first user (admin)
    let user_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(db)
        .await
        .map_err(|e| e.to_string())?;
    
    let role = if user_count == 0 { "admin" } else { "user" };
    
    sqlx::query("INSERT INTO users (id, username, email, password_hash, salt, role, is_active, mfa_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&user_id)
        .bind(&request.username)
        .bind(&request.email)
        .bind(&password_hash)
        .bind(&salt)
        .bind(role)
        .bind(true)
        .bind(false)
        .bind(&created_at)
        .bind(&updated_at)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;
    
    let user = User {
        id: user_id,
        username: request.username,
        email: request.email,
        role: role.to_string(),
        is_active: true,
        mfa_enabled: false,
        last_login: None,
        created_at: now,
        updated_at: now,
    };
    
    Ok(AuthResponse {
        user,
        token: "temp_token".to_string(), // TODO: Implement proper JWT
    })
}

#[tauri::command]
pub async fn login_user(
    state: State<'_, AppState>,
    request: LoginRequest,
) -> Result<AuthResponse, String> {
    let db = &*state.db;
    
    // Find user by username
    let user_row = sqlx::query("SELECT id, username, email, password_hash, salt, role, is_active, mfa_enabled, last_login, created_at, updated_at FROM users WHERE username = ?")
        .bind(&request.username)
        .fetch_optional(db)
        .await
        .map_err(|e| e.to_string())?;
    
    match user_row {
        Some(row) => {
            let password_hash: String = row.get("password_hash");
            let salt: String = row.get("salt");
            
            if verify_password(&request.password, &password_hash, &salt)
                .map_err(|e| e.to_string())? {
                
                // Update last_login
                let now = Utc::now();
                let login_time = now.to_rfc3339();
                sqlx::query("UPDATE users SET last_login = ? WHERE id = ?")
                    .bind(&login_time)
                    .bind(&row.get::<String, _>("id"))
                    .execute(db)
                    .await
                    .map_err(|e| e.to_string())?;
                
                let last_login = match row.get::<Option<String>, _>("last_login") {
                    Some(login_str) => Some(chrono::DateTime::parse_from_rfc3339(&login_str)
                        .map_err(|e| e.to_string())?
                        .with_timezone(&Utc)),
                    None => None,
                };
                
                let user = User {
                    id: row.get("id"),
                    username: row.get("username"),
                    email: row.get("email"),
                    role: row.get("role"),
                    is_active: row.get("is_active"),
                    mfa_enabled: row.get("mfa_enabled"),
                    last_login,
                    created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("created_at"))
                        .map_err(|e| e.to_string())?
                        .with_timezone(&Utc),
                    updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("updated_at"))
                        .map_err(|e| e.to_string())?
                        .with_timezone(&Utc),
                };
                
                Ok(AuthResponse {
                    user,
                    token: "temp_token".to_string(), // TODO: Implement proper JWT
                })
            } else {
                Err("Invalid credentials".to_string())
            }
        }
        None => Err("User not found".to_string()),
    }
}

#[tauri::command]
pub async fn get_user_count(state: State<'_, AppState>) -> Result<i64, String> {
    let db = &*state.db;
    
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(db)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(count)
}

#[tauri::command]
pub async fn get_all_users(state: State<'_, AppState>) -> Result<Vec<User>, String> {
    let db = &*state.db;
    
    let rows = sqlx::query("SELECT id, username, email, role, is_active, mfa_enabled, last_login, created_at, updated_at FROM users ORDER BY created_at ASC")
        .fetch_all(db)
        .await
        .map_err(|e| e.to_string())?;
    
    let mut users = Vec::new();
    for row in rows {
        let last_login = match row.get::<Option<String>, _>("last_login") {
            Some(login_str) => Some(chrono::DateTime::parse_from_rfc3339(&login_str)
                .map_err(|e| e.to_string())?
                .with_timezone(&Utc)),
            None => None,
        };
        
        users.push(User {
            id: row.get("id"),
            username: row.get("username"),
            email: row.get("email"),
            role: row.get("role"),
            is_active: row.get("is_active"),
            mfa_enabled: row.get("mfa_enabled"),
            last_login,
            created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("created_at"))
                .map_err(|e| e.to_string())?
                .with_timezone(&Utc),
            updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("updated_at"))
                .map_err(|e| e.to_string())?
                .with_timezone(&Utc),
        });
    }
    
    Ok(users)
}

#[tauri::command]
pub async fn update_user_role(
    state: State<'_, AppState>,
    user_id: String,
    new_role: String,
) -> Result<String, String> {
    let db = &*state.db;
    
    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE users SET role = ?, updated_at = ? WHERE id = ?")
        .bind(&new_role)
        .bind(&now)
        .bind(&user_id)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok("User role updated successfully".to_string())
}

#[tauri::command]
pub async fn toggle_user_status(
    state: State<'_, AppState>,
    user_id: String,
) -> Result<String, String> {
    let db = &*state.db;
    
    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE users SET is_active = NOT is_active, updated_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&user_id)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok("User status updated successfully".to_string())
}

#[tauri::command]
pub async fn delete_user(
    state: State<'_, AppState>,
    user_id: String,
) -> Result<String, String> {
    let db = &*state.db;
    
    // Don't allow deleting the last admin
    let admin_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE role = 'admin'")
        .fetch_one(db)
        .await
        .map_err(|e| e.to_string())?;
    
    if admin_count <= 1 {
        let user_role: String = sqlx::query_scalar("SELECT role FROM users WHERE id = ?")
            .bind(&user_id)
            .fetch_one(db)
            .await
            .map_err(|e| e.to_string())?;
        
        if user_role == "admin" {
            return Err("Cannot delete the last admin user".to_string());
        }
    }
    
    sqlx::query("DELETE FROM users WHERE id = ?")
        .bind(&user_id)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok("User deleted successfully".to_string())
}

#[tauri::command]
pub async fn clear_all_users(state: State<'_, AppState>) -> Result<String, String> {
    let db = &*state.db;
    
    sqlx::query("DELETE FROM users")
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok("All users cleared successfully".to_string())
}

#[tauri::command]
pub async fn reset_user_password(
    state: State<'_, AppState>,
    user_id: String,
    new_password: String,
) -> Result<String, String> {
    let db = &*state.db;
    
    // Hash the new password
    let (password_hash, salt) = hash_password(&new_password)
        .map_err(|e| e.to_string())?;
    
    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?")
        .bind(&password_hash)
        .bind(&salt)
        .bind(&now)
        .bind(&user_id)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok("Password reset successfully".to_string())
}

#[tauri::command]
pub async fn update_admin_profile(
    state: State<'_, AppState>,
    user_id: String,
    username: Option<String>,
    email: Option<String>,
    current_password: String,
    new_password: Option<String>,
) -> Result<String, String> {
    let db = &*state.db;
    
    // Verify current password first
    let user_row = sqlx::query("SELECT password_hash, salt FROM users WHERE id = ?")
        .bind(&user_id)
        .fetch_one(db)
        .await
        .map_err(|e| e.to_string())?;
    
    let stored_hash: String = user_row.get("password_hash");
    let stored_salt: String = user_row.get("salt");
    
    if !verify_password(&current_password, &stored_hash, &stored_salt)
        .map_err(|e| e.to_string())? {
        return Err("Current password is incorrect".to_string());
    }
    
    let now = Utc::now().to_rfc3339();
    
    // Update username and/or email if provided
    if let Some(new_username) = username {
        sqlx::query("UPDATE users SET username = ?, updated_at = ? WHERE id = ?")
            .bind(&new_username)
            .bind(&now)
            .bind(&user_id)
            .execute(db)
            .await
            .map_err(|e| e.to_string())?;
    }
    
    if let Some(new_email) = email {
        sqlx::query("UPDATE users SET email = ?, updated_at = ? WHERE id = ?")
            .bind(&new_email)
            .bind(&now)
            .bind(&user_id)
            .execute(db)
            .await
            .map_err(|e| e.to_string())?;
    }
    
    // Update password if provided
    if let Some(new_pass) = new_password {
        let (password_hash, salt) = hash_password(&new_pass)
            .map_err(|e| e.to_string())?;
        
        sqlx::query("UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?")
            .bind(&password_hash)
            .bind(&salt)
            .bind(&now)
            .bind(&user_id)
            .execute(db)
            .await
            .map_err(|e| e.to_string())?;
    }
    
    Ok("Profile updated successfully".to_string())
}
