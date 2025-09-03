use std::time::Instant;
use tauri::State;
use sqlx::{SqlitePool, Row};
use base64::{Engine as _, engine::general_purpose};
use uuid::Uuid;
use crate::AppState;
use crate::ethereum_keys::{EthereumKey, EthereumKeyGenerator, EthereumKeyType, EthereumNetwork, EntropySource, EthereumKeyMetadata};
use argon2::{Argon2, PasswordHasher, password_hash::SaltString};
use aes_gcm::{Aes256Gcm, Nonce, aead::{Aead, KeyInit}};
use crate::{log_error, log_info};
use chrono::Utc;

#[tauri::command]
pub async fn generate_ethereum_key(
    vault_id: Option<String>,
    key_type: String,
    network: String,
    password: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    let start_time = Instant::now();
    let mut generator = EthereumKeyGenerator::new();
    
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
        "standard" => EthereumKeyType::Standard,
        "contract" => EthereumKeyType::Contract,
        "multisig" => EthereumKeyType::MultiSig,
        _ => return Err("Invalid key type".to_string()),
    };
    
    // Parse network
    let network_parsed = match network.as_str() {
        "mainnet" => EthereumNetwork::Mainnet,
        "goerli" => EthereumNetwork::Goerli,
        "sepolia" => EthereumNetwork::Sepolia,
        "polygon" => EthereumNetwork::Polygon,
        "bsc" => EthereumNetwork::BSC,
        "arbitrum" => EthereumNetwork::Arbitrum,
        "optimism" => EthereumNetwork::Optimism,
        _ => return Err("Invalid network".to_string()),
    };
    
    // Generate the key
    let ethereum_key = match generator.generate_ethereum_key(effective_vault_id.clone(), key_type_parsed, network_parsed, &password) {
        Ok(key) => {
            log_info!("ethereum_commands", &format!("Successfully generated Ethereum key: {}", key.id));
            key
        },
        Err(e) => {
            log_error!("ethereum_commands", &format!("Failed to generate Ethereum key: {}", e));
            return Err(format!("Failed to generate key: {}", e));
        }
    };
    
    // Store in database
    let key_type_str = match ethereum_key.key_type {
        EthereumKeyType::Standard => "standard",
        EthereumKeyType::Contract => "contract",
        EthereumKeyType::MultiSig => "multisig",
    };
    
    let network_str = match ethereum_key.network {
        EthereumNetwork::Mainnet => "mainnet",
        EthereumNetwork::Goerli => "goerli",
        EthereumNetwork::Sepolia => "sepolia",
        EthereumNetwork::Polygon => "polygon",
        EthereumNetwork::BSC => "bsc",
        EthereumNetwork::Arbitrum => "arbitrum",
        EthereumNetwork::Optimism => "optimism",
    };
    
    let entropy_source_str = match ethereum_key.entropy_source {
        EntropySource::SystemRng => "system_rng",
        EntropySource::QuantumEnhanced => "quantum_enhanced",
        EntropySource::Hardware => "hardware",
    };
    
    // Store in database
    let db = &app_state.db;
    let created_at_str = ethereum_key.created_at.to_rfc3339();
    
    log_info!("ethereum_commands", &format!("Storing Ethereum key - Address: {}, Vault ID: {}, Public key length: {}", 
        ethereum_key.address, 
        effective_vault_id,
        ethereum_key.public_key.len()
    ));
    
    let key_id = Uuid::new_v4().to_string();
    let vault_id_str = effective_vault_id.clone();
    
    // Start a transaction to ensure both key and metadata are stored atomically
    let mut tx = db.begin().await.map_err(|e| format!("Failed to start transaction: {}", e))?;
    
    // Insert the key
    let insert_result = sqlx::query(
        "INSERT INTO ethereum_keys (id, vault_id, key_type, network, encrypted_private_key, public_key, address, derivation_path, entropy_source, quantum_enhanced, created_at, is_active, encryption_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&key_id)
    .bind(&vault_id_str)
    .bind(&key_type_str)
    .bind(&network_str)
    .bind(&ethereum_key.encrypted_private_key)
    .bind(&ethereum_key.public_key)
    .bind(&ethereum_key.address)
    .bind(&ethereum_key.derivation_path)
    .bind(&entropy_source_str)
    .bind(ethereum_key.quantum_enhanced)
    .bind(&created_at_str)
    .bind(true) // is_active
    .bind(&ethereum_key.encryption_password)
    .execute(&mut *tx)
    .await;

    match insert_result {
        Ok(_) => {
            // Commit the transaction
            tx.commit().await.map_err(|e| format!("Failed to commit transaction: {}", e))?;
            
            log_info!("ethereum_commands", &format!("Successfully generated and stored Ethereum key with address: {} -> {}", key_id, ethereum_key.address));
            
            // Return JSON with key details
            let result = serde_json::json!({
                "id": key_id,
                "address": ethereum_key.address,
                "keyType": key_type_str,
                "network": network_str,
                "publicKey": general_purpose::STANDARD.encode(&ethereum_key.public_key),
                "quantumEnhanced": ethereum_key.quantum_enhanced,
                "createdAt": created_at_str
            });
            
            Ok(result.to_string())
        },
        Err(e) => {
            tx.rollback().await.ok();
            log_error!("ethereum_commands", &format!("Failed to store Ethereum key: {}", e));
            Err(format!("Failed to store key: {}", e))
        }
    }
}

#[tauri::command]
pub async fn list_ethereum_keys(
    vault_id: String,
    app_state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db = &app_state.db;
    
    // Resolve vault ID (try by name or ID, similar to generate_ethereum_key)
    let effective_vault_id = match app_state.vault_service.get_vault_by_name_or_id(&vault_id).await {
        Ok(Some(vault)) => {
            log_info!("ethereum_commands", &format!("Resolved vault '{}' to UUID: {}", vault_id, vault.id));
            vault.id
        },
        Ok(None) => {
            log_info!("ethereum_commands", &format!("Vault '{}' not found, using ensure_default_vault", vault_id));
            match app_state.vault_service.ensure_default_vault().await {
                Ok(default_vault_id) => {
                    log_info!("ethereum_commands", &format!("Using default vault: {}", default_vault_id));
                    default_vault_id
                },
                Err(e) => return Err(format!("Failed to ensure default vault: {}", e)),
            }
        },
        Err(e) => return Err(format!("Failed to resolve vault: {}", e)),
    };
    
    match sqlx::query("SELECT ek.id, ek.vault_id, ek.key_type, ek.network, ek.encrypted_private_key, ek.public_key, ek.address, ek.derivation_path, ek.entropy_source, ek.quantum_enhanced, ek.created_at, ek.last_used, ek.is_active, ek.encryption_password, ekm.label, ekm.description, ekm.tags, ekm.balance_wei, ekm.transaction_count FROM ethereum_keys ek LEFT JOIN ethereum_key_metadata ekm ON ek.id = ekm.key_id WHERE ek.vault_id = ? AND ek.is_active = 1 ORDER BY ek.created_at DESC")
        .bind(&effective_vault_id)
        .fetch_all(db.as_ref())
        .await {
        Ok(rows) => {
            let keys: Vec<serde_json::Value> = rows.into_iter().map(|row| {
                let public_key: Vec<u8> = row.get("public_key");
                let address: String = row.get("address");
                let public_key_base64 = general_purpose::STANDARD.encode(&public_key);
                
                log_info!("ethereum_commands", &format!("Retrieved key - Address: {}, Public key length: {}", 
                    address, 
                    public_key.len()
                ));
                
                serde_json::json!({
                    "id": row.get::<String, _>("id"),
                    "vaultId": row.get::<Option<String>, _>("vault_id"),
                    "keyType": row.get::<String, _>("key_type"),
                    "network": row.get::<String, _>("network"),
                    "address": address,
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
                    "balanceWei": row.get::<Option<String>, _>("balance_wei").unwrap_or_else(|| "0".to_string()),
                    "transactionCount": row.get::<Option<i32>, _>("transaction_count").unwrap_or(0)
                })
            }).collect();
            
            log_info!("ethereum_commands", &format!("Retrieved {} Ethereum keys for vault {} (resolved to: {})", keys.len(), vault_id, effective_vault_id));
            Ok(keys)
        },
        Err(e) => {
            log_error!("ethereum_commands", &format!("Failed to list Ethereum keys: {}", e));
            Err(format!("Failed to retrieve keys: {}", e))
        }
    }
}

#[tauri::command]
pub async fn decrypt_ethereum_private_key(
    key_id: String,
    password: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    let start_time = Instant::now();
    let db = &app_state.db;
    let generator = EthereumKeyGenerator::new();
    
    // Get the encrypted private key from database
    match sqlx::query("SELECT encrypted_private_key FROM ethereum_keys WHERE id = ? AND is_active = 1")
        .bind(&key_id)
        .fetch_one(db.as_ref())
        .await {
        Ok(row) => {
            let encrypted_private_key: Vec<u8> = row.get("encrypted_private_key");
            
            // Decrypt the private key
            match generator.decrypt_private_key(&encrypted_private_key, &password) {
                Ok(private_key_bytes) => {
                    let private_key_hex = hex::encode(&private_key_bytes);
                    
                    log_info!("ethereum_commands", &format!("Private key decrypted successfully for key: {}", key_id));
                    
                    Ok(private_key_hex)
                },
                Err(e) => {
                    log_error!("ethereum_commands", &format!("Failed to decrypt private key for key {}: {}", key_id, e));
                    Err(format!("Failed to decrypt private key: {}", e))
                }
            }
        },
        Err(e) => {
            log_error!("ethereum_commands", &format!("Failed to find Ethereum key {}: {}", key_id, e));
            Err(format!("Key not found: {}", e))
        }
    }
}

#[tauri::command]
pub async fn update_ethereum_key_metadata(
    key_id: String,
    label: Option<String>,
    description: Option<String>,
    tags: Option<Vec<String>>,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    let db = &app_state.db;
    
    // Convert tags to JSON string if provided
    let tags_json = match tags {
        Some(tag_list) => Some(serde_json::to_string(&tag_list)
            .map_err(|e| format!("Failed to serialize tags: {}", e))?),
        None => None,
    };
    
    match sqlx::query(
        "UPDATE ethereum_key_metadata SET label = ?, description = ?, tags = ?, updated_at = ? WHERE key_id = ?"
    )
    .bind(&label)
    .bind(&description)
    .bind(&tags_json)
    .bind(Utc::now().to_rfc3339())
    .bind(&key_id)
    .execute(db.as_ref())
    .await {
        Ok(_) => {
            log_info!("ethereum_commands", &format!("Updated metadata for Ethereum key: {}", key_id));
            Ok("Metadata updated successfully".to_string())
        },
        Err(e) => {
            log_error!("ethereum_commands", &format!("Failed to update metadata for key {}: {}", key_id, e));
            Err(format!("Failed to update metadata: {}", e))
        }
    }
}

#[tauri::command]
pub async fn trash_ethereum_key(
    key_id: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    let db = &app_state.db;
    
    match sqlx::query("UPDATE ethereum_keys SET is_active = 0 WHERE id = ?")
        .bind(&key_id)
        .execute(db.as_ref())
        .await {
        Ok(_) => {
            log_info!("ethereum_commands", &format!("Trashed Ethereum key: {}", key_id));
            Ok("Key moved to trash".to_string())
        },
        Err(e) => {
            log_error!("ethereum_commands", &format!("Failed to trash key {}: {}", key_id, e));
            Err(format!("Failed to trash key: {}", e))
        }
    }
}

#[tauri::command]
pub async fn restore_ethereum_key(
    key_id: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    let db = &app_state.db;
    
    match sqlx::query("UPDATE ethereum_keys SET is_active = 1 WHERE id = ?")
        .bind(&key_id)
        .execute(db.as_ref())
        .await {
        Ok(_) => {
            log_info!("ethereum_commands", &format!("Restored Ethereum key: {}", key_id));
            Ok("Key restored successfully".to_string())
        },
        Err(e) => {
            log_error!("ethereum_commands", &format!("Failed to restore key {}: {}", key_id, e));
            Err(format!("Failed to restore key: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_ethereum_network_info(
    network: String,
    app_state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let generator = EthereumKeyGenerator::new();
    
    let network_enum = match network.as_str() {
        "mainnet" => EthereumNetwork::Mainnet,
        "goerli" => EthereumNetwork::Goerli,
        "sepolia" => EthereumNetwork::Sepolia,
        "polygon" => EthereumNetwork::Polygon,
        "bsc" => EthereumNetwork::BSC,
        "arbitrum" => EthereumNetwork::Arbitrum,
        "optimism" => EthereumNetwork::Optimism,
        _ => return Err("Invalid network".to_string()),
    };
    
    let network_info = generator.get_network_info(&network_enum);
    
    let result = serde_json::json!({
        "name": network_info.name,
        "chainId": network_info.chain_id,
        "rpcUrl": network_info.rpc_url,
        "explorerUrl": network_info.explorer_url,
        "nativeCurrency": network_info.native_currency,
        "isTestnet": network_info.is_testnet
    });
    
    Ok(result)
}

#[tauri::command]
pub async fn get_ethereum_key_details(
    key_id: String,
    app_state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let db = &app_state.db;
    
    let row = match sqlx::query(
        "SELECT id, vault_id, key_type, network, address, public_key, derivation_path, 
         entropy_source, quantum_enhanced, created_at, last_used, is_active, encryption_password
         FROM ethereum_keys WHERE id = ? AND is_active = 1"
    )
    .bind(&key_id)
    .fetch_optional(db.as_ref())
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => return Err("Ethereum key not found".to_string()),
        Err(e) => {
            log_error!("ethereum_commands", &format!("Failed to fetch Ethereum key {}: {}", key_id, e));
            return Err(format!("Database error: {}", e));
        }
    };

    let result = serde_json::json!({
        "id": row.get::<String, _>("id"),
        "vaultId": row.get::<String, _>("vault_id"),
        "keyType": row.get::<String, _>("key_type"),
        "network": row.get::<String, _>("network"),
        "address": row.get::<String, _>("address"),
        "publicKey": general_purpose::STANDARD.encode(row.get::<Vec<u8>, _>("public_key")),
        "derivationPath": row.get::<Option<String>, _>("derivation_path"),
        "entropySource": row.get::<String, _>("entropy_source"),
        "quantumEnhanced": row.get::<bool, _>("quantum_enhanced"),
        "createdAt": row.get::<String, _>("created_at"),
        "lastUsed": row.get::<Option<String>, _>("last_used"),
        "isActive": row.get::<bool, _>("is_active"),
        "encryptionPassword": row.get::<Option<String>, _>("encryption_password")
    });

    Ok(result)
}

#[tauri::command]
pub async fn export_ethereum_keys_to_usb(
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
    
    let db = &app_state.db;
    
    // Get drive mount point (assuming it's mounted)
    let mount_point = format!("/media/ZAP_Quantum_Vault"); // This should be dynamic based on drive_id
    
    if !Path::new(&mount_point).exists() {
        return Err("USB drive not mounted".to_string());
    }
    
    // Create backup directory
    let backup_id = Uuid::new_v4().to_string();
    let backup_dir = format!("{}/ethereum_keys_backup_{}", mount_point, backup_id);
    fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Failed to create backup directory: {}", e))?;
    
    // Export each key
    let mut total_size = 0u64;
    let mut hasher = Blake3Hasher::new();
    
    for key_id in &key_ids {
        // Fetch key data from database
        match sqlx::query("SELECT ek.*, ekm.label, ekm.description, ekm.tags FROM ethereum_keys ek LEFT JOIN ethereum_key_metadata ekm ON ek.id = ekm.key_id WHERE ek.id = ?")
            .bind(key_id)
            .fetch_one(db.as_ref())
            .await {
            Ok(row) => {
                let export_data = serde_json::json!({
                    "id": row.get::<String, _>("id"),
                    "keyType": row.get::<String, _>("key_type"),
                    "network": row.get::<String, _>("network"),
                    "encryptedPrivateKey": general_purpose::STANDARD.encode(&row.get::<Vec<u8>, _>("encrypted_private_key")),
                    "publicKey": general_purpose::STANDARD.encode(&row.get::<Vec<u8>, _>("public_key")),
                    "address": row.get::<String, _>("address"),
                    "derivationPath": row.get::<Option<String>, _>("derivation_path"),
                    "entropySource": row.get::<String, _>("entropy_source"),
                    "quantumEnhanced": row.get::<bool, _>("quantum_enhanced"),
                    "createdAt": row.get::<String, _>("created_at"),
                    "label": row.get::<Option<String>, _>("label"),
                    "description": row.get::<Option<String>, _>("description"),
                    "tags": row.get::<Option<String>, _>("tags"),
                    "exportedAt": Utc::now().to_rfc3339()
                });
                
                let export_json = serde_json::to_string_pretty(&export_data)
                    .map_err(|e| format!("Failed to serialize key data: {}", e))?;
                
                // Write key file
                let key_file = format!("{}/{}.json", backup_dir, key_id);
                fs::write(&key_file, &export_json)
                    .map_err(|e| format!("Failed to write key file: {}", e))?;
                
                total_size += export_json.len() as u64;
                hasher.update(export_json.as_bytes());
            },
            Err(e) => {
                log_error!("ethereum_commands", &format!("Failed to fetch key {} for export: {}", key_id, e));
                return Err(format!("Failed to fetch key {}: {}", key_id, e));
            }
        }
    }
    
    // Create backup manifest
    let manifest = serde_json::json!({
        "backupId": backup_id,
        "driveId": drive_id,
        "keyIds": key_ids,
        "backupType": "ethereum_keys",
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
    
    log_info!("ethereum_commands", &format!("Successfully exported {} Ethereum keys to USB", key_ids.len()));
    
    Ok(backup_id)
}
