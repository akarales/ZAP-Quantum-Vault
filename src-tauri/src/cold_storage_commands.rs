use crate::cold_storage::{ColdStorageManager, UsbDrive, BackupMetadata, TrustLevel, RestoreRequest, RestoreType};
use crate::state::AppState;
use std::sync::Mutex;
use tauri::State;

// Global cold storage manager
lazy_static::lazy_static! {
    static ref COLD_STORAGE: Mutex<ColdStorageManager> = Mutex::new(ColdStorageManager::new());
}

#[tauri::command]
pub async fn detect_usb_drives() -> Result<Vec<UsbDrive>, String> {
    let mut manager = COLD_STORAGE.lock().map_err(|e| e.to_string())?;
    manager.scan_usb_drives().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_drive_details(
    state: State<'_, AppState>,
    drive_id: String
) -> Result<UsbDrive, String> {
    println!("get_drive_details called with drive_id: {}", drive_id);
    
    // Get drive from manager first
    let mut drive = {
        let mut manager = COLD_STORAGE.lock().map_err(|e| e.to_string())?;
        let drives = manager.scan_usb_drives().map_err(|e| e.to_string())?;
        
        println!("Available drives: {:?}", drives.iter().map(|d| &d.id).collect::<Vec<_>>());
        
        let available_ids: Vec<String> = drives.iter().map(|d| d.id.clone()).collect();
        drives.into_iter()
            .find(|drive| drive.id == drive_id)
            .ok_or_else(|| format!("Drive not found: {}. Available drives: {:?}", drive_id, available_ids))?
    };
    
    // Load trust level from database
    let db = &*state.db;
    if let Ok(Some(trust_row)) = sqlx::query("SELECT trust_level FROM usb_drives WHERE id = ?")
        .bind(&drive_id)
        .fetch_optional(db)
        .await
    {
        use sqlx::Row;
        let trust_level_str = trust_row.get::<String, _>("trust_level");
        drive.trust_level = match trust_level_str.as_str() {
            "trusted" => TrustLevel::Trusted,
            "blocked" => TrustLevel::Blocked,
            _ => TrustLevel::Untrusted,
        };
    }
    
    Ok(drive)
}

#[tauri::command]
pub async fn set_drive_trust(
    state: State<'_, AppState>,
    drive_id: String, 
    trust_level: String
) -> Result<String, String> {
    let trust = match trust_level.as_str() {
        "trusted" => TrustLevel::Trusted,
        "untrusted" => TrustLevel::Untrusted,
        "blocked" => TrustLevel::Blocked,
        _ => return Err("Invalid trust level".to_string()),
    };

    // Update in-memory manager
    {
        let mut manager = COLD_STORAGE.lock().map_err(|e| e.to_string())?;
        manager.set_drive_trust(&drive_id, trust).map_err(|e| e.to_string())?;
    }
    
    // Persist to database
    let db = &*state.db;
    sqlx::query("INSERT OR REPLACE INTO usb_drives (id, trust_level, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
        .bind(&drive_id)
        .bind(&trust_level)
        .execute(db)
        .await
        .map_err(|e| format!("Failed to save trust level to database: {}", e))?;
    
    Ok("Trust level updated successfully".to_string())
}

#[tauri::command]
pub async fn create_vault_backup(
    state: State<'_, AppState>,
    drive_id: String,
    vault_id: String,
    password: String,
) -> Result<String, String> {
    use sqlx::Row;
    
    let db = &*state.db;
    
    // Load trust level from database first
    let trust_level = if let Ok(Some(trust_row)) = sqlx::query("SELECT trust_level FROM usb_drives WHERE id = ?")
        .bind(&drive_id)
        .fetch_optional(db)
        .await
    {
        let trust_level_str = trust_row.get::<String, _>("trust_level");
        match trust_level_str.as_str() {
            "trusted" => TrustLevel::Trusted,
            "blocked" => TrustLevel::Blocked,
            _ => TrustLevel::Untrusted,
        }
    } else {
        TrustLevel::Untrusted
    };
    
    // Ensure the drive trust level is loaded in the manager
    {
        let mut manager = COLD_STORAGE.lock().map_err(|e| e.to_string())?;
        manager.set_drive_trust(&drive_id, trust_level).map_err(|e| e.to_string())?;
    }
    
    // Get vault data - handle both UUID and name resolution
    let vault_row = if vault_id.len() == 36 && vault_id.contains('-') {
        // Looks like a UUID, query by ID
        sqlx::query("SELECT * FROM vaults WHERE id = ?")
            .bind(&vault_id)
            .fetch_optional(db)
            .await
            .map_err(|e| format!("Database error: {}", e))?
    } else {
        // Looks like a name, query by name
        sqlx::query("SELECT * FROM vaults WHERE name = ?")
            .bind(&vault_id)
            .fetch_optional(db)
            .await
            .map_err(|e| format!("Database error: {}", e))?
    };
    
    let vault_row = vault_row.ok_or("Vault not found")?;
    let actual_vault_id = vault_row.get::<String, _>("id");
    
    // Get all vault items for this vault
    let vault_items = sqlx::query("SELECT * FROM vault_items WHERE vault_id = ? AND is_deleted = false")
        .bind(&actual_vault_id)
        .fetch_all(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    
    // Get all Bitcoin keys associated with vault items
    let mut bitcoin_keys: Vec<serde_json::Value> = Vec::new();
    for item in &vault_items {
        let item_data: serde_json::Value = serde_json::from_str(
            item.get::<String, _>("encrypted_data").as_str()
        ).map_err(|e| format!("Failed to parse item data: {}", e))?;
        
        if let Some(key_id) = item_data.get("keyId").and_then(|v| v.as_str()) {
            // Get bitcoin key without address (address is now in receiving_addresses table)
            if let Ok(Some(key_row)) = sqlx::query("SELECT id, vault_id, key_type, network, public_key, encrypted_private_key, derivation_path, entropy_source, quantum_enhanced, created_at, is_active FROM bitcoin_keys WHERE id = ?")
                .bind(key_id)
                .fetch_optional(db)
                .await
            {
                // Get primary address from receiving_addresses table
                let primary_address = sqlx::query("SELECT address FROM receiving_addresses WHERE key_id = ? AND derivation_index = 0")
                    .bind(key_id)
                    .fetch_optional(db)
                    .await
                    .ok()
                    .flatten()
                    .and_then(|row| row.try_get::<String, _>("address").ok())
                    .unwrap_or_default();

                let key_json = serde_json::json!({
                    "id": key_row.get::<String, _>("id"),
                    "vault_id": key_row.get::<String, _>("vault_id"),
                    "key_type": key_row.get::<String, _>("key_type"),
                    "network": key_row.get::<String, _>("network"),
                    "address": primary_address,
                    "public_key": key_row.get::<Vec<u8>, _>("public_key"),
                    "encrypted_private_key": key_row.get::<Vec<u8>, _>("encrypted_private_key"),
                    "derivation_path": key_row.get::<Option<String>, _>("derivation_path"),
                    "entropy_source": key_row.get::<String, _>("entropy_source"),
                    "quantum_enhanced": key_row.get::<bool, _>("quantum_enhanced"),
                    "created_at": key_row.get::<String, _>("created_at"),
                    "is_active": key_row.get::<bool, _>("is_active"),
                });
                bitcoin_keys.push(key_json);
            }
        }
    }
    
    // Get receiving addresses for all keys
    let mut receiving_addresses = Vec::new();
    for key in &bitcoin_keys {
        let key_id = key.get("id").and_then(|v| v.as_str()).unwrap_or("");
        let addresses = sqlx::query("SELECT id, key_id, address, derivation_index, label, is_used, balance_satoshis, transaction_count, created_at FROM receiving_addresses WHERE key_id = ?")
            .bind(&key_id)
            .fetch_all(db)
            .await
            .map_err(|e| format!("Database error fetching receiving addresses: {}", e))?;
        receiving_addresses.extend(addresses);
    }
    
    // Create comprehensive backup data structure
    let backup_data = serde_json::json!({
        "version": "2.0",
        "created_at": chrono::Utc::now().to_rfc3339(),
        "vault": {
            "id": vault_row.get::<String, _>("id"),
            "name": vault_row.get::<String, _>("name"),
            "description": vault_row.get::<Option<String>, _>("description"),
            "created_at": vault_row.get::<String, _>("created_at"),
            "updated_at": vault_row.get::<String, _>("updated_at"),
            "is_default": vault_row.get::<bool, _>("is_default"),
        },
        "vault_items": vault_items.iter().map(|item| serde_json::json!({
            "id": item.get::<String, _>("id"),
            "vault_id": item.get::<String, _>("vault_id"),
            "item_type": item.get::<String, _>("item_type"),
            "title": item.get::<String, _>("title"),
            "encrypted_data": item.get::<String, _>("encrypted_data"),
            "metadata": item.get::<Option<String>, _>("metadata"),
            "tags": item.get::<Option<String>, _>("tags"),
            "created_at": item.get::<String, _>("created_at"),
            "updated_at": item.get::<String, _>("updated_at"),
        })).collect::<Vec<_>>(),
        "bitcoin_keys": bitcoin_keys,
        "receiving_addresses": receiving_addresses.iter().map(|addr: &sqlx::sqlite::SqliteRow| {
            serde_json::json!({
                "id": addr.try_get::<String, _>("id").unwrap_or_default(),
                "key_id": addr.try_get::<String, _>("key_id").unwrap_or_default(),
                "address": addr.try_get::<String, _>("address").unwrap_or_default(),
                "derivation_index": addr.try_get::<i32, _>("derivation_index").unwrap_or(0),
                "label": addr.try_get::<Option<String>, _>("label").unwrap_or(None),
                "is_used": addr.try_get::<bool, _>("is_used").unwrap_or(false),
                "balance_satoshis": addr.try_get::<i64, _>("balance_satoshis").unwrap_or(0),
                "transaction_count": addr.try_get::<i32, _>("transaction_count").unwrap_or(0),
                "created_at": addr.try_get::<String, _>("created_at").unwrap_or_default(),
            })
        }).collect::<Vec<_>>(),
        "backup_metadata": {
            "total_items": vault_items.len(),
            "total_keys": bitcoin_keys.len(),
            "total_addresses": receiving_addresses.len(),
            "backup_type": "full_vault",
            "encryption": "ZAP-Quantum-Crypto-v2.0"
        }
    });
    
    let backup_bytes = serde_json::to_vec(&backup_data)
        .map_err(|e| format!("Failed to serialize backup data: {}", e))?;
    
    // Generate recovery phrase for this backup
    let recovery_phrase = crate::cold_storage::generate_recovery_phrase()
        .map_err(|e| format!("Failed to generate recovery phrase: {}", e))?;
    
    // Create backup using cold storage manager - scope the lock to avoid Send issues
    let backup_id = {
        let mut manager = COLD_STORAGE.lock().map_err(|e| e.to_string())?;
        manager.create_backup(&drive_id, &backup_bytes, &recovery_phrase, &password)
            .map_err(|e| e.to_string())?
    };
    
    // Store backup record in database
    let created_at = chrono::Utc::now().to_rfc3339();
    let backup_metadata = serde_json::json!({
        "total_items": vault_items.len(),
        "total_keys": bitcoin_keys.len(),
        "total_addresses": receiving_addresses.len(),
        "backup_type": "full_vault",
        "encryption": "ZAP-Quantum-Crypto-v2.0"
    });
    
    sqlx::query(
        "INSERT INTO vault_cold_backups (id, vault_id, drive_id, backup_path, backup_version, encrypted_vault_data, backup_metadata, checksum, backup_size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&backup_id)
    .bind(&vault_id)
    .bind(&drive_id)
    .bind(format!("/backup_{}", backup_id))
    .bind(2) // backup_version
    .bind(&backup_bytes) // encrypted_vault_data
    .bind(backup_metadata.to_string()) // backup_metadata
    .bind(hex::encode(blake3::hash(&backup_bytes).as_bytes()))
    .bind(backup_bytes.len() as i64) // backup_size_bytes
    .bind(&created_at)
    .execute(db)
    .await
    .map_err(|e| format!("Failed to store backup record: {}", e))?;
    
    Ok(backup_id)
}

#[tauri::command]
pub async fn list_backups(drive_id: String) -> Result<Vec<BackupMetadata>, String> {
    let manager = COLD_STORAGE.lock().map_err(|e| e.to_string())?;
    manager.list_backups(&drive_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn verify_backup(backup_id: String) -> Result<bool, String> {
    let manager = COLD_STORAGE.lock().map_err(|e| e.to_string())?;
    manager.verify_backup(&backup_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restore_vault_backup(
    state: State<'_, AppState>,
    backup_id: String,
    password: String,
    merge_mode: bool,
) -> Result<String, String> {
    use sqlx::Row;
    
    let db = &*state.db;
    
    // Get backup metadata from database
    let backup_row = sqlx::query("SELECT * FROM vault_cold_backups WHERE id = ?")
        .bind(&backup_id)
        .fetch_optional(db)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or("Backup not found")?;

    let drive_id = backup_row.get::<String, _>("drive_id");
    let backup_path = backup_row.get::<String, _>("backup_path");

    // Create restore request
    let restore_request = RestoreRequest {
        backup_id: backup_id.clone(),
        restore_type: RestoreType::Full,
        vault_ids: None,
        merge_mode,
    };

    // Restore backup using cold storage manager - scope the lock to avoid Send issues
    {
        let manager = COLD_STORAGE.lock().map_err(|e| e.to_string())?;
        manager.restore_backup(restore_request).map_err(|e| e.to_string())?;
    };

    // For now, simulate successful restore with empty backup data
    let backup_data = serde_json::json!({
        "vault": {},
        "vault_items": [],
        "bitcoin_keys": [],
        "receiving_addresses": []
    });
    
    // Begin transaction for atomic restore
    let mut tx = db.begin().await
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;
    
    // Restore vault
    let vault_data = backup_data.get("vault")
        .ok_or("Invalid backup: missing vault data")?;
    
    let vault_id = vault_data.get("id").and_then(|v| v.as_str())
        .ok_or("Invalid backup: missing vault ID")?;
    
    if !merge_mode {
        // Check if vault already exists
        let existing_vault = sqlx::query("SELECT id FROM vaults WHERE id = ?")
            .bind(vault_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| format!("Database error: {}", e))?;
        
        if existing_vault.is_some() {
            return Err("Vault already exists. Use merge mode to combine with existing data.".to_string());
        }
    }
    
    // Insert or update vault
    sqlx::query(
        "INSERT OR REPLACE INTO vaults (id, name, description, created_at, updated_at, is_default) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(vault_id)
    .bind(vault_data.get("name").and_then(|v| v.as_str()).unwrap_or("Restored Vault"))
    .bind(vault_data.get("description").and_then(|v| v.as_str()))
    .bind(vault_data.get("created_at").and_then(|v| v.as_str()).unwrap_or(&chrono::Utc::now().to_rfc3339()))
    .bind(chrono::Utc::now().to_rfc3339())
    .bind(vault_data.get("is_default").and_then(|v| v.as_bool()).unwrap_or(false))
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to restore vault: {}", e))?;
    
    // Restore Bitcoin keys
    if let Some(bitcoin_keys) = backup_data.get("bitcoin_keys").and_then(|v| v.as_array()) {
        for key_data in bitcoin_keys {
            sqlx::query(
                "INSERT OR REPLACE INTO bitcoin_keys (id, vault_id, key_type, network, address, public_key, encrypted_private_key, derivation_path, entropy_source, quantum_enhanced, created_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(key_data.get("id").and_then(|v| v.as_str()).unwrap_or_default())
            .bind(key_data.get("vault_id").and_then(|v| v.as_str()).unwrap_or(vault_id))
            .bind(key_data.get("key_type").and_then(|v| v.as_str()).unwrap_or("native"))
            .bind(key_data.get("network").and_then(|v| v.as_str()).unwrap_or("mainnet"))
            .bind(key_data.get("address").and_then(|v| v.as_str()).unwrap_or_default())
            .bind(key_data.get("public_key").and_then(|v| v.as_array()).map(|arr| {
                arr.iter().filter_map(|v| v.as_u64().map(|n| n as u8)).collect::<Vec<u8>>()
            }).unwrap_or_default())
            .bind(key_data.get("encrypted_private_key").and_then(|v| v.as_array()).map(|arr| {
                arr.iter().filter_map(|v| v.as_u64().map(|n| n as u8)).collect::<Vec<u8>>()
            }).unwrap_or_default())
            .bind(key_data.get("derivation_path").and_then(|v| v.as_str()))
            .bind(key_data.get("entropy_source").and_then(|v| v.as_str()).unwrap_or("system_rng"))
            .bind(key_data.get("quantum_enhanced").and_then(|v| v.as_bool()).unwrap_or(false))
            .bind(key_data.get("created_at").and_then(|v| v.as_str()).unwrap_or(&chrono::Utc::now().to_rfc3339()))
            .bind(key_data.get("is_active").and_then(|v| v.as_bool()).unwrap_or(true))
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to restore Bitcoin key: {}", e))?;
        }
    }
    
    // Restore vault items
    if let Some(vault_items) = backup_data.get("vault_items").and_then(|v| v.as_array()) {
        for item_data in vault_items {
            sqlx::query(
                "INSERT OR REPLACE INTO vault_items (id, vault_id, item_type, title, encrypted_data, metadata, tags, created_at, updated_at, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(item_data.get("id").and_then(|v| v.as_str()).unwrap_or_default())
            .bind(item_data.get("vault_id").and_then(|v| v.as_str()).unwrap_or(vault_id))
            .bind(item_data.get("item_type").and_then(|v| v.as_str()).unwrap_or("bitcoin_key"))
            .bind(item_data.get("title").and_then(|v| v.as_str()).unwrap_or("Restored Item"))
            .bind(item_data.get("encrypted_data").and_then(|v| v.as_str()).unwrap_or("{}"))
            .bind(item_data.get("metadata").and_then(|v| v.as_str()))
            .bind(item_data.get("tags").and_then(|v| v.as_str()))
            .bind(item_data.get("created_at").and_then(|v| v.as_str()).unwrap_or(&chrono::Utc::now().to_rfc3339()))
            .bind(item_data.get("updated_at").and_then(|v| v.as_str()).unwrap_or(&chrono::Utc::now().to_rfc3339()))
            .bind(false)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to restore vault item: {}", e))?;
        }
    }
    
    // Restore receiving addresses
    if let Some(addresses) = backup_data.get("receiving_addresses").and_then(|v| v.as_array()) {
        for addr_data in addresses {
            sqlx::query(
                "INSERT OR REPLACE INTO receiving_addresses (id, key_id, address, derivation_index, label, is_used, balance_satoshis, transaction_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(addr_data.get("id").and_then(|v| v.as_str()).unwrap_or_default())
            .bind(addr_data.get("key_id").and_then(|v| v.as_str()).unwrap_or_default())
            .bind(addr_data.get("address").and_then(|v| v.as_str()).unwrap_or_default())
            .bind(addr_data.get("derivation_index").and_then(|v| v.as_i64()).unwrap_or(0) as i32)
            .bind(addr_data.get("label").and_then(|v| v.as_str()))
            .bind(addr_data.get("is_used").and_then(|v| v.as_bool()).unwrap_or(false))
            .bind(addr_data.get("balance_satoshis").and_then(|v| v.as_i64()).unwrap_or(0))
            .bind(addr_data.get("transaction_count").and_then(|v| v.as_i64()).unwrap_or(0) as i32)
            .bind(addr_data.get("created_at").and_then(|v| v.as_str()).unwrap_or(&chrono::Utc::now().to_rfc3339()))
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to restore receiving address: {}", e))?;
        }
    }
    
    // Commit transaction
    tx.commit().await
        .map_err(|e| format!("Failed to commit restore transaction: {}", e))?;
    
    // Log successful restore
    let metadata = backup_data.get("backup_metadata");
    let total_items = metadata.and_then(|m| m.get("total_items")).and_then(|v| v.as_u64()).unwrap_or(0);
    let total_keys = metadata.and_then(|m| m.get("total_keys")).and_then(|v| v.as_u64()).unwrap_or(0);
    
    Ok(format!("Vault restored successfully: {} items, {} keys", total_items, total_keys))
}


#[tauri::command]
pub async fn eject_drive(drive_id: String) -> Result<String, String> {
    let manager = COLD_STORAGE.lock().map_err(|e| e.to_string())?;
    manager.eject_drive(&drive_id).map_err(|e| e.to_string())?;
    Ok("Drive ejected safely".to_string())
}

#[tauri::command]
pub async fn generate_recovery_phrase() -> Result<String, String> {
    crate::cold_storage::generate_recovery_phrase().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn recover_from_phrase(phrase: String) -> Result<Vec<u8>, String> {
    crate::cold_storage::recover_from_phrase(&phrase).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn unmount_drive(drive_id: String) -> Result<String, String> {
    use std::process::Command;
    
    // Parse drive ID to get device path - handle both formats
    let device_path = if drive_id.starts_with("usb_") {
        let device_name = drive_id.strip_prefix("usb_").unwrap_or(&drive_id);
        format!("/dev/{}", device_name)
    } else if drive_id.starts_with("/dev/") {
        drive_id.clone()
    } else {
        format!("/dev/{}", drive_id)
    };
    
    println!("Attempting to unmount device: {}", device_path);
    
    // Check for both regular mounts and encrypted device mapper mounts
    let mount_check = Command::new("mount")
        .output()
        .map_err(|e| format!("Failed to check mount status: {}", e))?;
    
    let mount_output = String::from_utf8_lossy(&mount_check.stdout);
    
    // Find mount points for both regular device and encrypted mapper devices
    let mut mount_points = Vec::new();
    
    for line in mount_output.lines() {
        if line.contains(&device_path) || line.contains("/dev/mapper/") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                mount_points.push(parts[2].to_string());
            }
        }
    }
    
    if mount_points.is_empty() {
        return Err(format!("Drive {} is not currently mounted", device_path));
    }
    
    let mut success_messages = Vec::new();
    let mut error_messages = Vec::new();
    
    // Unmount all found mount points
    for mount_path in mount_points {
        println!("Unmounting from {}", mount_path);
        
        // First try graceful unmount
        let unmount_result = Command::new("sudo")
            .arg("umount")
            .arg("-v")
            .arg(&mount_path)
            .output();
        
        match unmount_result {
            Ok(output) if output.status.success() => {
                println!("Successfully unmounted {}", mount_path);
                success_messages.push(format!("Unmounted from {}", mount_path));
                
                // Try to remove the mount point directory
                let _ = Command::new("sudo")
                    .arg("rmdir")
                    .arg(&mount_path)
                    .output();
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                println!("Graceful unmount failed for {}: {}", mount_path, stderr);
                
                // Try force unmount if graceful fails
                if stderr.contains("busy") || stderr.contains("target is busy") {
                    println!("Attempting force unmount for {}", mount_path);
                    
                    // Kill processes using the mount point
                    let _ = Command::new("sudo")
                        .arg("fuser")
                        .arg("-km")
                        .arg(&mount_path)
                        .output();
                    
                    // Wait a moment
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    
                    // Try lazy unmount
                    let force_result = Command::new("sudo")
                        .arg("umount")
                        .arg("-l")
                        .arg(&mount_path)
                        .output();
                    
                    match force_result {
                        Ok(force_output) if force_output.status.success() => {
                            println!("Force unmount successful for {}", mount_path);
                            success_messages.push(format!("Force unmounted from {}", mount_path));
                        }
                        _ => {
                            error_messages.push(format!("Failed to unmount {}: {}", mount_path, stderr));
                        }
                    }
                } else {
                    error_messages.push(format!("Failed to unmount {}: {}", mount_path, stderr));
                }
            }
            Err(e) => {
                error_messages.push(format!("Command failed for {}: {}", mount_path, e));
            }
        }
    }
    
    // Close any LUKS containers for encrypted drives
    let device_name = device_path.strip_prefix("/dev/").unwrap_or(&device_path);
    let dmsetup_output = Command::new("sudo")
        .arg("dmsetup")
        .arg("ls")
        .arg("--target")
        .arg("crypt")
        .output();
    
    if let Ok(output) = dmsetup_output {
        let mappings = String::from_utf8_lossy(&output.stdout);
        for line in mappings.lines() {
            if !line.trim().is_empty() && line.contains("encrypted") {
                let mapping_name = if let Some(paren_pos) = line.find('(') {
                    line[..paren_pos].trim()
                } else {
                    line.split('\t').next().unwrap_or("").trim()
                };
                
                if !mapping_name.is_empty() {
                    println!("Closing LUKS mapping: {}", mapping_name);
                    let _ = Command::new("sudo")
                        .arg("cryptsetup")
                        .arg("luksClose")
                        .arg(mapping_name)
                        .output();
                }
            }
        }
    }
    
    if !success_messages.is_empty() {
        Ok(success_messages.join("; "))
    } else if !error_messages.is_empty() {
        Err(error_messages.join("; "))
    } else {
        Err("Unknown error during unmount".to_string())
    }
}

#[tauri::command]
pub async fn mount_drive(drive_id: String, mount_point: Option<String>) -> Result<String, String> {
    use std::process::Command;
    
    // Parse drive ID to get device path - handle both formats
    let device_path = if drive_id.starts_with("usb_") {
        let device_name = drive_id.strip_prefix("usb_").unwrap_or(&drive_id);
        if device_name.chars().last().map_or(false, |c| c.is_ascii_digit()) {
            format!("/dev/{}", device_name)
        } else {
            format!("/dev/{}1", device_name)
        }
    } else if drive_id.starts_with("/dev/") {
        drive_id.clone()
    } else {
        format!("/dev/{}", drive_id)
    };
    
    println!("Attempting to mount device: {}", device_path);
    
    // Get filesystem label for mount point
    let label_output = Command::new("lsblk")
        .arg("-no")
        .arg("LABEL")
        .arg(&device_path)
        .output()
        .map_err(|e| format!("Failed to get drive label: {}", e))?;
    
    let label = String::from_utf8_lossy(&label_output.stdout)
        .trim()
        .to_string();
    let label = if label.is_empty() { "USB_DRIVE".to_string() } else { label };
    
    // Create mount point using sudo
    let mount_path = mount_point.unwrap_or_else(|| format!("/media/{}", label));
    let mkdir_result = Command::new("sudo")
        .arg("mkdir")
        .arg("-p")
        .arg(&mount_path)
        .output()
        .map_err(|e| format!("Failed to execute mkdir command: {}", e))?;
    
    if !mkdir_result.status.success() {
        let stderr = String::from_utf8_lossy(&mkdir_result.stderr);
        return Err(format!("Failed to create mount point {}: {}", mount_path, stderr));
    }
    
    // Check filesystem type first
    println!("Checking filesystem type for {}", device_path);
    let fstype_result = Command::new("sudo")
        .arg("blkid")
        .arg("-o")
        .arg("value")
        .arg("-s")
        .arg("TYPE")
        .arg(&device_path)
        .output();
    
    let filesystem_type = if let Ok(output) = fstype_result {
        let fs_type = String::from_utf8_lossy(&output.stdout).trim().to_string();
        println!("Detected filesystem: {}", if fs_type.is_empty() { "unknown" } else { &fs_type });
        if fs_type.is_empty() { None } else { Some(fs_type) }
    } else {
        println!("Could not detect filesystem type");
        None
    };
    
    // Handle LUKS encrypted drives - redirect to encrypted mount
    if let Some(ref fs_type) = filesystem_type {
        if fs_type == "crypto_LUKS" {
            return Err("LUKS_ENCRYPTED_DRIVE".to_string());
        }
    }
    
    let actual_device_path = device_path.clone();
    
    // Mount the drive with timeout and better error handling
    println!("Executing mount command: sudo mount {} {}", actual_device_path, mount_path);
    
    let mut mount_cmd = Command::new("timeout");
    mount_cmd.arg("30")  // 30 second timeout
        .arg("sudo")
        .arg("mount")
        .arg("-v");  // verbose output
    
    // Add filesystem type if detected and not LUKS
    if let Some(fs_type) = filesystem_type {
        if fs_type != "crypto_LUKS" {
            mount_cmd.arg("-t").arg(fs_type);
        }
    }
    
    let mount_result = mount_cmd
        .arg(&actual_device_path)
        .arg(&mount_path)
        .output()
        .map_err(|e| format!("Failed to execute mount command: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&mount_result.stdout);
    let stderr = String::from_utf8_lossy(&mount_result.stderr);
    
    println!("Mount stdout: {}", stdout);
    println!("Mount stderr: {}", stderr);
    println!("Mount exit code: {}", mount_result.status.code().unwrap_or(-1));
    
    if mount_result.status.success() {
        println!("Successfully mounted {} at {}", device_path, mount_path);
        Ok(format!("Drive mounted successfully at {}", mount_path))
    } else {
        let error_msg = if stderr.contains("timeout") {
            "Mount operation timed out after 30 seconds".to_string()
        } else if stderr.is_empty() && !stdout.is_empty() {
            format!("Mount failed: {}", stdout)
        } else {
            format!("Mount failed: {}", stderr)
        };
        println!("Mount failed: {}", error_msg);
        Err(error_msg)
    }
}

#[tauri::command]
pub async fn mount_encrypted_drive_auto(
    state: State<'_, AppState>,
    user_id: String,
    drive_id: String,
    mount_point: Option<String>
) -> Result<String, String> {
    // First try to get stored password
    if let Ok(Some(stored_password)) = crate::usb_password_commands::get_usb_drive_password(state.clone(), user_id, drive_id.clone()).await {
        // Try mounting with stored password
        match mount_encrypted_drive(drive_id.clone(), stored_password, mount_point.clone()).await {
            Ok(result) => return Ok(result),
            Err(_) => {
                // Stored password failed, will need manual password entry
                return Err("STORED_PASSWORD_FAILED".to_string());
            }
        }
    }
    
    // No stored password available
    Err("NO_STORED_PASSWORD".to_string())
}

#[tauri::command]
pub async fn mount_encrypted_drive(drive_id: String, password: String, mount_point: Option<String>) -> Result<String, String> {
    use std::process::Command;
    
    // Parse drive ID to get device path - handle both formats
    let device_path = if drive_id.starts_with("usb_") {
        let device_name = drive_id.strip_prefix("usb_").unwrap_or(&drive_id);
        if device_name.chars().last().map_or(false, |c| c.is_ascii_digit()) {
            format!("/dev/{}", device_name)
        } else {
            format!("/dev/{}1", device_name)
        }
    } else if drive_id.starts_with("/dev/") {
        drive_id.clone()
    } else {
        format!("/dev/{}", drive_id)
    };
    
    println!("Attempting to mount encrypted device: {}", device_path);
    
    // Check if it's actually a LUKS device
    let fstype_result = Command::new("sudo")
        .arg("blkid")
        .arg("-o")
        .arg("value")
        .arg("-s")
        .arg("TYPE")
        .arg(&device_path)
        .output()
        .map_err(|e| format!("Failed to check filesystem type: {}", e))?;
    
    let fs_type = String::from_utf8_lossy(&fstype_result.stdout).trim().to_string();
    if fs_type != "crypto_LUKS" {
        // Try cryptsetup to double-check if it's LUKS
        let cryptsetup_check = Command::new("sudo")
            .arg("cryptsetup")
            .arg("isLuks")
            .arg(&device_path)
            .output();
        
        let is_luks = if let Ok(check_output) = cryptsetup_check {
            check_output.status.success()
        } else {
            false
        };
        
        if !is_luks {
            return Err("DEVICE_NOT_LUKS_ENCRYPTED".to_string());
        }
    }
    
    // Generate a unique mapper name for the LUKS device
    let mapper_name = format!("luks_vault_{}", 
        device_path.replace("/dev/", "").replace("/", "_"));
    let mapper_path = format!("/dev/mapper/{}", mapper_name);
    
    // Check if already unlocked
    if std::path::Path::new(&mapper_path).exists() {
        println!("LUKS device already unlocked at {}", mapper_path);
    } else {
        // Unlock the LUKS device
        println!("Unlocking LUKS device {} as {}", device_path, mapper_name);
        
        let unlock_result = Command::new("sudo")
            .arg("cryptsetup")
            .arg("luksOpen")
            .arg(&device_path)
            .arg(&mapper_name)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start cryptsetup: {}", e))?;
        
        // Write password to stdin
        if let Some(mut stdin) = unlock_result.stdin.as_ref() {
            use std::io::Write;
            writeln!(stdin, "{}", password)
                .map_err(|e| format!("Failed to write password: {}", e))?;
        }
        
        let unlock_output = unlock_result.wait_with_output()
            .map_err(|e| format!("Failed to wait for cryptsetup: {}", e))?;
        
        if !unlock_output.status.success() {
            let stderr = String::from_utf8_lossy(&unlock_output.stderr);
            return Err(format!("Failed to unlock LUKS device: {}", stderr));
        }
        
        println!("Successfully unlocked LUKS device");
    }
    
    // Get filesystem label for mount point
    let label_output = Command::new("lsblk")
        .arg("-no")
        .arg("LABEL")
        .arg(&mapper_path)
        .output()
        .map_err(|e| format!("Failed to get drive label: {}", e))?;
    
    let label = String::from_utf8_lossy(&label_output.stdout)
        .trim()
        .to_string();
    let label = if label.is_empty() { "ENCRYPTED_DRIVE".to_string() } else { label };
    
    // Create mount point
    let mount_path = mount_point.unwrap_or_else(|| format!("/media/{}", label));
    let mkdir_result = Command::new("sudo")
        .arg("mkdir")
        .arg("-p")
        .arg(&mount_path)
        .output()
        .map_err(|e| format!("Failed to execute mkdir command: {}", e))?;
    
    if !mkdir_result.status.success() {
        let stderr = String::from_utf8_lossy(&mkdir_result.stderr);
        // Clean up: close LUKS device if we opened it
        let _ = Command::new("sudo")
            .arg("cryptsetup")
            .arg("luksClose")
            .arg(&mapper_name)
            .output();
        return Err(format!("Failed to create mount point {}: {}", mount_path, stderr));
    }
    
    // Mount the unlocked device
    println!("Mounting unlocked device {} at {}", mapper_path, mount_path);
    
    let mount_result = Command::new("timeout")
        .arg("30")
        .arg("sudo")
        .arg("mount")
        .arg("-v")
        .arg(&mapper_path)
        .arg(&mount_path)
        .output()
        .map_err(|e| format!("Failed to execute mount command: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&mount_result.stdout);
    let stderr = String::from_utf8_lossy(&mount_result.stderr);
    
    println!("Mount stdout: {}", stdout);
    println!("Mount stderr: {}", stderr);
    
    if mount_result.status.success() {
        println!("Successfully mounted encrypted drive at {}", mount_path);
        Ok(format!("Encrypted drive mounted successfully at {}", mount_path))
    } else {
        // Clean up: close LUKS device if mount failed
        let _ = Command::new("sudo")
            .arg("cryptsetup")
            .arg("luksClose")
            .arg(&mapper_name)
            .output();
        
        let error_msg = if stderr.contains("timeout") {
            "Mount operation timed out after 30 seconds".to_string()
        } else if stderr.is_empty() && !stdout.is_empty() {
            format!("Mount failed: {}", stdout)
        } else {
            format!("Mount failed: {}", stderr)
        };
        println!("Mount failed: {}", error_msg);
        Err(error_msg)
    }
}
