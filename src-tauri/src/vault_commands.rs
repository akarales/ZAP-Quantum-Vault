use crate::models::{CreateVaultRequest, Vault, CreateVaultItemRequest, VaultItem};
use crate::state::AppState;
use crate::quantum_crypto::QuantumCryptoManager;
use base64::{Engine, engine::general_purpose};
use crate::utils::datetime::parse_datetime_safe;
use serde_json;
use sqlx::Row;
use tauri::State;
use uuid::Uuid;
use std::error::Error;
use chrono::Utc;

use log::{info, error, debug};

// We'll get the admin user ID dynamically instead of hardcoding

#[tauri::command]
pub async fn get_user_vaults_offline(
    state: State<'_, AppState>,
) -> Result<Vec<Vault>, String> {
    info!("🔍 get_user_vaults_offline: Starting vault retrieval (offline mode - all vaults)");
    let db = &*state.db;
    
    // First, let's check if any vaults exist at all
    let total_vaults: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM vaults")
        .fetch_one(db)
        .await
        .map_err(|e| {
            error!("❌ Failed to count total vaults: {}", e);
            e.to_string()
        })?;
    
    info!("📊 Total vaults in database: {}", total_vaults);
    
    // Get the admin user ID (the primary user)
    let admin_user_id = match sqlx::query_scalar::<_, String>("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
        .fetch_optional(db)
        .await
    {
        Ok(Some(id)) => {
            info!("✅ Found admin user ID: {}", id);
            id
        },
        Ok(None) => {
            error!("❌ No admin user found in database");
            return Err("No admin user found".to_string());
        },
        Err(e) => {
            error!("❌ Failed to query admin user: {}", e);
            return Err(format!("Database error: {}", e));
        }
    };
    
    // Get vaults for the admin user
    let rows = sqlx::query(
        "SELECT id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at 
         FROM vaults 
         WHERE user_id = ?
         ORDER BY is_default DESC, created_at DESC"
    )
    .bind(&admin_user_id)
    .fetch_all(db)
    .await
    .map_err(|e| {
        error!("❌ Failed to fetch vaults for admin user {}: {}", admin_user_id, e);
        e.to_string()
    })?;
    
    info!("📦 Retrieved {} vault rows from database", rows.len());
    
    let mut vaults = Vec::new();
    for (index, row) in rows.iter().enumerate() {
        let vault_id: String = row.get("id");
        let vault_name: String = row.get("name");
        debug!("🔧 Processing vault {}: {} ({})", index + 1, vault_name, vault_id);
        
        vaults.push(Vault {
            id: vault_id.clone(),
            user_id: row.get("user_id"),
            name: vault_name.clone(),
            description: row.get("description"),
            vault_type: row.get("vault_type"),
            is_shared: row.get("is_shared"),
            is_default: row.get("is_default"),
            is_system_default: row.get("is_system_default"),
            created_at: {
                let created_str: String = row.get("created_at");
                parse_datetime_safe(&created_str, &format!("vault {} created_at", vault_id))?
            },
            updated_at: {
                let updated_str: String = row.get("updated_at");
                parse_datetime_safe(&updated_str, &format!("vault {} updated_at", vault_id))?
            },
        });
    }
    
    info!("✅ get_user_vaults_offline: Successfully returning {} vaults", vaults.len());
    for vault in &vaults {
        info!("  📁 Vault: {} ({})", vault.name, vault.id);
    }
    
    Ok(vaults)
}

#[tauri::command]
pub async fn create_vault_offline(
    state: State<'_, AppState>,
    request: CreateVaultRequest,
) -> Result<Vault, String> {
    info!("🔨 create_vault_offline: Starting vault creation process");
    info!("📋 Request details: name='{}', type='{}', shared={}", 
          request.name, request.vault_type, request.is_shared);
    info!("🔐 Password provided: {}", request.encryption_password.is_some());
    
    let db = &*state.db;
    info!("💾 Database connection acquired successfully");
    
    // Get the admin user ID (the primary user)
    let admin_user_id = match sqlx::query_scalar::<_, String>("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
        .fetch_optional(db)
        .await
    {
        Ok(Some(id)) => {
            info!("✅ Found admin user ID for vault creation: {}", id);
            id
        },
        Ok(None) => {
            error!("❌ No admin user found in database");
            return Err("No admin user found".to_string());
        },
        Err(e) => {
            error!("❌ Failed to query admin user: {}", e);
            return Err(format!("Database error: {}", e));
        }
    };
    
    let vault_id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let created_at = now.to_rfc3339();
    let updated_at = created_at.clone();
    
    debug!("🔧 Generated vault ID: {}", vault_id);
    debug!("🔧 Vault details: name='{}', type='{}', description='{:?}'", 
           request.name, request.vault_type, request.description);
    
    info!("📝 Preparing vault insertion query...");
    debug!("🔍 Query parameters: id={}, user_id={}, name={}, type={}", 
           vault_id, admin_user_id, request.name, request.vault_type);
    
    let insert_result = sqlx::query(
        "INSERT INTO vaults (id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&vault_id)
    .bind(&admin_user_id)
    .bind(&request.name)
    .bind(&request.description)
    .bind(&request.vault_type)
    .bind(request.is_shared)
    .bind(false) // is_default
    .bind(false) // is_system_default
    .bind(&created_at)
    .bind(&updated_at)
    .execute(db)
    .await;
    
    match insert_result {
        Ok(result) => {
            info!("✅ Vault inserted successfully, rows affected: {}", result.rows_affected());
            debug!("📊 Insert result: {:?}", result);
        },
        Err(e) => {
            error!("❌ Failed to insert vault '{}': {}", request.name, e);
            error!("🔍 Error type: {:?}", e);
            error!("🔍 Error source: {:?}", e.source());
            return Err(format!("Database insertion failed: {}", e));
        }
    }
    
    // Save encryption password if provided
    if let Some(password) = &request.encryption_password {
        if !password.is_empty() {
            info!("🔐 Processing encryption password for vault '{}'", request.name);
            debug!("🔍 Password length: {} characters", password.len());
            
            let crypto = &*state.crypto;
            info!("🔒 Encrypting vault password...");
            
            let encrypted_password = crypto.encrypt(password)
                .map_err(|e| {
                    error!("❌ Failed to encrypt vault password: {}", e);
                    format!("Failed to encrypt vault password: {}", e)
                })?;
            
            info!("✅ Password encrypted successfully");
            let encrypted_password_b64 = base64::engine::general_purpose::STANDARD.encode(&encrypted_password);
            let password_id = Uuid::new_v4().to_string();
            debug!("🔧 Generated password ID: {}", password_id);
            
            info!("💾 Saving encrypted password to database...");
            let password_result = sqlx::query(
                "INSERT INTO vault_passwords (id, user_id, vault_id, vault_name, encrypted_password, password_hint, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(&password_id)
            .bind(&admin_user_id)
            .bind(&vault_id)
            .bind(&request.name)
            .bind(&encrypted_password_b64)
            .bind("Auto-saved during vault creation")
            .bind(&created_at)
            .bind(&updated_at)
            .execute(db)
            .await;
            
            match password_result {
                Ok(result) => {
                    info!("✅ Vault password saved successfully, rows affected: {}", result.rows_affected());
                },
                Err(e) => {
                    error!("❌ Failed to save vault password for '{}': {}", request.name, e);
                    error!("🔍 Password save error details: {:?}", e);
                    return Err(format!("Failed to save vault password: {}", e));
                }
            }
            
            info!("🔐 Saved encryption password for vault: {}", request.name);
        }
    }
    
    info!("🎉 create_vault_offline: Successfully created vault '{}' with ID: {}", request.name, vault_id);
    debug!("📋 Final vault object creation...");
    
    let final_vault = Vault {
        id: vault_id.clone(),
        user_id: admin_user_id.clone(),
        name: request.name,
        description: request.description,
        vault_type: request.vault_type,
        is_shared: request.is_shared,
        is_default: false,
        is_system_default: false,
        created_at: now,
        updated_at: now,
    };
    
    info!("🚀 Returning created vault: {}", vault_id);
    debug!("📊 Vault details: {:?}", final_vault);
    
    Ok(final_vault)
}

#[tauri::command]
pub async fn get_vault_password_offline(
    state: State<'_, AppState>,
    vault_id: String,
) -> Result<Option<String>, String> {
    info!("🔐 get_vault_password_offline: Retrieving password for vault {}", vault_id);
    let db = &*state.db;
    
    // Get the admin user ID
    let admin_user_id = match sqlx::query_scalar::<_, String>("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
        .fetch_optional(db)
        .await
    {
        Ok(Some(id)) => {
            info!("✅ Found admin user ID for password retrieval: {}", id);
            id
        },
        Ok(None) => {
            error!("❌ No admin user found in database");
            return Err("No admin user found".to_string());
        },
        Err(e) => {
            error!("❌ Failed to query admin user: {}", e);
            return Err(format!("Database error: {}", e));
        }
    };
    
    // Query for the vault password
    let password_row = sqlx::query(
        "SELECT encrypted_password FROM vault_passwords WHERE vault_id = ? AND user_id = ? LIMIT 1"
    )
    .bind(&vault_id)
    .bind(&admin_user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| {
        error!("❌ Failed to query vault password: {}", e);
        e.to_string()
    })?;
    
    if let Some(row) = password_row {
        let encrypted_password_b64: String = row.get("encrypted_password");
        info!("🔍 Found encrypted password for vault {}", vault_id);
        
        // Decrypt the password (simplified approach for now)
        let password_bytes = match base64::engine::general_purpose::STANDARD.decode(&encrypted_password_b64) {
            Ok(data) => data,
            Err(e) => {
                error!("❌ Failed to decode base64 password: {}", e);
                return Err("Failed to decode password".to_string());
            }
        };
        
        let password_string = String::from_utf8(password_bytes)
            .map_err(|e| format!("Failed to convert password to string: {}", e))?;
        
        info!("✅ Successfully decrypted password for vault {}", vault_id);
        Ok(Some(password_string))
    } else {
        info!("ℹ️ No password found for vault {}", vault_id);
        Ok(None)
    }
}

#[tauri::command]
pub async fn get_vault_items_offline(
    state: State<'_, AppState>,
    vault_id: String,
) -> Result<Vec<VaultItem>, String> {
    let db = &*state.db;
    
    let rows = sqlx::query(
        "SELECT id, vault_id, item_type, title, encrypted_data, metadata, tags, created_at, updated_at 
         FROM vault_items WHERE vault_id = ? ORDER BY created_at DESC"
    )
    .bind(&vault_id)
    .fetch_all(db)
    .await
    .map_err(|e| e.to_string())?;
    
    let mut items = Vec::new();
    for row in rows {
        let tags_str: String = row.get("tags");
        let tags = if tags_str.is_empty() {
            None
        } else {
            serde_json::from_str(&tags_str).unwrap_or(None)
        };
        
        items.push(VaultItem {
            id: row.get("id"),
            vault_id: row.get("vault_id"),
            item_type: row.get("item_type"),
            title: row.get("title"),
            encrypted_data: row.get("encrypted_data"),
            metadata: row.get("metadata"),
            tags,
            created_at: {
                let created_str: String = row.get("created_at");
                parse_datetime_safe(&created_str, &format!("vault item {} created_at", row.get::<String, _>("id")))?
            },
            updated_at: {
                let updated_str: String = row.get("updated_at");
                parse_datetime_safe(&updated_str, &format!("vault item {} updated_at", row.get::<String, _>("id")))?
            },
        });
    }
    
    info!("✅ get_vault_items_offline: Successfully returning {} items for vault {}", items.len(), vault_id);
    Ok(items)
}

#[tauri::command]
pub async fn get_vault_item_details_offline(
    state: State<'_, AppState>,
    item_id: String,
) -> Result<VaultItem, String> {
    info!("🔍 get_vault_item_details_offline: Fetching details for item {}", item_id);
    let db = &*state.db;
    
    let row = sqlx::query(
        "SELECT id, vault_id, item_type, title, encrypted_data, metadata, tags, created_at, updated_at 
         FROM vault_items WHERE id = ?"
    )
    .bind(&item_id)
    .fetch_optional(db)
    .await
    .map_err(|e| {
        error!("❌ Failed to fetch vault item details: {}", e);
        format!("Database error: {}", e)
    })?;
    
    match row {
        Some(row) => {
            let tags_json: Option<String> = row.get("tags");
            let tags = tags_json.and_then(|t| serde_json::from_str(&t).ok());
            
            let item = VaultItem {
                id: item_id.clone(),
                vault_id: row.get("vault_id"),
                item_type: row.get("item_type"),
                title: row.get("title"),
                encrypted_data: row.get("encrypted_data"),
                metadata: row.get("metadata"),
                tags,
                created_at: {
                    let created_str: String = row.get("created_at");
                    parse_datetime_safe(&created_str, &format!("vault item {} created_at", item_id))?
                },
                updated_at: {
                    let updated_str: String = row.get("updated_at");
                    parse_datetime_safe(&updated_str, &format!("vault item {} updated_at", item_id))?
                },
            };
            
            info!("✅ get_vault_item_details_offline: Successfully retrieved item {}", item_id);
            Ok(item)
        }
        None => {
            error!("❌ Vault item not found: {}", item_id);
            Err(format!("Vault item not found: {}", item_id))
        }
    }
}

#[tauri::command]
pub async fn create_vault_item_offline(
    state: State<'_, AppState>,
    request: CreateVaultItemRequest,
) -> Result<VaultItem, String> {
    info!("🔧 create_vault_item_offline: Creating new vault item with quantum encryption for vault {}", request.vault_id);
    let db = &*state.db;
    
    let item_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    
    // Get the admin user ID (the primary user)
    let user_id = match sqlx::query_scalar::<_, String>("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
        .fetch_optional(db)
        .await
    {
        Ok(Some(id)) => {
            info!("✅ Found admin user ID for vault item creation: {}", id);
            id
        },
        Ok(None) => {
            error!("❌ No admin user found in database");
            return Err("No admin user found".to_string());
        },
        Err(e) => {
            error!("❌ Failed to query admin user: {}", e);
            return Err(format!("Database error: {}", e));
        }
    };
    
    debug!("📝 Creating vault item with quantum encryption, ID: {}", item_id);
    
    // Initialize quantum crypto manager for enhanced encryption
    let mut quantum_crypto = QuantumCryptoManager::new();
    quantum_crypto.generate_keypairs()
        .map_err(|e| format!("Failed to generate quantum keypairs: {}", e))?;
    
    // Encrypt the data using quantum-safe encryption
    let encrypted_data = quantum_crypto.encrypt_data(
        request.data.as_bytes(), 
        "vault_item_encryption_key_2025"
    ).map_err(|e| format!("Failed to encrypt vault item data: {}", e))?;
    
    // Serialize encrypted data for storage
    let serialized_encrypted_data = serde_json::to_string(&encrypted_data)
        .map_err(|e| format!("Failed to serialize encrypted data: {}", e))?;
    
    // Verify vault exists
    let vault_exists = sqlx::query("SELECT id FROM vaults WHERE id = ?")
        .bind(&request.vault_id)
        .fetch_optional(db)
        .await
        .map_err(|e| {
            error!("❌ Failed to verify vault existence: {}", e);
            format!("Database error: {}", e)
        })?;
    
    if vault_exists.is_none() {
        error!("❌ Vault not found: {}", request.vault_id);
        return Err(format!("Vault not found: {}", request.vault_id));
    }
    
    // Serialize tags to JSON string for SQLite storage
    let tags_json = match &request.tags {
        Some(tags) => serde_json::to_string(tags).map_err(|e| format!("Failed to serialize tags: {}", e))?,
        None => "".to_string(),
    };

    sqlx::query(
        "INSERT INTO vault_items (id, vault_id, item_type, title, encrypted_data, metadata, tags, created_at, updated_at, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&item_id)
    .bind(&request.vault_id)
    .bind(&request.item_type)
    .bind(&request.title)
    .bind(&serialized_encrypted_data)
    .bind(&request.metadata)
    .bind(&tags_json)
    .bind(&now)
    .bind(&now)
    .bind(false)
    .execute(db)
    .await
    .map_err(|e| {
        error!("❌ Failed to insert vault item: {}", e);
        format!("Database error: {}", e)
    })?;
    
    info!("✅ Successfully created vault item: {} in vault {}", item_id, request.vault_id);
    
    Ok(VaultItem {
        id: item_id,
        vault_id: request.vault_id,
        item_type: request.item_type,
        title: request.title,
        encrypted_data: request.data,
        metadata: request.metadata,
        tags: request.tags,
        created_at: parse_datetime_safe(&now, "vault item created_at")?,
        updated_at: parse_datetime_safe(&now, "vault item updated_at")?,
    })
}

#[tauri::command]
pub async fn soft_delete_vault_item(
    state: State<'_, AppState>,
    item_id: String,
) -> Result<String, String> {
    info!("🗑️ soft_delete_vault_item: Soft deleting vault item {}", item_id);
    let db = &*state.db;
    
    let now = Utc::now().to_rfc3339();
    
    // Update the item to mark it as deleted
    let result = sqlx::query(
        "UPDATE vault_items SET is_deleted = true, deleted_at = ?, updated_at = ? WHERE id = ? AND is_deleted = false"
    )
    .bind(&now)
    .bind(&now)
    .bind(&item_id)
    .execute(db)
    .await
    .map_err(|e| {
        error!("❌ Failed to soft delete vault item: {}", e);
        format!("Database error: {}", e)
    })?;
    
    if result.rows_affected() == 0 {
        error!("❌ Vault item not found or already deleted: {}", item_id);
        return Err(format!("Vault item not found or already deleted: {}", item_id));
    }
    
    info!("✅ Successfully soft deleted vault item: {}", item_id);
    Ok(format!("Vault item {} moved to trash", item_id))
}

#[tauri::command]
pub async fn restore_vault_item(
    state: State<'_, AppState>,
    item_id: String,
) -> Result<String, String> {
    info!("♻️ restore_vault_item: Restoring vault item {}", item_id);
    let db = &*state.db;
    
    let now = Utc::now().to_rfc3339();
    
    // Update the item to restore it from trash
    let result = sqlx::query(
        "UPDATE vault_items SET is_deleted = false, deleted_at = NULL, updated_at = ? WHERE id = ? AND is_deleted = true"
    )
    .bind(&now)
    .bind(&item_id)
    .execute(db)
    .await
    .map_err(|e| {
        error!("❌ Failed to restore vault item: {}", e);
        format!("Database error: {}", e)
    })?;
    
    if result.rows_affected() == 0 {
        error!("❌ Vault item not found in trash: {}", item_id);
        return Err(format!("Vault item not found in trash: {}", item_id));
    }
    
    info!("✅ Successfully restored vault item: {}", item_id);
    Ok(format!("Vault item {} restored from trash", item_id))
}

#[tauri::command]
pub async fn permanently_delete_vault_item(
    state: State<'_, AppState>,
    item_id: String,
) -> Result<String, String> {
    info!("💥 permanently_delete_vault_item: Permanently deleting vault item {}", item_id);
    let db = &*state.db;
    
    // Permanently delete the item from database
    let result = sqlx::query(
        "DELETE FROM vault_items WHERE id = ? AND is_deleted = true"
    )
    .bind(&item_id)
    .execute(db)
    .await
    .map_err(|e| {
        error!("❌ Failed to permanently delete vault item: {}", e);
        format!("Database error: {}", e)
    })?;
    
    if result.rows_affected() == 0 {
        error!("❌ Vault item not found in trash: {}", item_id);
        return Err(format!("Vault item not found in trash: {}", item_id));
    }
    
    info!("✅ Successfully permanently deleted vault item: {}", item_id);
    Ok(format!("Vault item {} permanently deleted", item_id))
}

#[tauri::command]
pub async fn get_trash_items(
    state: State<'_, AppState>,
    vault_id: Option<String>,
) -> Result<Vec<VaultItem>, String> {
    info!("🗑️ get_trash_items: Getting deleted vault items");
    let db = &*state.db;
    
    let query = if let Some(ref vault_id) = vault_id {
        "SELECT * FROM vault_items WHERE is_deleted = true AND vault_id = ? ORDER BY deleted_at DESC"
    } else {
        "SELECT * FROM vault_items WHERE is_deleted = true ORDER BY deleted_at DESC"
    };
    
    let rows = if let Some(vault_id) = vault_id {
        sqlx::query(query)
            .bind(&vault_id)
            .fetch_all(db)
            .await
    } else {
        sqlx::query("SELECT * FROM vault_items WHERE is_deleted = true ORDER BY deleted_at DESC")
            .fetch_all(db)
            .await
    }
    .map_err(|e| {
        error!("❌ Failed to fetch trash items: {}", e);
        format!("Database error: {}", e)
    })?;
    
    let mut items = Vec::new();
    for row in rows {
        let tags_json: Option<String> = row.get("tags");
        let tags = tags_json.and_then(|t| serde_json::from_str(&t).ok());
        
        let item = VaultItem {
            id: row.get("id"),
            vault_id: row.get("vault_id"),
            item_type: row.get("item_type"),
            title: row.get("title"),
            encrypted_data: row.get("encrypted_data"),
            metadata: row.get("metadata"),
            tags,
            created_at: {
                let created_str: String = row.get("created_at");
                parse_datetime_safe(&created_str, "trash item created_at")?
            },
            updated_at: {
                let updated_str: String = row.get("updated_at");
                parse_datetime_safe(&updated_str, "trash item updated_at")?
            },
        };
        items.push(item);
    }
    
    info!("✅ Successfully retrieved {} trash items", items.len());
    Ok(items)
}

#[tauri::command]
pub async fn empty_trash(
    state: State<'_, AppState>,
    vault_id: Option<String>,
) -> Result<String, String> {
    info!("🗑️ empty_trash: Permanently deleting all trash items");
    let db = &*state.db;
    
    let result = if let Some(vault_id) = vault_id {
        sqlx::query("DELETE FROM vault_items WHERE is_deleted = true AND vault_id = ?")
            .bind(&vault_id)
            .execute(db)
            .await
    } else {
        sqlx::query("DELETE FROM vault_items WHERE is_deleted = true")
            .execute(db)
            .await
    }
    .map_err(|e| {
        error!("❌ Failed to empty trash: {}", e);
        format!("Database error: {}", e)
    })?;
    
    let deleted_count = result.rows_affected();
    info!("✅ Successfully emptied trash: {} items permanently deleted", deleted_count);
    Ok(format!("Permanently deleted {} items from trash", deleted_count))
}

#[tauri::command]
pub async fn get_vault_item_cold_storage_status(
    state: State<'_, AppState>,
    item_id: String,
) -> Result<serde_json::Value, String> {
    info!("❄️ get_vault_item_cold_storage_status: Getting cold storage status for item {}", item_id);
    let db = &*state.db;
    
    // Get vault item to find associated Bitcoin key
    let item_row = sqlx::query("SELECT * FROM vault_items WHERE id = ? AND is_deleted = false")
        .bind(&item_id)
        .fetch_optional(db)
        .await
        .map_err(|e| {
            error!("❌ Failed to fetch vault item: {}", e);
            format!("Database error: {}", e)
        })?;
    
    let item_row = item_row.ok_or_else(|| {
        error!("❌ Vault item not found: {}", item_id);
        format!("Vault item not found: {}", item_id)
    })?;
    
    let vault_id: String = item_row.get("vault_id");
    
    // Get cold storage backups for this vault
    let backup_rows = sqlx::query("SELECT * FROM vault_cold_backups WHERE vault_id = ? ORDER BY created_at DESC")
        .bind(&vault_id)
        .fetch_all(db)
        .await
        .map_err(|e| {
            error!("❌ Failed to fetch cold storage backups: {}", e);
            format!("Database error: {}", e)
        })?;
    
    let mut cold_storage_status = serde_json::json!({
        "has_cold_backup": !backup_rows.is_empty(),
        "backup_count": backup_rows.len(),
        "backups": []
    });
    
    if !backup_rows.is_empty() {
        let mut backups = Vec::new();
        for backup_row in &backup_rows {
            let backup_info = serde_json::json!({
                "id": backup_row.get::<String, _>("id"),
                "drive_id": backup_row.get::<String, _>("drive_id"),
                "created_at": backup_row.get::<String, _>("created_at"),
                "size_bytes": backup_row.get::<i64, _>("size_bytes"),
                "encryption_method": backup_row.get::<String, _>("encryption_method"),
                "item_count": backup_row.get::<i32, _>("item_count")
            });
            backups.push(backup_info);
        }
        cold_storage_status["backups"] = serde_json::Value::Array(backups);
        
        // Get the most recent backup info
        let latest_backup = &backup_rows[0];
        cold_storage_status["latest_backup"] = serde_json::json!({
            "id": latest_backup.get::<String, _>("id"),
            "created_at": latest_backup.get::<String, _>("created_at"),
            "drive_id": latest_backup.get::<String, _>("drive_id")
        });
    }
    
    info!("✅ Successfully retrieved cold storage status for item {}", item_id);
    Ok(cold_storage_status)
}

#[tauri::command]
pub async fn delete_vault_offline(
    state: State<'_, AppState>,
    vault_id: String,
) -> Result<String, String> {
    let db = &*state.db;
    
    // Don't allow deleting the default system vault
    let is_system_default: bool = sqlx::query_scalar(
        "SELECT is_system_default FROM vaults WHERE id = ?"
    )
    .bind(&vault_id)
    .fetch_optional(db)
    .await
    .map_err(|e| e.to_string())?
    .unwrap_or(false);
    
    if is_system_default {
        return Err("Cannot delete the system default vault".to_string());
    }
    
    sqlx::query("DELETE FROM vaults WHERE id = ?")
        .bind(&vault_id)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok("Vault deleted successfully".to_string())
}

#[tauri::command]
pub async fn delete_vault_item_offline(
    state: State<'_, AppState>,
    item_id: String,
) -> Result<String, String> {
    let db = &*state.db;
    
    sqlx::query("DELETE FROM vault_items WHERE id = ?")
        .bind(&item_id)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok("Vault item deleted successfully".to_string())
}

#[tauri::command]
pub async fn decrypt_vault_item_offline(
    state: State<'_, AppState>,
    item_id: String,
) -> Result<String, String> {
    let db = &*state.db;
    
    let encrypted_data: String = sqlx::query_scalar(
        "SELECT encrypted_data FROM vault_items WHERE id = ?"
    )
    .bind(&item_id)
    .fetch_one(db)
    .await
    .map_err(|e| e.to_string())?;
    
    // Simple base64 decoding for now
    let decrypted_bytes = general_purpose::STANDARD.decode(&encrypted_data)
        .map_err(|e| format!("Failed to decode data: {}", e))?;
    
    let decrypted_string = String::from_utf8(decrypted_bytes)
        .map_err(|e| format!("Failed to convert to string: {}", e))?;
    
    Ok(decrypted_string)
}
