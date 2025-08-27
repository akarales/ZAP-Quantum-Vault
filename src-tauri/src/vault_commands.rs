use crate::models::{CreateVaultRequest, Vault, CreateVaultItemRequest, VaultItem};
use crate::state::AppState;
use crate::utils::datetime::parse_datetime_safe;
use chrono::Utc;
use sqlx::Row;
use tauri::State;
use uuid::Uuid;
use log::{info, error, debug};

const DEFAULT_USER_ID: &str = "default_user";

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
    
    // For offline mode, get all vaults regardless of user_id
    let rows = sqlx::query(
        "SELECT id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at 
         FROM vaults ORDER BY created_at DESC"
    )
    .fetch_all(db)
    .await
    .map_err(|e| {
        error!("❌ Failed to fetch vaults for user {}: {}", DEFAULT_USER_ID, e);
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
    info!("🔨 create_vault_offline: Creating vault '{}' for user: {}", request.name, DEFAULT_USER_ID);
    let db = &*state.db;
    
    let vault_id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let created_at = now.to_rfc3339();
    let updated_at = created_at.clone();
    
    debug!("🔧 Generated vault ID: {}", vault_id);
    debug!("🔧 Vault details: name='{}', type='{}', description='{:?}'", 
           request.name, request.vault_type, request.description);
    
    sqlx::query(
        "INSERT INTO vaults (id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&vault_id)
    .bind(DEFAULT_USER_ID)
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
        error!("❌ Failed to insert vault '{}': {}", request.name, e);
        e.to_string()
    })?;
    
    info!("✅ create_vault_offline: Successfully created vault '{}' with ID: {}", request.name, vault_id);
    
    Ok(Vault {
        id: vault_id,
        user_id: DEFAULT_USER_ID.to_string(),
        name: request.name,
        description: request.description,
        vault_type: request.vault_type,
        is_shared: request.is_shared,
        is_default: false,
        is_system_default: false,
        created_at: now,
        updated_at: now,
    })
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
    info!("🔧 create_vault_item_offline: Creating new vault item for vault {}", request.vault_id);
    let db = &*state.db;
    
    let item_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    
    // For offline mode, we'll use a default user_id
    let user_id = DEFAULT_USER_ID;
    
    debug!("📝 Creating vault item with ID: {}", item_id);
    
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
    
    sqlx::query(
        "INSERT INTO vault_items (id, user_id, vault_id, title, item_type, encrypted_data, metadata, tags, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&item_id)
    .bind(user_id)
    .bind(&request.vault_id)
    .bind(&request.title)
    .bind(&request.item_type)
    .bind(&request.data)
    .bind(&request.metadata)
    .bind(request.tags.as_ref().map(|t| serde_json::to_string(t).unwrap_or_default()))
    .bind(&now)
    .bind(&now)
    .execute(db)
    .await
    .map_err(|e| {
        error!("❌ Failed to create vault item: {}", e);
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
        created_at: Utc::now(),
        updated_at: Utc::now(),
    })
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
    let decrypted_bytes = base64::decode(&encrypted_data)
        .map_err(|e| format!("Failed to decode data: {}", e))?;
    
    let decrypted_string = String::from_utf8(decrypted_bytes)
        .map_err(|e| format!("Failed to convert to string: {}", e))?;
    
    Ok(decrypted_string)
}
