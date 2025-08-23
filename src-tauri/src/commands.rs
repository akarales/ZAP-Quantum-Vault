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
    
    sqlx::query("INSERT INTO users (id, username, email, password_hash, salt, is_active, mfa_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&user_id)
        .bind(&request.username)
        .bind(&request.email)
        .bind(&password_hash)
        .bind(&salt)
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
        is_active: true,
        mfa_enabled: false,
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
    let user_row = sqlx::query("SELECT id, username, email, password_hash, salt, is_active, mfa_enabled, created_at, updated_at FROM users WHERE username = ?")
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
                
                let user = User {
                    id: row.get("id"),
                    username: row.get("username"),
                    email: row.get("email"),
                    is_active: row.get("is_active"),
                    mfa_enabled: row.get("mfa_enabled"),
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
pub async fn clear_all_users(state: State<'_, AppState>) -> Result<String, String> {
    let db = &*state.db;
    
    sqlx::query("DELETE FROM users")
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok("All users cleared successfully".to_string())
}
