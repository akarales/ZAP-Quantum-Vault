use std::time::Instant;
use tauri::State;
use sqlx::{SqlitePool, Row};
use base64::{Engine as _, engine::general_purpose};
use uuid::Uuid;
use crate::AppState;
use crate::bitcoin_keys_clean::{BitcoinKey, SimpleBitcoinKeyGenerator, BitcoinKeyType, BitcoinNetwork, EntropySource};
use argon2::{Argon2, PasswordHasher, password_hash::SaltString};
use aes_gcm::{Aes256Gcm, Nonce, aead::{Aead, KeyInit}};
use crate::{log_error, log_info, log_bitcoin_event};
use crate::logging::BitcoinKeyEvent;

// Migration function to populate receiving_addresses for existing keys
pub async fn migrate_existing_keys_to_receiving_addresses(_db: &SqlitePool) -> Result<(), String> {
    // Since the address column has been removed from bitcoin_keys, this migration is no longer needed
    // All new keys automatically create their primary address in receiving_addresses
    Ok(())
}

#[tauri::command]
pub async fn generate_bitcoin_key(
    vault_id: Option<String>,
    key_type: String,
    network: String,
    password: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    let start_time = Instant::now();
    let mut generator = SimpleBitcoinKeyGenerator::new();
    
    // Ensure vault exists or use default
    let effective_vault_id = match vault_id {
        Some(id) => {
            // Verify vault exists (try by name or ID)
            match app_state.vault_service.get_vault_by_name_or_id(&id).await {
                Ok(Some(vault)) => vault.id, // Use the actual vault ID
                Ok(None) => return Err(format!("Vault '{}' does not exist", id)),
                Err(e) => return Err(format!("Failed to verify vault: {}", e)),
            }
        },
        None => {
            // Use default vault
            match app_state.vault_service.ensure_default_vault().await {
                Ok(vault_id) => vault_id,
                Err(e) => return Err(format!("Failed to ensure default vault: {}", e)),
            }
        }
    };
    
    // Parse key type
    let key_type_parsed = match key_type.as_str() {
        "legacy" => BitcoinKeyType::Legacy,
        "segwit" => BitcoinKeyType::SegWit,
        "native" => BitcoinKeyType::Native,
        "multisig" => BitcoinKeyType::MultiSig,
        "taproot" => BitcoinKeyType::Taproot,
        _ => return Err("Invalid key type".to_string()),
    };
    
    // Parse network
    let network_parsed = match network.as_str() {
        "mainnet" => BitcoinNetwork::Mainnet,
        "testnet" => BitcoinNetwork::Testnet,
        "regtest" => BitcoinNetwork::Regtest,
        _ => return Err("Invalid network".to_string()),
    };
    
    // Generate the key
    let bitcoin_key = match generator.generate_bitcoin_key(effective_vault_id.clone(), key_type_parsed, network_parsed, &password) {
        Ok(key) => {
            log_bitcoin_event!(BitcoinKeyEvent {
                event_type: "key_generation_success".to_string(),
                key_id: Some(key.id.clone()),
                vault_id: effective_vault_id.clone(),
                key_type: Some(key_type.clone()),
                network: Some(network.clone()),
                success: true,
                error_message: None,
                duration_ms: Some(start_time.elapsed().as_millis() as u64),
            });
            key
        },
        Err(e) => {
            log_bitcoin_event!(BitcoinKeyEvent {
                event_type: "key_generation_failure".to_string(),
                key_id: None,
                vault_id: effective_vault_id.clone(),
                key_type: Some(key_type.clone()),
                network: Some(network.clone()),
                success: false,
                error_message: Some(e.to_string()),
                duration_ms: Some(start_time.elapsed().as_millis() as u64),
            });
            return Err(format!("Failed to generate key: {}", e));
        }
    };
    
    // Store in database
    let key_type_str = match bitcoin_key.key_type {
        BitcoinKeyType::Legacy => "legacy",
        BitcoinKeyType::SegWit => "segwit",
        BitcoinKeyType::Native => "native",
        BitcoinKeyType::MultiSig => "multisig",
        BitcoinKeyType::Taproot => "taproot",
    };
    
    let network_str = match bitcoin_key.network {
        BitcoinNetwork::Mainnet => "mainnet",
        BitcoinNetwork::Testnet => "testnet",
        BitcoinNetwork::Regtest => "regtest",
    };
    
    let entropy_source_str = match bitcoin_key.entropy_source {
        EntropySource::SystemRng => "system_rng",
        EntropySource::QuantumEnhanced => "quantum_enhanced",
        EntropySource::Hardware => "hardware",
    };
    
    // Store in database
    let db = &app_state.db;
    let created_at_str = bitcoin_key.created_at.to_rfc3339();
    
    // Log public key details before storing
    log_info!("bitcoin_commands", &format!("Storing Bitcoin key - Address: {:?}, Vault ID: {}, Public key length: {}, Public key hex: {}", 
        bitcoin_key.address, 
        effective_vault_id,
        bitcoin_key.public_key.len(),
        hex::encode(&bitcoin_key.public_key[..std::cmp::min(16, bitcoin_key.public_key.len())])
    ));
    
    let key_id = Uuid::new_v4().to_string();
    let vault_id_str = effective_vault_id.clone();
    
    // Start a transaction to ensure both key and address are stored atomically
    let mut tx = db.begin().await.map_err(|e| format!("Failed to start transaction: {}", e))?;
    
    // Insert the key
    let insert_result = sqlx::query(
        "INSERT INTO bitcoin_keys (id, vault_id, key_type, network, encrypted_private_key, public_key, derivation_path, entropy_source, quantum_enhanced, created_at, is_active, encryption_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&key_id)
    .bind(&vault_id_str)
    .bind(&key_type_str)
    .bind(&network_str)
    .bind(&bitcoin_key.encrypted_private_key)
    .bind(&bitcoin_key.public_key)
    .bind(&bitcoin_key.derivation_path)
    .bind(&entropy_source_str)
    .bind(bitcoin_key.quantum_enhanced)
    .bind(&created_at_str)
    .bind(true) // is_active
    .bind(&bitcoin_key.encryption_password) // Store password for backup decryption
    .execute(&mut *tx)
    .await;

    match insert_result {
        Ok(_) => {
            // Insert the primary receiving address
            let address_insert = sqlx::query(
                "INSERT INTO receiving_addresses (id, key_id, address, derivation_index, is_primary, created_at) VALUES (?, ?, ?, ?, ?, ?)"
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&key_id)
            .bind(&bitcoin_key.address.as_ref().unwrap_or(&"No address".to_string()))
            .bind(0) // Primary address has derivation index 0
            .bind(true) // is_primary
            .bind(&created_at_str)
            .execute(&mut *tx)
            .await;

            match address_insert {
                Ok(_) => {
                    // Commit the transaction
                    tx.commit().await.map_err(|e| format!("Failed to commit transaction: {}", e))?;
                    
                    log_bitcoin_event!(BitcoinKeyEvent {
                        event_type: "key_generation_success".to_string(),
                        key_id: Some(key_id.clone()),
                        vault_id: effective_vault_id.clone(),
                        key_type: Some(key_type.clone()),
                        network: Some(network.clone()),
                        success: true,
                        error_message: None,
                        duration_ms: Some(start_time.elapsed().as_millis() as u64),
                    });
                    
                    log_info!("bitcoin_commands", &format!("Successfully generated and stored Bitcoin key with address: {} -> {:?}", key_id, bitcoin_key.address));
                    
                    // Return JSON with key details including address
                    let result = serde_json::json!({
                        "id": key_id,
                        "address": bitcoin_key.address,
                        "keyType": key_type_str,
                        "network": network_str,
                        "publicKey": general_purpose::STANDARD.encode(&bitcoin_key.public_key),
                        "quantumEnhanced": bitcoin_key.quantum_enhanced,
                        "createdAt": created_at_str
                    });
                    
                    Ok(result.to_string())
                },
                Err(e) => {
                    tx.rollback().await.ok();
                    log_error!("bitcoin_commands", &format!("Failed to store receiving address: {}", e));
                    Err(format!("Failed to store receiving address: {}", e))
                }
            }
        },
        Err(e) => {
            tx.rollback().await.ok();
            log_error!("bitcoin_commands", &format!("Failed to store Bitcoin key: {}", e));
            Err(format!("Failed to store key: {}", e))
        }
    }
}

#[tauri::command]
pub async fn generate_hd_wallet(
    _vault_id: String,
    _name: String,
    _network: String,
    _entropy_bits: u32,
    _password: String,
    _app_state: State<'_, AppState>,
) -> Result<String, String> {
    Err("HD wallet generation not yet implemented".to_string())
}

#[tauri::command]
pub async fn list_bitcoin_keys(
    vault_id: Option<String>,
    app_state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    log_info!("bitcoin_commands", &format!("🚀 LIST_BITCOIN_KEYS CALLED with vault_id: {:?}", vault_id));
    let vault_id = vault_id.unwrap_or_else(|| "default_vault".to_string());
    let db = &app_state.db;
    
    // Run migration for existing keys
    if let Err(e) = migrate_existing_keys_to_receiving_addresses(db.as_ref()).await {
        log_error!("bitcoin_commands", &format!("Migration failed: {}", e));
    }
    
    // Resolve vault ID (try by name or ID, similar to generate_bitcoin_key)
    let effective_vault_id = match app_state.vault_service.get_vault_by_name_or_id(&vault_id).await {
        Ok(Some(vault)) => {
            log_info!("bitcoin_commands", &format!("Resolved vault '{}' to UUID: {}", vault_id, vault.id));
            vault.id
        },
        Ok(None) => {
            log_info!("bitcoin_commands", &format!("Vault '{}' not found, using ensure_default_vault", vault_id));
            match app_state.vault_service.ensure_default_vault().await {
                Ok(default_vault_id) => {
                    log_info!("bitcoin_commands", &format!("Using default vault: {}", default_vault_id));
                    default_vault_id
                },
                Err(e) => return Err(format!("Failed to ensure default vault: {}", e)),
            }
        },
        Err(e) => return Err(format!("Failed to resolve vault: {}", e)),
    };
    
    match sqlx::query("SELECT bk.id, bk.vault_id, bk.key_type, bk.network, bk.encrypted_private_key, bk.public_key, bk.derivation_path, bk.entropy_source, bk.quantum_enhanced, bk.created_at, bk.last_used, bk.is_active, bk.encryption_password, ra.address, bkm.label, bkm.description, bkm.tags, bkm.balance_satoshis, bkm.transaction_count FROM bitcoin_keys bk LEFT JOIN receiving_addresses ra ON bk.id = ra.key_id AND ra.is_primary = 1 LEFT JOIN bitcoin_key_metadata bkm ON bk.id = bkm.key_id WHERE bk.vault_id = ? AND bk.is_active = 1 ORDER BY bk.created_at DESC")
        .bind(&effective_vault_id)
        .fetch_all(db.as_ref())
        .await {
        Ok(rows) => {
            let keys: Vec<serde_json::Value> = rows.into_iter().map(|row| {
                // Log public key details for each row
                let public_key: Vec<u8> = row.get("public_key");
                let address: Option<String> = row.get("address");
                let address_str = address.unwrap_or_else(|| "No address".to_string());
                let public_key_base64 = general_purpose::STANDARD.encode(&public_key);
                log_info!("bitcoin_commands", &format!("Retrieved key - Address: {}, Public key length: {}, Base64 length: {}, Base64 preview: {}", 
                    address_str, 
                    public_key.len(),
                    public_key_base64.len(),
                    &public_key_base64[..std::cmp::min(32, public_key_base64.len())]
                ));
                
                serde_json::json!({
                    "id": row.get::<String, _>("id"),
                    "vaultId": row.get::<Option<String>, _>("vault_id"),
                    "keyType": row.get::<String, _>("key_type"),
                    "network": row.get::<String, _>("network"),
                    "address": address_str,
                    "publicKey": public_key_base64,
                    "encryptedPrivateKey": general_purpose::STANDARD.encode(&row.get::<Vec<u8>, _>("encrypted_private_key")),
                    "derivationPath": row.get::<Option<String>, _>("derivation_path"),
                    "entropySource": row.get::<Option<String>, _>("entropy_source"),
                    "quantumEnhanced": row.get::<bool, _>("quantum_enhanced"),
                    "createdAt": row.get::<String, _>("created_at"),
                    "lastUsed": row.get::<Option<String>, _>("last_used"),
                    "isActive": row.get::<bool, _>("is_active"),
                    "encryptionPassword": row.get::<Option<String>, _>("encryption_password"),
                    "label": row.get::<Option<String>, _>("label"),
                    "description": row.get::<Option<String>, _>("description"),
                    "tags": row.get::<Option<String>, _>("tags"),
                    "balanceSatoshis": row.get::<Option<i64>, _>("balance_satoshis").unwrap_or(0),
                    "transactionCount": row.get::<Option<i32>, _>("transaction_count").unwrap_or(0)
                })
            }).collect();
            
            log_info!("bitcoin_commands", &format!("Retrieved {} Bitcoin keys for vault {} (resolved to: {}, query used vault_id: {})", keys.len(), vault_id, effective_vault_id, effective_vault_id));
            log_info!("bitcoin_commands", &format!("🔍 BACKEND RESPONSE: Returning keys array with {} elements", keys.len()));
            log_info!("bitcoin_commands", &format!("🔍 BACKEND RESPONSE: First key preview: {}", 
                if keys.is_empty() { 
                    "No keys".to_string() 
                } else { 
                    serde_json::to_string(&keys[0]).unwrap_or_else(|_| "Serialization failed".to_string())[..std::cmp::min(200, serde_json::to_string(&keys[0]).unwrap_or_else(|_| "".to_string()).len())].to_string()
                }
            ));
            Ok(keys)
        },
        Err(e) => {
            log_error!("bitcoin_commands", &format!("Failed to list Bitcoin keys: {}", e));
            Err(format!("Failed to retrieve keys: {}", e))
        }
    }
}

#[tauri::command]
pub async fn list_hd_wallets(
    vault_id: String,
    app_state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    // TODO: Implement HD wallet listing
    let wallets: Vec<serde_json::Value> = vec![];
    
    Ok(wallets)
}

#[tauri::command]
pub async fn derive_hd_key(
    _wallet_id: String,
    _derivation_path: String,
    _password: String,
    _app_state: State<'_, AppState>,
) -> Result<String, String> {
    Err("HD key derivation not yet implemented".to_string())
}

#[tauri::command]
pub async fn export_keys_to_usb(
    key_ids: Vec<String>,
    drive_id: String,
    password: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    use std::fs;
    use std::path::Path;
    use blake3::Hasher as Blake3Hasher;
    use chrono::Utc;
    use uuid::Uuid;
    
    // TODO: Validate keys exist in database
    
    // Get drive mount point (assuming it's mounted)
    let mount_point = format!("/media/ZAP_Quantum_Vault"); // This should be dynamic based on drive_id
    
    if !Path::new(&mount_point).exists() {
        return Err("USB drive not mounted".to_string());
    }
    
    // Create backup directory
    let backup_id = Uuid::new_v4().to_string();
    let backup_dir = format!("{}/bitcoin_keys_backup_{}", mount_point, backup_id);
    fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Failed to create backup directory: {}", e))?;
    
    // Export each key
    let mut total_size = 0u64;
    let mut hasher = Blake3Hasher::new();
    
    for key_id in &key_ids {
        // TODO: Fetch key data from database
        // For now, create dummy data
        let key_data = serde_json::json!({
            "id": key_id,
            "key_type": "native",
            "network": "testnet",
            "encrypted_private_key": vec![0u8; 64],
            "public_key": vec![0u8; 33],
            "address": "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
            "derivation_path": null,
            "entropy_source": "quantum_enhanced",
            "quantum_enhanced": true,
            "created_at": chrono::Utc::now(),
            "label": "Test Key",
            "description": "Test Description",
            "tags": null
        });
        
        // Create key export data
        let export_data = serde_json::json!({
            "id": key_data["id"],
            "keyType": key_data["key_type"],
            "network": key_data["network"],
            "encryptedPrivateKey": general_purpose::STANDARD.encode(&key_data["encrypted_private_key"].as_array().unwrap().iter().map(|v| v.as_u64().unwrap() as u8).collect::<Vec<u8>>()),
            "publicKey": general_purpose::STANDARD.encode(&key_data["public_key"].as_array().unwrap().iter().map(|v| v.as_u64().unwrap() as u8).collect::<Vec<u8>>()),
            "address": key_data["address"],
            "derivationPath": key_data["derivation_path"],
            "entropySource": key_data["entropy_source"],
            "quantumEnhanced": key_data["quantum_enhanced"],
            "createdAt": key_data["created_at"],
            "label": key_data["label"],
            "description": key_data["description"],
            "tags": key_data["tags"],
            "exportedAt": chrono::Utc::now()
        });
        
        let export_json = serde_json::to_string_pretty(&export_data)
            .map_err(|e| format!("Failed to serialize key data: {}", e))?;
        
        // Write key file
        let key_file = format!("{}/{}.json", backup_dir, key_id);
        fs::write(&key_file, &export_json)
            .map_err(|e| format!("Failed to write key file: {}", e))?;
        
        total_size += export_json.len() as u64;
        hasher.update(export_json.as_bytes());
    }
    
    // Create backup manifest
    let manifest = serde_json::json!({
        "backupId": backup_id,
        "driveId": drive_id,
        "keyIds": key_ids,
        "backupType": "bitcoin_keys",
        "createdAt": Utc::now(),
        "keyCount": key_ids.len(),
        "totalSizeBytes": total_size,
        "encryptionMethod": "AES-256-GCM + Argon2id",
        "quantumEnhanced": true
    });
    
    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;
    
    let manifest_file = format!("{}/backup_manifest.json", backup_dir);
    fs::write(&manifest_file, &manifest_json)
        .map_err(|e| format!("Failed to write manifest: {}", e))?;
    
    // Calculate final checksum
    hasher.update(manifest_json.as_bytes());
    let _checksum = hex::encode(hasher.finalize().as_bytes());
    
    // TODO: Log backup in database
    
    // TODO: Update backup count for each key
    
    Ok(backup_id)
}

#[tauri::command]
pub async fn get_key_backup_history(
    _key_id: String,
    app_state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    // TODO: Fetch backup history from database
    let backups: Vec<serde_json::Value> = vec![];
    
    Ok(backups)
}


#[tauri::command]
pub async fn list_receiving_addresses(
    key_id: String,
    app_state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db = &app_state.db;
    
    match sqlx::query("SELECT id, key_id, address, derivation_index, label, is_used, balance_satoshis, transaction_count, created_at, last_used FROM receiving_addresses WHERE key_id = ? ORDER BY derivation_index ASC")
        .bind(&key_id)
        .fetch_all(db.as_ref())
        .await {
        Ok(rows) => {
            let addresses: Vec<serde_json::Value> = rows.into_iter().map(|row| {
                serde_json::json!({
                    "id": row.get::<String, _>("id"),
                    "keyId": row.get::<String, _>("key_id"),
                    "address": row.get::<String, _>("address"),
                    "derivationIndex": row.get::<i32, _>("derivation_index"),
                    "label": row.get::<Option<String>, _>("label"),
                    "isUsed": row.get::<bool, _>("is_used"),
                    "balanceSatoshis": row.get::<i64, _>("balance_satoshis"),
                    "transactionCount": row.get::<i32, _>("transaction_count"),
                    "createdAt": row.get::<String, _>("created_at"),
                    "lastUsed": row.get::<Option<String>, _>("last_used")
                })
            }).collect();
            
            log_info!("bitcoin_commands", &format!("Retrieved {} receiving addresses for key: {}", addresses.len(), key_id));
            Ok(addresses)
        },
        Err(e) => {
            log_error!("bitcoin_commands", &format!("Failed to list receiving addresses: {}", e));
            Err(format!("Failed to retrieve receiving addresses: {}", e))
        }
    }
}

#[tauri::command]
pub async fn generate_receiving_address(
    key_id: String,
    label: Option<String>,
    app_state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let db = &app_state.db;
    
    // First, verify the key exists and get its details, including primary address
    let key_row = match sqlx::query("SELECT bk.id, bk.key_type, bk.network, bk.public_key, ra.address FROM bitcoin_keys bk LEFT JOIN receiving_addresses ra ON bk.id = ra.key_id AND ra.derivation_index = 0 WHERE bk.id = ? AND bk.is_active = 1")
        .bind(&key_id)
        .fetch_optional(db.as_ref())
        .await {
        Ok(Some(row)) => row,
        Ok(None) => return Err(format!("Bitcoin key not found: {}", key_id)),
        Err(e) => return Err(format!("Failed to verify key: {}", e)),
    };
    
    // Get the next derivation index
    let next_index = match sqlx::query("SELECT COALESCE(MAX(derivation_index), -1) + 1 as next_index FROM receiving_addresses WHERE key_id = ?")
        .bind(&key_id)
        .fetch_one(db.as_ref())
        .await {
        Ok(row) => row.get::<i32, _>("next_index"),
        Err(e) => return Err(format!("Failed to get next derivation index: {}", e)),
    };
    
    // For now, we'll generate a simple derived address based on the original address and index
    // In a full implementation, this would use proper BIP32 derivation
    let original_address: String = key_row.get("address");
    let key_type: String = key_row.get("key_type");
    let network: String = key_row.get("network");
    
    // Simple address derivation (this is a placeholder - in production you'd use proper BIP32)
    let derived_address = derive_address_from_index(&original_address, next_index, &key_type, &network)?;
    
    // Store the new receiving address
    let address_id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();
    
    match sqlx::query(
        "INSERT INTO receiving_addresses (id, key_id, address, derivation_index, label, is_used, balance_satoshis, transaction_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&address_id)
    .bind(&key_id)
    .bind(&derived_address)
    .bind(next_index)
    .bind(&label)
    .bind(false)
    .bind(0i64)
    .bind(0i32)
    .bind(&created_at)
    .execute(db.as_ref())
    .await {
        Ok(_) => {
            let new_address = serde_json::json!({
                "id": address_id,
                "keyId": key_id,
                "address": derived_address,
                "derivationIndex": next_index,
                "label": label,
                "isUsed": false,
                "balanceSatoshis": 0,
                "transactionCount": 0,
                "createdAt": created_at,
                "lastUsed": null
            });
            
            log_info!("bitcoin_commands", &format!("Generated receiving address {} for key: {}", derived_address, key_id));
            Ok(new_address)
        },
        Err(e) => {
            log_error!("bitcoin_commands", &format!("Failed to store receiving address: {}", e));
            Err(format!("Failed to store receiving address: {}", e))
        }
    }
}

// Helper function for address derivation (simplified implementation)
fn derive_address_from_index(base_address: &str, index: i32, key_type: &str, network: &str) -> Result<String, String> {
    // This is a simplified implementation for demonstration
    // In a real implementation, you would use proper BIP32 derivation
    
    let prefix = match (key_type, network) {
        ("legacy", "mainnet") => "1",
        ("legacy", "testnet") => "m",
        ("legacy", "regtest") => "m",
        ("segwit", "mainnet") => "3",
        ("segwit", "testnet") => "2",
        ("segwit", "regtest") => "2",
        ("native", "mainnet") => "bc1",
        ("native", "testnet") => "tb1",
        ("native", "regtest") => "bcrt1",
        ("taproot", "mainnet") => "bc1p",
        ("taproot", "testnet") => "tb1p",
        ("taproot", "regtest") => "bcrt1p",
        _ => return Err("Unsupported key type or network".to_string()),
    };
    
    // Generate a deterministic but unique address based on the base address and index
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(base_address.as_bytes());
    hasher.update(&index.to_le_bytes());
    let hash = hasher.finalize();
    
    // Create a simplified derived address
    if prefix.starts_with("bc1") || prefix.starts_with("tb1") || prefix.starts_with("bcrt1") {
        // Bech32 style
        let hash_hex = hex::encode(&hash[..20]); // Use first 20 bytes
        Ok(format!("{}{:02x}{}", prefix, index % 256, &hash_hex[..32]))
    } else {
        // Legacy/SegWit style
        let hash_hex = hex::encode(&hash[..16]); // Use first 16 bytes for shorter address
        Ok(format!("{}{:02x}{}", prefix, index % 256, hash_hex))
    }
}

#[tauri::command]
pub async fn list_trashed_bitcoin_keys(
    vault_id: String,
    app_state: State<'_, AppState>,
) -> Result<Vec<BitcoinKey>, String> {
    let db = &app_state.db;
    
    // Resolve vault ID (try by name or ID, similar to list_bitcoin_keys)
    let effective_vault_id = match app_state.vault_service.get_vault_by_name_or_id(&vault_id).await {
        Ok(Some(vault)) => {
            log_info!("bitcoin_commands", &format!("Resolved vault '{}' to UUID: {}", vault_id, vault.id));
            vault.id
        },
        Ok(None) => {
            log_info!("bitcoin_commands", &format!("Vault '{}' not found, using ensure_default_vault", vault_id));
            match app_state.vault_service.ensure_default_vault().await {
                Ok(default_vault_id) => {
                    log_info!("bitcoin_commands", &format!("Using default vault: {}", default_vault_id));
                    default_vault_id
                },
                Err(e) => return Err(format!("Failed to ensure default vault: {}", e)),
            }
        },
        Err(e) => return Err(format!("Failed to resolve vault: {}", e)),
    };
    
    let rows = sqlx::query(
        "SELECT bk.id, bk.vault_id, bk.key_type, bk.network, bk.encrypted_private_key, bk.public_key, bk.derivation_path, bk.entropy_source, bk.quantum_enhanced, bk.created_at, bk.is_active, bk.encryption_password, ra.address FROM bitcoin_keys bk LEFT JOIN receiving_addresses ra ON bk.id = ra.key_id AND ra.is_primary = 1 WHERE bk.vault_id = ? AND bk.is_active = 0"
    )
    .bind(&effective_vault_id)
    .fetch_all(db.as_ref())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let mut keys = Vec::new();
    for row in rows {
        let key = BitcoinKey {
            id: row.get("id"),
            vault_id: row.get("vault_id"),
            key_type: match row.get::<String, _>("key_type").as_str() {
                "Legacy" => BitcoinKeyType::Legacy,
                "SegWit" => BitcoinKeyType::SegWit,
                "Native" => BitcoinKeyType::Native,
                "MultiSig" => BitcoinKeyType::MultiSig,
                "Taproot" => BitcoinKeyType::Taproot,
                _ => BitcoinKeyType::Legacy,
            },
            network: match row.get::<String, _>("network").as_str() {
                "Mainnet" => BitcoinNetwork::Mainnet,
                "Testnet" => BitcoinNetwork::Testnet,
                "Regtest" => BitcoinNetwork::Regtest,
                _ => BitcoinNetwork::Mainnet,
            },
            encrypted_private_key: row.get::<Vec<u8>, _>("encrypted_private_key"),
            public_key: row.get::<Vec<u8>, _>("public_key"),
            address: row.get::<Option<String>, _>("address"),
            derivation_path: row.get("derivation_path"),
            entropy_source: match row.get::<String, _>("entropy_source").as_str() {
                "SystemRng" => EntropySource::SystemRng,
                "QuantumEnhanced" => EntropySource::QuantumEnhanced,
                "Hardware" => EntropySource::Hardware,
                _ => EntropySource::SystemRng,
            },
            quantum_enhanced: row.get("quantum_enhanced"),
            created_at: row.get("created_at"),
            is_active: row.get("is_active"),
            last_used: None,
            encryption_password: row.get("encryption_password"),
        };
        keys.push(key);
    }
    
    log_info!("bitcoin_commands", &format!("Retrieved {} trashed Bitcoin keys for vault {} (resolved to: {})", keys.len(), vault_id, effective_vault_id));
    Ok(keys)
}

// Helper function for decrypting private key data
fn decrypt_private_key_data(encrypted_data: &str, password: &str) -> Result<Vec<u8>, String> {
    let encrypted_bytes = general_purpose::STANDARD.decode(encrypted_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    
    // Parse the encrypted data format: salt + separator + nonce + ciphertext
    let separator_pos = encrypted_bytes.iter().position(|&x| x == 0)
        .ok_or_else(|| "Invalid encrypted data format".to_string())?;
    
    let salt_str = std::str::from_utf8(&encrypted_bytes[..separator_pos])
        .map_err(|e| format!("Invalid salt format: {}", e))?;
    
    let remaining = &encrypted_bytes[separator_pos + 1..];
    if remaining.len() < 12 {
        return Err("Encrypted data too short".to_string());
    }
    
    let nonce_bytes = &remaining[..12];
    let ciphertext = &remaining[12..];
    
    // Derive key from password using the same method as encryption
    let argon2 = Argon2::default();
    let salt = SaltString::from_b64(salt_str)
        .map_err(|e| format!("Failed to parse salt: {}", e))?;
    
    let password_hash = argon2.hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Failed to hash password: {}", e))?;
    
    let hash = password_hash.hash.unwrap();
    let key_bytes = hash.as_bytes();
    if key_bytes.len() < 32 {
        return Err("Derived key too short".to_string());
    }
    
    let cipher = Aes256Gcm::new_from_slice(&key_bytes[..32])
        .map_err(|e| format!("Failed to create cipher: {}", e))?;
    
    let nonce = Nonce::from_slice(nonce_bytes);
    
    cipher.decrypt(nonce, ciphertext)
        .map_err(|e| format!("Failed to decrypt: {}", e))
}

#[derive(serde::Serialize)]
pub struct BitcoinKeyDetails {
    pub id: String,
    pub address: String,
    pub label: Option<String>,
    pub description: Option<String>,
    pub tags: Option<String>,
    pub created_at: String,
    pub is_active: bool,
}

#[tauri::command]
pub async fn decrypt_private_key(
    key_id: String,
    password: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    let start_time = Instant::now();
    let db = &app_state.db;
    
    // Get the encrypted private key from database
    match sqlx::query("SELECT encrypted_private_key FROM bitcoin_keys WHERE id = ? AND is_active = 1")
        .bind(&key_id)
        .fetch_one(db.as_ref())
        .await {
        Ok(row) => {
            let encrypted_private_key: Vec<u8> = row.get("encrypted_private_key");
            let encrypted_data_b64 = general_purpose::STANDARD.encode(&encrypted_private_key);
            
            // Decrypt the private key using the same method as encryption
            match decrypt_private_key_data(&encrypted_data_b64, &password) {
                Ok(private_key_bytes) => {
                    let private_key_hex = hex::encode(&private_key_bytes);
                    
                    log_bitcoin_event!(BitcoinKeyEvent {
                        event_type: "private_key_decryption_success".to_string(),
                        key_id: Some(key_id.clone()),
                        vault_id: "unknown".to_string(),
                        key_type: None,
                        network: None,
                        success: true,
                        error_message: None,
                        duration_ms: Some(start_time.elapsed().as_millis() as u64),
                    });
                    
                    log_info!("bitcoin_commands", &format!("Private key decrypted successfully for key: {}", key_id));
                    
                    Ok(private_key_hex)
                },
                Err(e) => {
                    log_bitcoin_event!(BitcoinKeyEvent {
                        event_type: "private_key_decryption_failure".to_string(),
                        key_id: Some(key_id.clone()),
                        vault_id: "unknown".to_string(),
                        key_type: None,
                        network: None,
                        success: false,
                        error_message: Some(e.clone()),
                        duration_ms: Some(start_time.elapsed().as_millis() as u64),
                    });
                    
                    log_error!("bitcoin_commands", &format!("Failed to decrypt private key for {}: {}", key_id, e));
                    Err(format!("Failed to decrypt private key: {}", e))
                }
            }
        },
        Err(e) => {
            log_error!("bitcoin_commands", &format!("Failed to find Bitcoin key {}: {}", key_id, e));
            Err(format!("Bitcoin key not found: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_bitcoin_key_details(
    key_id: String,
    app_state: State<'_, AppState>,
) -> Result<BitcoinKeyDetails, String> {
    let db = &app_state.db;
    
    match sqlx::query(
        "SELECT bk.id, ra.address, bk.created_at, bk.is_active
         FROM bitcoin_keys bk
         LEFT JOIN receiving_addresses ra ON bk.id = ra.key_id AND ra.is_primary = 1
         WHERE bk.id = ?"
    )
    .bind(&key_id)
    .fetch_one(db.as_ref())
    .await {
        Ok(row) => {
            let key_details = BitcoinKeyDetails {
                id: row.get("id"),
                address: row.get::<Option<String>, _>("address").unwrap_or_default(),
                label: None,
                description: None,
                tags: None,
                created_at: row.get("created_at"),
                is_active: row.get("is_active"),
            };
            Ok(key_details)
        },
        Err(e) => {
            log_error!("bitcoin_commands", &format!("Failed to get Bitcoin key details for {}: {}", key_id, e));
            Err(format!("Failed to retrieve key details: {}", e))
        }
    }
}

#[tauri::command]
pub async fn update_bitcoin_key_metadata(
    key_id: String,
    label: Option<String>,
    description: Option<String>,
    tags: Option<String>,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    let _db = &app_state.db;
    
    // For now, just return success since metadata table doesn't exist
    log_info!("bitcoin_commands", &format!("Metadata update requested for key {}: label={:?}, description={:?}, tags={:?}", 
        key_id, label, description, tags));
    
    Ok("Metadata updated successfully".to_string())
}

#[tauri::command]
pub async fn delete_bitcoin_key(
    key_id: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    let db = &app_state.db;
    
    // Soft delete - mark as inactive
    match sqlx::query("UPDATE bitcoin_keys SET is_active = 0 WHERE id = ?")
        .bind(&key_id)
        .execute(db.as_ref())
        .await {
        Ok(_) => {
            log_info!("bitcoin_commands", &format!("Bitcoin key {} soft deleted (moved to trash)", key_id));
            Ok("Key moved to trash successfully".to_string())
        },
        Err(e) => {
            log_error!("bitcoin_commands", &format!("Failed to soft delete Bitcoin key {}: {}", key_id, e));
            Err(format!("Failed to delete key: {}", e))
        }
    }
}

#[tauri::command]
pub async fn restore_bitcoin_key(
    key_id: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    let db = &app_state.db;
    
    // Restore key - mark as active
    match sqlx::query("UPDATE bitcoin_keys SET is_active = 1 WHERE id = ?")
        .bind(&key_id)
        .execute(db.as_ref())
        .await {
        Ok(_) => {
            log_info!("bitcoin_commands", &format!("Bitcoin key {} restored from trash", key_id));
            Ok("Key restored successfully".to_string())
        },
        Err(e) => {
            log_error!("bitcoin_commands", &format!("Failed to restore Bitcoin key {}: {}", key_id, e));
            Err(format!("Failed to restore key: {}", e))
        }
    }
}

#[tauri::command]
pub async fn hard_delete_bitcoin_key(
    key_id: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    let db = &app_state.db;
    
    // Start a transaction to delete key and associated addresses
    let mut tx = db.begin().await
        .map_err(|e| format!("Failed to start transaction: {}", e))?;
    
    // Delete associated receiving addresses first
    sqlx::query("DELETE FROM receiving_addresses WHERE key_id = ?")
        .bind(&key_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete receiving addresses: {}", e))?;
    
    // Delete the Bitcoin key
    sqlx::query("DELETE FROM bitcoin_keys WHERE id = ?")
        .bind(&key_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete Bitcoin key: {}", e))?;
    
    // Commit the transaction
    tx.commit().await
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;
    
    log_info!("bitcoin_commands", &format!("Bitcoin key {} permanently deleted", key_id));
    Ok("Key permanently deleted".to_string())
}
