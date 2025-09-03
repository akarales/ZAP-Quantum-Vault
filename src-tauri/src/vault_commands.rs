use crate::models::{CreateVaultRequest, Vault, CreateVaultItemRequest, VaultItem};
use crate::state::AppState;
use crate::encryption::{VaultEncryption, SecurePassword, EncryptedData, decrypt_legacy_base64};
use crate::validation::InputValidator;
use crate::utils::datetime::parse_datetime_safe;
use sqlx::Row;
use tauri::State;
use tracing::info;
use chrono::Utc;
use uuid::Uuid;
use base64::{Engine as _, engine::general_purpose};
use log::{error, debug};
use serde::{Serialize, Deserialize};

const DEFAULT_USER_ID: &str = "default_user";

#[derive(Serialize, Deserialize, Debug)]
pub struct VaultExportData {
    pub export_timestamp: String,
    pub export_version: String,
    pub total_vaults: usize,
    pub total_items: usize,
    pub vaults: Vec<VaultWithItems>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VaultWithItems {
    pub vault: Vault,
    pub items: Vec<VaultItem>,
}

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
    // Validate vault name
    let vault_name = InputValidator::validate_vault_name(&request.name)
        .map_err(|e| format!("Invalid vault name: {}", e))?;
    
    info!("🔨 create_vault_offline: Creating vault '{}' for user: {}", vault_name, DEFAULT_USER_ID);
    let db = &*state.db;
    
    let vault_id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let created_at = now.to_rfc3339();
    let updated_at = created_at.clone();
    
    debug!("🔧 Generated vault ID: {}", vault_id);
    debug!("🔧 Vault details: name='{}', type='{}', description='{:?}'", 
           vault_name, request.vault_type, request.description);
    
    sqlx::query(
        "INSERT INTO vaults (id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&vault_id)
    .bind(DEFAULT_USER_ID)
    .bind(&vault_name)
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
        name: vault_name,
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
    
    // Check if this is legacy Base64 data or new encrypted data
    let row = sqlx::query(
        "SELECT encrypted_data, encrypted_data_v2, encryption_version, encryption_salt FROM vault_items WHERE id = ?"
    )
    .bind(&item_id)
    .fetch_one(db)
    .await
    .map_err(|e| e.to_string())?;
    
    let encryption_version: Option<i32> = row.get("encryption_version");
    let encrypted_data_v2: Option<String> = row.get("encrypted_data_v2");
    let encryption_salt: Option<String> = row.get("encryption_salt");
    
    match (encryption_version, encrypted_data_v2, encryption_salt) {
        (Some(2), Some(encrypted_v2), Some(salt_b64)) => {
            // New AES-256-GCM encrypted data - requires password
            return Err("Real encryption requires user password. Use decrypt_vault_item_with_password instead.".to_string());
        },
        _ => {
            // Legacy Base64 "encryption" - migrate this data
            info!("[VAULT_DECRYPT] Decrypting legacy Base64 data for item {}", item_id);
            let decrypted = decrypt_legacy_base64(&encrypted_data)
                .map_err(|e| format!("Failed to decrypt legacy data: {}", e))?;
            
            // Log that this item needs migration
            info!("[VAULT_DECRYPT] Item {} uses legacy encryption and should be migrated", item_id);
            
            Ok(decrypted)
        }
    }
}

#[tauri::command]
pub async fn decrypt_vault_item_with_password(
    state: State<'_, AppState>,
    item_id: String,
    password: String,
) -> Result<String, String> {
    let db = &*state.db;
    
    // Create secure password
    let secure_password = SecurePassword::new(password.clone())
        .map_err(|e| format!("Invalid password: {}", e))?;
    
    let row = sqlx::query(
        "SELECT encrypted_data, encrypted_data_v2, encryption_version, encryption_salt FROM vault_items WHERE id = ?"
    )
    .bind(&item_id)
    .fetch_one(db)
    .await
    .map_err(|e| e.to_string())?;
    
    let encryption_version: Option<i32> = row.get("encryption_version");
    let encrypted_data_v2: Option<String> = row.get("encrypted_data_v2");
    let encryption_salt: Option<String> = row.get("encryption_salt");
    let legacy_data: String = row.get("encrypted_data");
    
    match (encryption_version, encrypted_data_v2, encryption_salt) {
        (Some(2), Some(encrypted_v2), Some(salt_b64)) => {
            // Decrypt with real AES-256-GCM encryption
            let salt = general_purpose::STANDARD.decode(&salt_b64)
                .map_err(|e| format!("Invalid salt format: {}", e))?;
            
            if salt.len() != 32 {
                return Err("Invalid salt length".to_string());
            }
            
            let mut salt_array = [0u8; 32];
            salt_array.copy_from_slice(&salt);
            
            let encryption = VaultEncryption::from_salt(&secure_password, salt_array)
                .map_err(|e| format!("Failed to create encryption: {}", e))?;
            
            let encrypted_data: EncryptedData = serde_json::from_str(&encrypted_v2)
                .map_err(|e| format!("Invalid encrypted data format: {}", e))?;
            
            let decrypted = encryption.decrypt(&encrypted_data)
                .map_err(|e| format!("Decryption failed: {}", e))?;
            
            Ok(decrypted)
        },
        _ => {
            // Legacy Base64 data - decrypt and suggest migration
            let decrypted = decrypt_legacy_base64(&legacy_data)
                .map_err(|e| format!("Failed to decrypt legacy data: {}", e))?;
            
            info!("[VAULT_DECRYPT] Item {} uses legacy encryption - migration recommended", item_id);
            Ok(decrypted)
        }
    }
}

#[tauri::command]
pub async fn create_vault_item_with_encryption(
    state: State<'_, AppState>,
    vault_id: String,
    title: String,
    data: String,
    item_type: String,
    password: String,
) -> Result<String, String> {
    let db = &*state.db;
    
    // Create secure password
    let secure_password = SecurePassword::new(password.clone())
        .map_err(|e| format!("Invalid password: {}", e))?;
    
    // Create encryption instance
    let encryption = VaultEncryption::new(&secure_password, None)
        .map_err(|e| format!("Failed to create encryption: {}", e))?;
    
    // Encrypt the data
    let encrypted_data = encryption.encrypt(&data)
        .map_err(|e| format!("Encryption failed: {}", e))?;
    
    let item_id = Uuid::new_v4().to_string();
    let now = Utc::now();
    
    // Store with new encryption format
    sqlx::query(
        "INSERT INTO vault_items (id, vault_id, title, encrypted_data, encrypted_data_v2, encryption_version, encryption_salt, encryption_algorithm, item_type, created_at, updated_at, migration_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&item_id)
    .bind(&vault_id)
    .bind(&title)
    .bind("") // Empty legacy field
    .bind(serde_json::to_string(&encrypted_data).map_err(|e| e.to_string())?)
    .bind(2) // Version 2 encryption
    .bind(&encrypted_data.salt)
    .bind(&encrypted_data.algorithm)
    .bind(&item_type)
    .bind(now)
    .bind(now)
    .bind("migrated") // Already using new encryption
    .execute(db)
    .await
    .map_err(|e| e.to_string())?;
    
    info!("[VAULT_CREATE] Created vault item {} with real AES-256-GCM encryption", item_id);
    Ok(item_id)
}

#[tauri::command]
pub async fn migrate_vault_item_to_real_encryption(
    state: State<'_, AppState>,
    item_id: String,
    password: String,
) -> Result<String, String> {
    let db = &*state.db;
    
    // Create secure password
    let secure_password = SecurePassword::new(password.clone())
        .map_err(|e| format!("Invalid password: {}", e))?;
    
    // Get the current item
    let row = sqlx::query(
        "SELECT encrypted_data, encryption_version FROM vault_items WHERE id = ?"
    )
    .bind(&item_id)
    .fetch_one(db)
    .await
    .map_err(|e| e.to_string())?;
    
    let encryption_version: Option<i32> = row.get("encryption_version");
    let legacy_data: String = row.get("encrypted_data");
    
    if encryption_version == Some(2) {
        return Err("Item already uses real encryption".to_string());
    }
    
    // Decrypt legacy data
    let plaintext = decrypt_legacy_base64(&legacy_data)
        .map_err(|e| format!("Failed to decrypt legacy data: {}", e))?;
    
    // Create backup before migration
    sqlx::query(
        "INSERT INTO vault_items_backup_pre_encryption (id, vault_id, title, encrypted_data, item_type, created_at, updated_at)
         SELECT id, vault_id, title, encrypted_data, item_type, created_at, updated_at FROM vault_items WHERE id = ?"
    )
    .bind(&item_id)
    .execute(db)
    .await
    .map_err(|e| format!("Failed to create backup: {}", e))?;
    
    // Encrypt with real encryption
    let encryption = VaultEncryption::new(&secure_password, None)
        .map_err(|e| format!("Failed to create encryption: {}", e))?;
    
    let encrypted_data = encryption.encrypt(&plaintext)
        .map_err(|e| format!("Encryption failed: {}", e))?;
    
    // Update the item with real encryption
    sqlx::query(
        "UPDATE vault_items SET 
         encrypted_data_v2 = ?, 
         encryption_version = ?, 
         encryption_salt = ?, 
         encryption_algorithm = ?,
         migration_status = ?,
         updated_at = ?
         WHERE id = ?"
    )
    .bind(serde_json::to_string(&encrypted_data).map_err(|e| e.to_string())?)
    .bind(2)
    .bind(&encrypted_data.salt)
    .bind(&encrypted_data.algorithm)
    .bind("migrated")
    .bind(Utc::now())
    .bind(&item_id)
    .execute(db)
    .await
    .map_err(|e| e.to_string())?;
    
    // Log successful migration
    sqlx::query(
        "INSERT INTO encryption_migration_log (vault_item_id, old_encryption, new_encryption, status)
         VALUES (?, ?, ?, ?)"
    )
    .bind(&item_id)
    .bind("base64")
    .bind("AES-256-GCM")
    .bind("success")
    .execute(db)
    .await
    .map_err(|e| e.to_string())?;
    
    info!("[VAULT_MIGRATE] Successfully migrated item {} to real encryption", item_id);
    Ok("Migration successful".to_string())
}

#[tauri::command]
pub async fn export_all_vault_data_for_backup(
    state: State<'_, AppState>,
) -> Result<VaultExportData, String> {
    info!("[VAULT_EXPORT] Starting comprehensive vault data export for backup");
    let db = &*state.db;
    
    // Get all vaults
    let vault_rows = sqlx::query(
        "SELECT id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at 
         FROM vaults ORDER BY created_at DESC"
    )
    .fetch_all(db)
    .await
    .map_err(|e| {
        error!("[VAULT_EXPORT] ❌ Failed to fetch vaults: {}", e);
        e.to_string()
    })?;
    
    info!("[VAULT_EXPORT] ✅ Retrieved {} vaults from database", vault_rows.len());
    
    let mut vaults_with_items = Vec::new();
    let mut total_items = 0;
    
    for vault_row in vault_rows {
        let vault_id: String = vault_row.get("id");
        let vault_name: String = vault_row.get("name");
        
        info!("[VAULT_EXPORT] Processing vault: {} ({})", vault_name, vault_id);
        
        // Create vault object
        let vault = Vault {
            id: vault_id.clone(),
            user_id: vault_row.get("user_id"),
            name: vault_name.clone(),
            description: vault_row.get("description"),
            vault_type: vault_row.get("vault_type"),
            is_shared: vault_row.get("is_shared"),
            is_default: vault_row.get("is_default"),
            is_system_default: vault_row.get("is_system_default"),
            created_at: {
                let created_str: String = vault_row.get("created_at");
                parse_datetime_safe(&created_str, &format!("vault {} created_at", vault_id))?
            },
            updated_at: {
                let updated_str: String = vault_row.get("updated_at");
                parse_datetime_safe(&updated_str, &format!("vault {} updated_at", vault_id))?
            },
        };
        
        // Get all items for this vault from vault_items table
        let item_rows = sqlx::query(
            "SELECT id, vault_id, item_type, title, encrypted_data, metadata, tags, created_at, updated_at 
             FROM vault_items WHERE vault_id = ? ORDER BY created_at DESC"
        )
        .bind(&vault_id)
        .fetch_all(db)
        .await
        .map_err(|e| {
            error!("[VAULT_EXPORT] ❌ Failed to fetch items for vault {}: {}", vault_id, e);
            e.to_string()
        })?;

        // Get all Bitcoin keys for this vault from bitcoin_keys table
        let bitcoin_key_rows = sqlx::query(
            "SELECT id, vault_id, key_type, network, encrypted_private_key, public_key, derivation_path, entropy_source, created_at, last_used, encryption_password 
             FROM bitcoin_keys WHERE vault_id = ? ORDER BY created_at DESC"
        )
        .bind(&vault_id)
        .fetch_all(db)
        .await
        .map_err(|e| {
            error!("[VAULT_EXPORT] ❌ Failed to fetch Bitcoin keys for vault {}: {}", vault_id, e);
            e.to_string()
        })?;
        
        let mut items = Vec::new();
        
        // Add regular vault items
        for item_row in item_rows {
            let tags_str: String = item_row.get("tags");
            let tags = if tags_str.is_empty() {
                None
            } else {
                serde_json::from_str(&tags_str).unwrap_or(None)
            };
            
            items.push(VaultItem {
                id: item_row.get("id"),
                vault_id: item_row.get("vault_id"),
                item_type: item_row.get("item_type"),
                title: item_row.get("title"),
                encrypted_data: item_row.get("encrypted_data"),
                metadata: item_row.get("metadata"),
                tags,
                created_at: {
                    let created_str: String = item_row.get("created_at");
                    parse_datetime_safe(&created_str, &format!("vault item {} created_at", item_row.get::<String, _>("id")))?
                },
                updated_at: {
                    let updated_str: String = item_row.get("updated_at");
                    parse_datetime_safe(&updated_str, &format!("vault item {} updated_at", item_row.get::<String, _>("id")))?
                },
            });
        }

        // Add Bitcoin keys as vault items
        let bitcoin_keys_count = bitcoin_key_rows.len();
        for bitcoin_key_row in bitcoin_key_rows {
            let bitcoin_key_id: String = bitcoin_key_row.get("id");
            
            // Get receiving addresses for this Bitcoin key
            let address_rows = sqlx::query(
                "SELECT address, derivation_index, label, is_used, balance_satoshis 
                 FROM receiving_addresses WHERE key_id = ? ORDER BY derivation_index ASC"
            )
            .bind(&bitcoin_key_id)
            .fetch_all(db)
            .await
            .map_err(|e| {
                error!("[VAULT_EXPORT] ❌ Failed to fetch addresses for Bitcoin key {}: {}", bitcoin_key_id, e);
                e.to_string()
            })?;
            
            // Create encrypted data structure for Bitcoin key using the actual encrypted private key
            let encrypted_private_key: Vec<u8> = bitcoin_key_row.get("encrypted_private_key");
            let public_key: Vec<u8> = bitcoin_key_row.get("public_key");
            
            // Build addresses array
            let addresses: Vec<serde_json::Value> = address_rows.iter().map(|addr_row| {
                serde_json::json!({
                    "address": addr_row.get::<String, _>("address"),
                    "derivation_index": addr_row.get::<i64, _>("derivation_index"),
                    "label": addr_row.get::<Option<String>, _>("label"),
                    "is_used": addr_row.get::<bool, _>("is_used"),
                    "balance_satoshis": addr_row.get::<i64, _>("balance_satoshis")
                })
            }).collect();
            
            // Convert binary data to base64 for JSON storage
            let encrypted_data = serde_json::json!({
                "encrypted_private_key": general_purpose::STANDARD.encode(&encrypted_private_key),
                "public_key": general_purpose::STANDARD.encode(&public_key),
                "key_type": bitcoin_key_row.get::<String, _>("key_type"),
                "network": bitcoin_key_row.get::<String, _>("network"),
                "derivation_path": bitcoin_key_row.get::<Option<String>, _>("derivation_path"),
                "entropy_source": bitcoin_key_row.get::<String, _>("entropy_source"),
                "encryption_password": bitcoin_key_row.get::<Option<String>, _>("encryption_password"),
                "receiving_addresses": addresses
            }).to_string();

            // Generate a title from key type and network
            let key_type: String = bitcoin_key_row.get("key_type");
            let network: String = bitcoin_key_row.get("network");
            let title = format!("Bitcoin Key ({} - {})", key_type, network);

            items.push(VaultItem {
                id: bitcoin_key_row.get("id"),
                vault_id: bitcoin_key_row.get("vault_id"),
                item_type: "bitcoin_key".to_string(),
                title,
                encrypted_data,
                metadata: Some("{}".to_string()), // Empty metadata for Bitcoin keys
                tags: None,
                created_at: {
                    let created_str: String = bitcoin_key_row.get("created_at");
                    parse_datetime_safe(&created_str, &format!("bitcoin key {} created_at", bitcoin_key_row.get::<String, _>("id")))?
                },
                updated_at: {
                    // Use last_used or created_at as updated_at
                    let updated_str: String = bitcoin_key_row.get::<Option<String>, _>("last_used")
                        .unwrap_or_else(|| bitcoin_key_row.get("created_at"));
                    parse_datetime_safe(&updated_str, &format!("bitcoin key {} updated_at", bitcoin_key_row.get::<String, _>("id")))?
                },
            });
        }

        info!("[VAULT_EXPORT] Added {} Bitcoin keys to vault '{}'", bitcoin_keys_count, vault_name);
        
        total_items += items.len();
        info!("[VAULT_EXPORT] Vault '{}' has {} items", vault_name, items.len());
        
        vaults_with_items.push(VaultWithItems {
            vault,
            items,
        });
    }
    
    let export_data = VaultExportData {
        export_timestamp: Utc::now().to_rfc3339(),
        export_version: "1.0".to_string(),
        total_vaults: vaults_with_items.len(),
        total_items,
        vaults: vaults_with_items,
    };
    
    info!("[VAULT_EXPORT] ✅ Export completed: {} vaults, {} total items", 
          export_data.total_vaults, export_data.total_items);
    
    Ok(export_data)
}
