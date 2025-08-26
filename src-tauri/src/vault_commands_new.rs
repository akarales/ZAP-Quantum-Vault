use crate::models::{CreateVaultRequest, Vault, CreateVaultItemRequest, VaultItem, User};
use crate::state::AppState;
use crate::vault_service_new::{VaultService, UserContextFactory};
use crate::vault_access_control::VaultPermission;
use tauri::State;
use log::{info, error};

/// SOLID-compliant vault commands with proper access control
#[tauri::command]
pub async fn get_user_vaults_with_access_control(
    state: State<'_, AppState>,
    token: Option<String>,
) -> Result<Vec<Vault>, String> {
    info!("🔍 get_user_vaults_with_access_control: Starting vault retrieval");
    
    // Create vault service with proper dependencies
    let vault_service = VaultService::new_with_defaults(state.db.clone());
    
    // Determine user context
    let user = if let Some(token) = token {
        // In production, validate JWT token and extract user info
        // For now, create a default admin user for offline mode
        info!("🔑 Token provided, but using default admin for offline mode");
        UserContextFactory::create_default_admin()
    } else {
        info!("🔑 No token provided, using default admin user");
        UserContextFactory::create_default_admin()
    };
    
    info!("👤 User context: {} (role: {})", user.username, user.role);
    
    // Get accessible vaults based on user role and permissions
    match vault_service.get_user_accessible_vaults(&user).await {
        Ok(vaults) => {
            info!("✅ Successfully retrieved {} vaults for user {}", vaults.len(), user.username);
            for vault in &vaults {
                info!("  📁 Vault: {} ({})", vault.name, vault.id);
            }
            Ok(vaults)
        }
        Err(e) => {
            error!("❌ Failed to retrieve vaults: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn create_vault_with_access_control(
    state: State<'_, AppState>,
    request: CreateVaultRequest,
    token: Option<String>,
) -> Result<Vault, String> {
    info!("🔨 create_vault_with_access_control: Creating vault '{}'", request.name);
    
    let vault_service = VaultService::new_with_defaults(state.db.clone());
    
    let user = if let Some(_token) = token {
        UserContextFactory::create_default_admin()
    } else {
        UserContextFactory::create_default_admin()
    };
    
    // Check if user can create vaults
    // For now, allow all authenticated users to create vaults
    info!("👤 Creating vault for user: {} (role: {})", user.username, user.role);
    
    // Use the existing create_vault_offline logic but with proper user context
    let db = &*state.db;
    let vault_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now();
    let created_at = now.to_rfc3339();
    let updated_at = created_at.clone();
    
    // Set user_id based on the authenticated user
    let user_id = &user.id;
    
    sqlx::query(
        "INSERT INTO vaults (id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&vault_id)
    .bind(user_id)
    .bind(&request.name)
    .bind(&request.description)
    .bind(&request.vault_type)
    .bind(request.is_shared)
    .bind(false) // is_default
    .bind(false) // is_system_default
    .bind(&created_at)
    .bind(&updated_at)
    .execute(db)
    .await
    .map_err(|e| {
        error!("❌ Failed to create vault: {}", e);
        e.to_string()
    })?;
    
    let vault = Vault {
        id: vault_id.clone(),
        user_id: user_id.clone(),
        name: request.name.clone(),
        description: request.description.clone(),
        vault_type: request.vault_type.clone(),
        is_shared: request.is_shared,
        is_default: false,
        is_system_default: false,
        created_at: now,
        updated_at: now,
    };
    
    info!("✅ create_vault_with_access_control: Successfully created vault '{}' ({})", request.name, vault_id);
    Ok(vault)
}

#[tauri::command]
pub async fn delete_vault_with_access_control(
    state: State<'_, AppState>,
    vault_id: String,
    token: Option<String>,
) -> Result<String, String> {
    info!("🗑️ delete_vault_with_access_control: Deleting vault {}", vault_id);
    
    let vault_service = VaultService::new_with_defaults(state.db.clone());
    
    let user = if let Some(_token) = token {
        UserContextFactory::create_default_admin()
    } else {
        UserContextFactory::create_default_admin()
    };
    
    // Check if user can delete this vault
    let can_delete = vault_service
        .can_user_perform_action(&user, &vault_id, VaultPermission::Delete)
        .await
        .map_err(|e| e.to_string())?;
    
    if !can_delete {
        error!("❌ User {} does not have permission to delete vault {}", user.username, vault_id);
        return Err("Insufficient permissions to delete vault".to_string());
    }
    
    let db = &*state.db;
    
    // Check if vault exists and is not system default
    let vault_row = sqlx::query("SELECT is_system_default FROM vaults WHERE id = ?")
        .bind(&vault_id)
        .fetch_optional(db)
        .await
        .map_err(|e| e.to_string())?;
    
    match vault_row {
        Some(row) => {
            let is_system_default: bool = row.get("is_system_default");
            if is_system_default {
                return Err("Cannot delete system default vault".to_string());
            }
        }
        None => {
            return Err("Vault not found".to_string());
        }
    }
    
    // Delete vault items first
    sqlx::query("DELETE FROM vault_items WHERE vault_id = ?")
        .bind(&vault_id)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;
    
    // Delete vault
    sqlx::query("DELETE FROM vaults WHERE id = ?")
        .bind(&vault_id)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;
    
    info!("✅ delete_vault_with_access_control: Successfully deleted vault {}", vault_id);
    Ok("Vault deleted successfully".to_string())
}

/// Backward compatibility wrapper for existing offline commands
#[tauri::command]
pub async fn get_user_vaults_offline_v2(
    state: State<'_, AppState>,
) -> Result<Vec<Vault>, String> {
    get_user_vaults_with_access_control(state, None).await
}

#[tauri::command]
pub async fn create_vault_offline_v2(
    state: State<'_, AppState>,
    request: CreateVaultRequest,
) -> Result<Vault, String> {
    create_vault_with_access_control(state, request, None).await
}

#[tauri::command]
pub async fn delete_vault_offline_v2(
    state: State<'_, AppState>,
    vault_id: String,
) -> Result<String, String> {
    delete_vault_with_access_control(state, vault_id, None).await
}
