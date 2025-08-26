use tauri::State;
use crate::state::AppState;
use anyhow::Result;
use serde_json;
use base64::{Engine as _, engine::general_purpose};

use crate::bitcoin_keys::{SimpleBitcoinKeyGenerator, BitcoinKeyType, BitcoinNetwork};
// use crate::database::Database; // Temporarily disabled
use crate::logging::BitcoinKeyEvent;
use crate::{log_error, log_info, log_warn, log_bitcoin_event};
use std::time::Instant;

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
            // Verify vault exists
            match app_state.vault_service.get_vault_by_id(&id).await {
                Ok(Some(_)) => id,
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
        crate::bitcoin_keys::EntropySource::SystemRng => "system_rng",
        crate::bitcoin_keys::EntropySource::QuantumEnhanced => "quantum_enhanced",
        crate::bitcoin_keys::EntropySource::Hardware => "hardware",
    };
    
    // Store in database
    let db = &app_state.db;
    let created_at_str = bitcoin_key.created_at.to_rfc3339();
    
    // Log public key details before storing
    log_info!("bitcoin_commands", &format!("Storing Bitcoin key - Address: {}, Public key length: {}, Public key hex: {}", 
        bitcoin_key.address, 
        bitcoin_key.public_key.len(),
        hex::encode(&bitcoin_key.public_key[..std::cmp::min(16, bitcoin_key.public_key.len())])
    ));
    
    match sqlx::query!(
        "INSERT INTO bitcoin_keys (id, vault_id, key_type, network, encrypted_private_key, public_key, address, derivation_path, entropy_source, quantum_enhanced, created_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        bitcoin_key.id,
        bitcoin_key.vault_id,
        key_type_str,
        network_str,
        bitcoin_key.encrypted_private_key,
        bitcoin_key.public_key,
        bitcoin_key.address,
        bitcoin_key.derivation_path,
        entropy_source_str,
        bitcoin_key.quantum_enhanced,
        created_at_str,
        bitcoin_key.is_active
    )
    .execute(db.as_ref())
    .await {
        Ok(_) => {
            log_info!("bitcoin_commands", &format!("Bitcoin key stored in database: {}", bitcoin_key.address));
        },
        Err(e) => {
            log_error!("bitcoin_commands", &format!("Failed to store Bitcoin key in database: {}", e));
            return Err(format!("Failed to store key in database: {}", e));
        }
    }
    
    // Also insert metadata record
    let label = format!("{} Key", key_type_str.to_uppercase());
    let description = format!("Quantum-enhanced {} key for {}", key_type_str, network_str);
    match sqlx::query!(
        "INSERT INTO bitcoin_key_metadata (key_id, label, description) VALUES (?, ?, ?)",
        bitcoin_key.id,
        label,
        description
    )
    .execute(db.as_ref())
    .await {
        Ok(_) => {},
        Err(e) => {
            log_warn!("bitcoin_commands", &format!("Failed to store Bitcoin key metadata: {}", e));
        }
    }
    
    // Return full key data as JSON for frontend
    let key_response = serde_json::json!({
        "id": bitcoin_key.id,
        "address": bitcoin_key.address,
        "keyType": key_type_str,
        "network": network_str,
        "publicKey": general_purpose::STANDARD.encode(&bitcoin_key.public_key),
        "entropySource": entropy_source_str,
        "quantumEnhanced": bitcoin_key.quantum_enhanced,
        "createdAt": bitcoin_key.created_at,
        "isActive": bitcoin_key.is_active,
        "encryptedPrivateKey": general_purpose::STANDARD.encode(&bitcoin_key.encrypted_private_key)
    });
    
    log_info!("bitcoin_commands", &format!("Bitcoin key generated and stored successfully: {}", bitcoin_key.address));
    
    Ok(serde_json::to_string(&key_response).unwrap_or_else(|_| bitcoin_key.id))
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
    vault_id: String,
    app_state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db = &app_state.db;
    
    match sqlx::query!(
        "SELECT bk.id, bk.vault_id, bk.key_type, bk.network, bk.encrypted_private_key, bk.public_key, bk.address, bk.derivation_path, bk.entropy_source, bk.quantum_enhanced, bk.created_at, bk.last_used, bk.is_active, bkm.label, bkm.description, bkm.tags, bkm.balance_satoshis, bkm.transaction_count FROM bitcoin_keys bk LEFT JOIN bitcoin_key_metadata bkm ON bk.id = bkm.key_id WHERE bk.vault_id = ? AND bk.is_active = 1 ORDER BY bk.created_at DESC",
        vault_id
    )
    .fetch_all(db.as_ref())
    .await {
        Ok(rows) => {
            let keys: Vec<serde_json::Value> = rows.into_iter().map(|row| {
                // Log public key details for each row
                let public_key_base64 = general_purpose::STANDARD.encode(&row.public_key);
                log_info!("bitcoin_commands", &format!("Retrieved key - Address: {}, Public key length: {}, Base64 length: {}, Base64 preview: {}", 
                    row.address, 
                    row.public_key.len(),
                    public_key_base64.len(),
                    &public_key_base64[..std::cmp::min(32, public_key_base64.len())]
                ));
                
                serde_json::json!({
                    "id": row.id,
                    "vaultId": row.vault_id,
                    "keyType": row.key_type,
                    "network": row.network,
                    "address": row.address,
                    "publicKey": public_key_base64,
                    "encryptedPrivateKey": general_purpose::STANDARD.encode(&row.encrypted_private_key),
                    "derivationPath": row.derivation_path,
                    "entropySource": row.entropy_source,
                    "quantumEnhanced": row.quantum_enhanced,
                    "createdAt": row.created_at,
                    "lastUsed": row.last_used,
                    "isActive": row.is_active,
                    "label": row.label,
                    "description": row.description,
                    "tags": row.tags,
                    "balanceSatoshis": row.balance_satoshis.unwrap_or(0),
                    "transactionCount": row.transaction_count.unwrap_or(0)
                })
            }).collect();
            
            log_info!("bitcoin_commands", &format!("Retrieved {} Bitcoin keys for vault {}", keys.len(), vault_id));
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
