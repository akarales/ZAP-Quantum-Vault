use crate::AppState;
use crate::zap_blockchain_keys::{ZAPBlockchainKeyGenerator, ZAPBlockchainKey, ZAPKeyType, ZAPBlockchainNetworkConfig, ZAPGenesisKeyResponse, ZAPBlockchainKeyInfo, get_network_by_name, get_default_zap_networks};
use crate::{log_error, log_info};
use anyhow::{anyhow, Result};
use sqlx::{SqlitePool, Row};
use tauri::State;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono;
use base64;


#[tauri::command]
pub async fn generate_zap_genesis_keyset(
    network_name: String,
    validator_count: u32,
    governance_count: u32,
    emergency_count: u32,
    encryption_password: String,
    vault_id: Option<String>,
    app_state: State<'_, AppState>,
) -> Result<ZAPGenesisKeyResponse, String> {
    log_info!("zap_blockchain_commands", "🔐 ZAP Blockchain: Starting genesis keyset generation");
    log_info!("zap_blockchain_commands", &format!("📊 Parameters: network={}, validators={}, governance={}, emergency={}", 
        network_name, validator_count, governance_count, emergency_count));
    log_info!("zap_blockchain_commands", &format!("🔒 Encryption password length: {} characters", encryption_password.len()));
    log_info!("zap_blockchain_commands", &format!("🏛️ Vault ID: {:?}", vault_id));
    
    // Ensure vault exists or use default
    let effective_vault_id = match vault_id {
        Some(id) => {
            log_info!("zap_blockchain_commands", &format!("Resolving vault '{}'", id));
            match app_state.vault_service.get_vault_by_name_or_id(&id).await {
                Ok(Some(vault)) => {
                    log_info!("zap_blockchain_commands", &format!("Resolved vault '{}' to UUID: {}", id, vault.id));
                    vault.id
                },
                Ok(None) => {
                    log::error!("zap_blockchain_commands: Vault '{}' does not exist", id);
                    return Err(format!("Vault '{}' does not exist", id));
                },
                Err(e) => {
                    log::error!("zap_blockchain_commands: Failed to verify vault '{}': {}", id, e);
                    return Err(format!("Failed to verify vault: {}", e));
                }
            }
        },
        None => {
            log_info!("zap_blockchain_commands", "Using default vault");
            match app_state.vault_service.ensure_default_vault().await {
                Ok(vault_id) => {
                    log_info!("zap_blockchain_commands", &format!("Default vault resolved to UUID: {}", vault_id));
                    vault_id
                },
                Err(e) => {
                    log::error!("zap_blockchain_commands: Failed to ensure default vault: {}", e);
                    return Err(format!("Failed to ensure default vault: {}", e));
                }
            }
        }
    };

    // Get network configuration
    let network_config = get_network_by_name(&network_name)
        .ok_or_else(|| {
            log::error!("zap_blockchain_commands: Unknown ZAP network: {}", network_name);
            format!("Unknown ZAP network: {}", network_name)
        })?;
    
    log_info!("zap_blockchain_commands", &format!("Using network config - name: {}, chain_id: {}", 
              network_config.name, network_config.chain_id));

    // Generate genesis key set
    let generator = ZAPBlockchainKeyGenerator::new(network_config);
    log_info!("zap_blockchain_commands", "Generating genesis key set...");
    
    let genesis_keyset = generator.generate_genesis_keyset(
        validator_count,
        governance_count,
        emergency_count,
        Some(encryption_password.clone())
    ).map_err(|e| {
        log::error!("zap_blockchain_commands: Failed to generate genesis keyset: {}", e);
        format!("Failed to generate genesis keyset: {}", e)
    })?;

    let treasury_key_count = 1 + genesis_keyset.treasury_keys.multi_sig_keys.len() + 1; // master + multi_sig + backup
    log_info!("zap_blockchain_commands", &format!("Generated {} total keys", 
              1 + genesis_keyset.validator_keys.len() + treasury_key_count + genesis_keyset.governance_keys.len() + genesis_keyset.emergency_keys.len()));

    // Store keys in database with encryption
    log_info!("zap_blockchain_commands", "💾 Storing keys in database with encryption...");
    let mut tx = app_state.db.begin().await
        .map_err(|e| {
            log::error!("❌ Failed to start database transaction: {}", e);
            format!("Failed to start transaction: {}", e)
        })?;

    // Store chain genesis key
    log::debug!("🔑 Storing chain genesis key");
    store_zap_blockchain_key(&mut tx, &genesis_keyset.chain_genesis, &effective_vault_id).await?;
    
    // Store validator keys
    log::debug!("👥 Storing {} validator keys", genesis_keyset.validator_keys.len());
    for (i, validator_key) in genesis_keyset.validator_keys.iter().enumerate() {
        log::debug!("🔑 Storing validator key {}/{}", i + 1, genesis_keyset.validator_keys.len());
        store_zap_blockchain_key(&mut tx, validator_key, &effective_vault_id).await?;
    }
    
    // Store treasury keys
    log::debug!("💰 Storing treasury keys (master + multi-sig + backup)");
    store_zap_blockchain_key(&mut tx, &genesis_keyset.treasury_keys.master_key, &effective_vault_id).await?;
    for (i, multi_sig_key) in genesis_keyset.treasury_keys.multi_sig_keys.iter().enumerate() {
        log::debug!("🔑 Storing treasury multi-sig key {}/{}", i + 1, genesis_keyset.treasury_keys.multi_sig_keys.len());
        store_zap_blockchain_key(&mut tx, multi_sig_key, &effective_vault_id).await?;
    }
    store_zap_blockchain_key(&mut tx, &genesis_keyset.treasury_keys.backup_key, &effective_vault_id).await?;
    
    // Store governance keys
    log::debug!("🏛️ Storing {} governance keys", genesis_keyset.governance_keys.len());
    for (i, governance_key) in genesis_keyset.governance_keys.iter().enumerate() {
        log::debug!("🔑 Storing governance key {}/{}", i + 1, genesis_keyset.governance_keys.len());
        store_zap_blockchain_key(&mut tx, governance_key, &effective_vault_id).await?;
    }
    
    // Store emergency keys
    log::debug!("🚨 Storing {} emergency keys", genesis_keyset.emergency_keys.len());
    for (i, emergency_key) in genesis_keyset.emergency_keys.iter().enumerate() {
        log::debug!("🔑 Storing emergency key {}/{}", i + 1, genesis_keyset.emergency_keys.len());
        store_zap_blockchain_key(&mut tx, emergency_key, &effective_vault_id).await?;
    }

    tx.commit().await
        .map_err(|e| {
            log::error!("❌ Failed to commit database transaction: {}", e);
            format!("Failed to commit transaction: {}", e)
        })?;

    log_info!("zap_blockchain_commands", "✅ Successfully stored all genesis keys in database with encryption");

    // Create response with actual addresses
    let response = ZAPGenesisKeyResponse {
        key_set_id: genesis_keyset.key_set_id.clone(),
        network: genesis_keyset.network.clone(),
        total_keys: (1 + genesis_keyset.validator_keys.len() + treasury_key_count + genesis_keyset.governance_keys.len() + genesis_keyset.emergency_keys.len()) as u32,
        chain_genesis_address: genesis_keyset.chain_genesis.address.clone(),
        validator_addresses: genesis_keyset.validator_keys.iter()
            .map(|key| key.address.clone())
            .collect(),
        treasury_address: genesis_keyset.treasury_keys.master_key.address.clone(),
        governance_addresses: genesis_keyset.governance_keys.iter()
            .map(|key| key.address.clone())
            .collect(),
        emergency_addresses: genesis_keyset.emergency_keys.iter()
            .map(|key| key.address.clone())
            .collect(),
        generated_at: genesis_keyset.generated_at.clone(),
    };

    log_info!("zap_blockchain_commands", "ZAP genesis keyset generation completed successfully");
    Ok(response)
}

async fn store_zap_blockchain_key(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    key: &ZAPBlockchainKey,
    vault_id: &str,
) -> Result<(), String> {
    let key_type_str = match key.key_type {
        ZAPKeyType::Genesis => "genesis",
        ZAPKeyType::Validator => "validator", 
        ZAPKeyType::Treasury => "treasury",
        ZAPKeyType::Governance => "governance",
        ZAPKeyType::Emergency => "emergency",
        ZAPKeyType::Service => "service",
    };

    let metadata_json = serde_json::to_string(&key.metadata)
        .map_err(|e| {
            log::error!("❌ Failed to serialize metadata for key {}: {}", key.id, e);
            format!("Failed to serialize metadata: {}", e)
        })?;

    log::debug!("💾 Inserting key {} into database: type={}, role={}", key.id, key_type_str, key.key_role);

    sqlx::query(
        "INSERT INTO zap_blockchain_keys (
            id, vault_id, key_type, network_name, key_name, description,
            encrypted_private_key, public_key, address, derivation_path,
            entropy_source, encryption_password, quantum_enhanced, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&key.id)
    .bind(vault_id)
    .bind(key_type_str)
    .bind(&key.network_name)
    .bind(&key.key_role) // Using key_role as key_name
    .bind(format!("{} key for {}", key_type_str, key.network_name)) // description
    .bind(&key.encrypted_private_key)
    .bind(&key.public_key)
    .bind(&key.address)
    .bind(&key.derivation_path.as_deref().unwrap_or(""))
    .bind("quantum_enhanced")
    .bind(&key.encryption_password)
    .bind(true) // quantum_enhanced
    .bind(&metadata_json)
    .bind(&key.created_at)
    .execute(&mut **tx)
    .await
    .map_err(|e| {
        log::error!("❌ Failed to store ZAP blockchain key {} in database: {}", key.id, e);
        format!("Failed to store ZAP blockchain key: {}", e)
    })?;

    log::debug!("✅ Successfully stored key {} in database", key.id);
    Ok(())
}

#[tauri::command]
pub async fn list_zap_blockchain_keys(
    vault_id: Option<String>,
    key_type: Option<String>,
    app_state: State<'_, AppState>,
) -> Result<Vec<ZAPBlockchainKeyInfo>, String> {
    log_info!("zap_blockchain_commands", &format!("🚀 ZAP BLOCKCHAIN KEYS: Starting list_zap_blockchain_keys command"));
    log_info!("zap_blockchain_commands", &format!("📋 Input parameters - vault_id: {:?}, key_type: {:?}", vault_id, key_type));
    
    // Resolve vault ID using vault service (same pattern as Bitcoin/Ethereum commands)
    let effective_vault_id = match &vault_id {
        Some(id) => {
            // Try to resolve vault by name or ID
            match app_state.vault_service.get_vault_by_name_or_id(id).await {
                Ok(Some(vault)) => {
                    log_info!("zap_blockchain_commands", &format!("Resolved vault '{}' to UUID: {}", id, vault.id));
                    vault.id
                },
                Ok(None) => {
                    log_info!("zap_blockchain_commands", &format!("Vault '{}' not found, using ensure_default_vault", id));
                    match app_state.vault_service.ensure_default_vault().await {
                        Ok(default_vault_id) => {
                            log_info!("zap_blockchain_commands", &format!("Using default vault: {}", default_vault_id));
                            default_vault_id
                        },
                        Err(e) => return Err(format!("Failed to ensure default vault: {}", e)),
                    }
                },
                Err(e) => return Err(format!("Failed to verify vault: {}", e)),
            }
        },
        None => {
            log_info!("zap_blockchain_commands", "No vault_id provided, using ensure_default_vault");
            match app_state.vault_service.ensure_default_vault().await {
                Ok(default_vault_id) => {
                    log_info!("zap_blockchain_commands", &format!("Using default vault: {}", default_vault_id));
                    default_vault_id
                },
                Err(e) => return Err(format!("Failed to ensure default vault: {}", e)),
            }
        }
    };
    
    let rows = if let Some(kt) = &key_type {
        log_info!("zap_blockchain_commands", &format!("🔎 Querying with key type filter: {}", kt));
        sqlx::query("SELECT id, vault_id, key_type, key_name, network_name, address, public_key, encrypted_private_key, encryption_password, metadata, created_at, is_active FROM zap_blockchain_keys WHERE vault_id = ? AND is_active = 1 AND key_type = ? ORDER BY created_at DESC")
            .bind(&effective_vault_id)
            .bind(kt)
            .fetch_all(&*app_state.db)
            .await
    } else {
        log_info!("zap_blockchain_commands", "🔎 Querying all active keys for vault");
        sqlx::query("SELECT id, vault_id, key_type, key_name, network_name, address, public_key, encrypted_private_key, encryption_password, metadata, created_at, is_active FROM zap_blockchain_keys WHERE vault_id = ? AND is_active = 1 ORDER BY created_at DESC")
            .bind(&effective_vault_id)
            .fetch_all(&*app_state.db)
            .await
    }.map_err(|e| {
        log_error!("zap_blockchain_commands", &format!("❌ Database query failed: {}", e));
        format!("Failed to query ZAP blockchain keys: {}", e)
    })?;
    
    log_info!("zap_blockchain_commands", &format!("📊 Found {} ZAP blockchain keys in database", rows.len()));

    log_info!("zap_blockchain_commands", &format!("Found {} ZAP blockchain key rows in database", rows.len()));

    let keys: Result<Vec<ZAPBlockchainKeyInfo>, String> = rows
        .into_iter()
        .enumerate()
        .map(|(index, row)| -> Result<ZAPBlockchainKeyInfo, String> {
            log::debug!("🔍 Processing ZAP blockchain key row {}: id={}", index + 1, row.get::<String, _>("id"));
            
            let metadata_str: String = row.get("metadata");
            let metadata_json: serde_json::Value = serde_json::from_str(&metadata_str)
                .map_err(|e| {
                    log::error!("❌ Failed to parse metadata JSON for key {}: {}", row.get::<String, _>("id"), e);
                    format!("Failed to parse metadata JSON: {}", e)
                })?;
            
            let key_id: String = row.get("id");
            let key_type: String = row.get("key_type");
            let key_name: String = row.get("key_name");
            
            log_info!("zap_blockchain_commands", &format!("🔍 Processing key {} - id: {}, type: {}, name: {}", 
                      index + 1, key_id, key_type, key_name));
            
            Ok(ZAPBlockchainKeyInfo {
                id: key_id.clone(),
                vault_id: row.get("vault_id"),
                key_type: key_type.clone(),
                key_role: key_name.clone(), // Using key_name as key_role
                network_name: row.get("network_name"),
                algorithm: "quantum_safe".to_string(), // Default algorithm
                address: row.get("address"),
                public_key: String::from_utf8_lossy(&row.get::<Vec<u8>, _>("public_key")).to_string(),
                encrypted_private_key: base64::encode(row.get::<Vec<u8>, _>("encrypted_private_key")),
                encryption_password: row.get("encryption_password"),
                created_at: row.get("created_at"),
                metadata: metadata_json,
                is_active: row.get("is_active"),
            })
        })
        .collect();
    
    let keys = keys?;

    log_info!("zap_blockchain_commands", &format!("✅ Successfully processed {} ZAP blockchain keys for vault: {}", keys.len(), effective_vault_id));
    log_info!("zap_blockchain_commands", &format!("📋 Returning {} keys to frontend", keys.len()));
    Ok(keys)
}

#[tauri::command]
pub async fn get_zap_networks() -> Result<Vec<ZAPBlockchainNetworkConfig>, String> {
    Ok(get_default_zap_networks())
}

#[tauri::command]
pub async fn get_zap_blockchain_key_by_id(
    key_id: String,
    app_state: State<'_, AppState>,
) -> Result<ZAPBlockchainKeyInfo, String> {
    log_info!("zap_blockchain_commands", &format!("🔍 Getting ZAP blockchain key by ID: {}", key_id));
    log::debug!("📊 Database query for key details: {}", key_id);
    
    let row = sqlx::query(
        "SELECT id, vault_id, key_type, key_name, network_name, address, public_key, encrypted_private_key, encryption_password, metadata, created_at, is_active
        FROM zap_blockchain_keys 
        WHERE id = ? AND is_active = 1"
    )
    .bind(&key_id)
    .fetch_one(&*app_state.db)
    .await
    .map_err(|e| {
        log::error!("❌ Failed to fetch ZAP blockchain key {}: {}", key_id, e);
        format!("Failed to fetch ZAP blockchain key: {}", e)
    })?;
    
    log_info!("zap_blockchain_commands", &format!("✅ Successfully found key {} in database", key_id));

    let metadata_str: String = row.get("metadata");
    let metadata: serde_json::Value = serde_json::from_str(&metadata_str)
        .unwrap_or_else(|_| serde_json::json!({}));

    let key_info = ZAPBlockchainKeyInfo {
        id: row.get("id"),
        vault_id: row.get("vault_id"),
        key_type: row.get("key_type"),
        key_role: row.get("key_name"),
        network_name: row.get("network_name"),
        algorithm: "quantum_safe".to_string(), // Default algorithm
        address: row.get("address"),
        public_key: base64::encode(row.get::<Vec<u8>, _>("public_key")),
        encrypted_private_key: base64::encode(row.get::<Vec<u8>, _>("encrypted_private_key")),
        encryption_password: row.get("encryption_password"),
        created_at: row.get("created_at"),
        metadata,
        is_active: row.get("is_active"),
    };

    log_info!("zap_blockchain_commands", &format!("✅ Successfully retrieved ZAP blockchain key: {} (type: {})", key_info.key_role, key_info.key_type));
    log::debug!("📊 Key details: address={}, network={}", key_info.address, key_info.network_name);
    Ok(key_info)
}

#[tauri::command]
pub async fn delete_zap_blockchain_key(
    keyId: String,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    log_info!("zap_blockchain_commands", &format!("🗑️ Moving ZAP blockchain key to trash: {}", keyId));
    
    // First check if key exists and get its details for logging
    let key_info = sqlx::query("SELECT key_type, key_name, address, is_active FROM zap_blockchain_keys WHERE id = ?")
        .bind(&keyId)
        .fetch_optional(&*app_state.db)
        .await
        .map_err(|e| {
            log_error!("zap_blockchain_commands", &format!("❌ Failed to query key details for {}: {}", keyId, e));
            format!("Failed to query key details: {}", e)
        })?;

    match key_info {
        Some(row) => {
            let key_type: String = row.get("key_type");
            let key_name: String = row.get("key_name");
            let address: String = row.get("address");
            let is_active: bool = row.get("is_active");
            
            log_info!("zap_blockchain_commands", &format!("📋 Key details - Type: {}, Name: {}, Address: {}, Active: {}", 
                      key_type, key_name, address, is_active));
            
            if !is_active {
                log_info!("zap_blockchain_commands", &format!("⚠️ Key {} is already trashed", keyId));
                return Err("Key is already trashed".to_string());
            }
        },
        None => {
            log_error!("zap_blockchain_commands", &format!("❌ Key {} not found in database", keyId));
            return Err("ZAP blockchain key not found".to_string());
        }
    }
    
    let result = sqlx::query("UPDATE zap_blockchain_keys SET is_active = 0 WHERE id = ?")
        .bind(&keyId)
        .execute(&*app_state.db)
        .await
        .map_err(|e| {
            log_error!("zap_blockchain_commands", &format!("❌ Failed to trash ZAP blockchain key {}: {}", keyId, e));
            format!("Failed to trash ZAP blockchain key: {}", e)
        })?;

    if result.rows_affected() == 0 {
        log_error!("zap_blockchain_commands", &format!("❌ No rows affected when trashing key {}", keyId));
        return Err("Failed to trash key - no rows affected".to_string());
    }

    log_info!("zap_blockchain_commands", &format!("✅ Successfully moved ZAP blockchain key to trash: {} (rows affected: {})", 
              keyId, result.rows_affected()));
    Ok(())
}

#[tauri::command]
pub async fn export_zap_genesis_config(
    key_set_id: String,
    _app_state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    log_info!("zap_blockchain_commands", &format!("📤 Exporting ZAP genesis config for key set: {}", key_set_id));
    log::debug!("🔍 Querying database for genesis configuration data");
    
    // This would generate the actual genesis.json file for the ZAP blockchain
    // For now, return a placeholder structure
    let genesis_config = serde_json::json!({
        "genesis_time": chrono::Utc::now().to_rfc3339(),
        "chain_id": "zap-mainnet-1",
        "initial_height": "1",
        "consensus_params": {
            "block": {
                "max_bytes": "22020096",
                "max_gas": "-1"
            },
            "evidence": {
                "max_age_num_blocks": "100000",
                "max_age_duration": "172800000000000"
            },
            "validator": {
                "pub_key_types": ["ml-dsa-87"]
            }
        },
        "app_hash": "",
        "app_state": {
            "auth": {
                "params": {
                    "max_memo_characters": "256",
                    "tx_sig_limit": "7",
                    "tx_size_cost_per_byte": "10",
                    "sig_verify_cost_ml_dsa": "1000"
                }
            },
            "bank": {
                "params": {
                    "send_enabled": [],
                    "default_send_enabled": true
                },
                "balances": [],
                "supply": [],
                "denom_metadata": []
            },
            "staking": {
                "params": {
                    "unbonding_time": "1814400s",
                    "max_validators": 100,
                    "max_entries": 7,
                    "historical_entries": 10000,
                    "bond_denom": "uzap",
                    "min_commission_rate": "0.050000000000000000"
                },
                "last_total_power": "0",
                "last_validator_powers": [],
                "validators": [],
                "delegations": [],
                "unbonding_delegations": [],
                "redelegations": [],
                "exported": false
            }
        }
    });

    log_info!("zap_blockchain_commands", "Successfully exported ZAP genesis config");
    Ok(genesis_config)
}

#[tauri::command]
pub async fn list_trashed_zap_blockchain_keys(
    vault_id: Option<String>,
    app_state: State<'_, AppState>,
) -> Result<Vec<ZAPBlockchainKeyInfo>, String> {
    log_info!("zap_blockchain_commands", &format!("🗑️ LIST_TRASHED_ZAP_BLOCKCHAIN_KEYS CALLED with vault_id: {:?}", vault_id));
    
    // Resolve vault ID using vault service
    let effective_vault_id = match &vault_id {
        Some(id) => {
            match app_state.vault_service.get_vault_by_name_or_id(id).await {
                Ok(Some(vault)) => {
                    log_info!("zap_blockchain_commands", &format!("Resolved vault '{}' to UUID: {}", id, vault.id));
                    vault.id
                },
                Ok(None) => {
                    log_info!("zap_blockchain_commands", &format!("Vault '{}' not found, using ensure_default_vault", id));
                    match app_state.vault_service.ensure_default_vault().await {
                        Ok(default_vault_id) => {
                            log_info!("zap_blockchain_commands", &format!("Using default vault: {}", default_vault_id));
                            default_vault_id
                        },
                        Err(e) => return Err(format!("Failed to ensure default vault: {}", e)),
                    }
                },
                Err(e) => return Err(format!("Failed to verify vault: {}", e)),
            }
        },
        None => {
            log_info!("zap_blockchain_commands", "No vault_id provided, using ensure_default_vault");
            match app_state.vault_service.ensure_default_vault().await {
                Ok(default_vault_id) => {
                    log_info!("zap_blockchain_commands", &format!("Using default vault: {}", default_vault_id));
                    default_vault_id
                },
                Err(e) => return Err(format!("Failed to ensure default vault: {}", e)),
            }
        }
    };

    let rows = sqlx::query("SELECT id, vault_id, key_type, key_name, network_name, address, public_key, encrypted_private_key, encryption_password, metadata, created_at, is_active FROM zap_blockchain_keys WHERE vault_id = ? AND is_active = 0 ORDER BY created_at DESC")
        .bind(&effective_vault_id)
        .fetch_all(&*app_state.db)
        .await
        .map_err(|e| {
            log_error!("zap_blockchain_commands", &format!("❌ Database query failed: {}", e));
            format!("Failed to query trashed ZAP blockchain keys: {}", e)
        })?;

    log_info!("zap_blockchain_commands", &format!("📊 Found {} trashed ZAP blockchain keys", rows.len()));

    let keys: Result<Vec<ZAPBlockchainKeyInfo>, String> = rows
        .into_iter()
        .enumerate()
        .map(|(index, row)| -> Result<ZAPBlockchainKeyInfo, String> {
            let metadata_str: String = row.get("metadata");
            let metadata_json: serde_json::Value = serde_json::from_str(&metadata_str)
                .map_err(|e| {
                    log::error!("❌ Failed to parse metadata JSON for key {}: {}", row.get::<String, _>("id"), e);
                    format!("Failed to parse metadata JSON: {}", e)
                })?;
            
            let key_id: String = row.get("id");
            let key_type: String = row.get("key_type");
            let key_name: String = row.get("key_name");
            
            log_info!("zap_blockchain_commands", &format!("🔍 Processing trashed key {} - id: {}, type: {}, name: {}", 
                      index + 1, key_id, key_type, key_name));
            
            Ok(ZAPBlockchainKeyInfo {
                id: key_id.clone(),
                vault_id: row.get("vault_id"),
                key_type: key_type.clone(),
                key_role: key_name.clone(),
                network_name: row.get("network_name"),
                algorithm: "ML-KEM-1024 + ML-DSA-87".to_string(),
                address: row.get("address"),
                public_key: row.get("public_key"),
                encrypted_private_key: row.get("encrypted_private_key"),
                encryption_password: row.get("encryption_password"),
                created_at: row.get("created_at"),
                metadata: metadata_json,
                is_active: row.get("is_active"),
            })
        })
        .collect();
    
    let keys = keys?;
    log_info!("zap_blockchain_commands", &format!("✅ Successfully processed {} trashed ZAP blockchain keys", keys.len()));
    Ok(keys)
}

#[tauri::command]
pub async fn restore_zap_blockchain_key(
    keyId: String,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    log_info!("zap_blockchain_commands", &format!("🔄 Restoring ZAP blockchain key: {}", keyId));
    
    let result = sqlx::query("UPDATE zap_blockchain_keys SET is_active = 1 WHERE id = ?")
        .bind(&keyId)
        .execute(&*app_state.db)
        .await
        .map_err(|e| {
            log::error!("❌ Failed to restore ZAP blockchain key {}: {}", keyId, e);
            format!("Failed to restore ZAP blockchain key: {}", e)
        })?;

    if result.rows_affected() == 0 {
        log::warn!("⚠️ ZAP blockchain key not found for restoration: {}", keyId);
        return Err("ZAP blockchain key not found".to_string());
    }

    log_info!("zap_blockchain_commands", &format!("✅ Successfully restored ZAP blockchain key: {}", keyId));
    Ok(())
}

#[tauri::command]
pub async fn permanently_delete_zap_blockchain_key(
    key_id: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    log_info!("zap_blockchain_commands", &format!("Permanently deleting ZAP blockchain key: {}", &key_id));
    
    let db = &app_state.db;
    
    // Delete the key permanently
    let result = sqlx::query("DELETE FROM zap_blockchain_keys WHERE id = ?")
        .bind(&key_id)
        .execute(db.as_ref())
        .await
        .map_err(|e| {
            log_error!("zap_blockchain_commands", &format!("Failed to permanently delete ZAP blockchain key: {}", e));
            format!("Database error: {}", e)
        })?;
    
    if result.rows_affected() == 0 {
        return Err("Key not found".to_string());
    }
    
    log_info!("zap_blockchain_commands", &format!("Successfully permanently deleted ZAP blockchain key: {}", &key_id));
    Ok("Key permanently deleted successfully".to_string())
}

#[tauri::command]
pub async fn decrypt_zap_blockchain_private_key(
    key_id: String,
    password: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    log_info!("zap_blockchain_commands", &format!("Decrypting ZAP blockchain private key: {}", &key_id));
    
    let db = &app_state.db;
    
    // Get the key from database
    let row = sqlx::query("SELECT encrypted_private_key, encryption_password, network_name FROM zap_blockchain_keys WHERE id = ? AND is_active = 1")
        .bind(&key_id)
        .fetch_optional(db.as_ref())
        .await
        .map_err(|e| {
            log_error!("zap_blockchain_commands", &format!("Failed to fetch ZAP blockchain key: {}", e));
            format!("Database error: {}", e)
        })?;
    
    let row = row.ok_or_else(|| "Key not found".to_string())?;
    
    let encrypted_private_key_b64: String = row.get("encrypted_private_key");
    let stored_password: String = row.get("encryption_password");
    let network_name: String = row.get("network_name");
    
    // Verify the provided password matches the stored password
    if password != stored_password {
        return Err("Invalid password".to_string());
    }

    // Create network config and key generator
    let network_config = get_network_by_name(&network_name)
        .ok_or_else(|| format!("Unknown network: {}", network_name))?;
    
    let key_generator = ZAPBlockchainKeyGenerator::new(network_config);
    
    log_info!("zap_blockchain_commands", &format!("🔍 DECRYPTION AUDIT: Starting private key decryption"));
    log_info!("zap_blockchain_commands", &format!("🔍 DECRYPTION AUDIT: Key ID: {}", key_id));
    log_info!("zap_blockchain_commands", &format!("🔍 DECRYPTION AUDIT: Network: {}", network_name));
    log_info!("zap_blockchain_commands", &format!("🔍 DECRYPTION AUDIT: Encrypted data (base64) length: {}", encrypted_private_key_b64.len()));
    log_info!("zap_blockchain_commands", &format!("🔍 DECRYPTION AUDIT: Base64 preview: {}", &encrypted_private_key_b64[..std::cmp::min(50, encrypted_private_key_b64.len())]));
    log_info!("zap_blockchain_commands", &format!("🔍 DECRYPTION AUDIT: Password length: {}", password.len()));
    log_info!("zap_blockchain_commands", &format!("🔍 DECRYPTION AUDIT: Stored password: {}", stored_password));
    log_info!("zap_blockchain_commands", &format!("🔍 DECRYPTION AUDIT: Password match: {}", password == stored_password));
    
    // Try the key generator's decrypt method first (it expects base64 string)
    log_info!("zap_blockchain_commands", "🔍 DECRYPTION AUDIT: Attempting key generator decryption...");
    match key_generator.decrypt_private_key(&encrypted_private_key_b64, &password) {
        Ok(decrypted_key) => {
            log_info!("zap_blockchain_commands", &format!("✅ Key generator decrypt successful, length: {}", decrypted_key.len()));
            log_info!("zap_blockchain_commands", &format!("🔍 Decrypted preview: {}", &decrypted_key[..std::cmp::min(10, decrypted_key.len())]));
            log_info!("zap_blockchain_commands", &format!("🔍 Full decrypted key: {}", decrypted_key));
            
            // Check if this looks like a valid private key format
            if decrypted_key.len() == 64 && decrypted_key.chars().all(|c| c.is_ascii_hexdigit()) {
                log_info!("zap_blockchain_commands", "✅ Decrypted key appears to be valid 64-char hex private key");
                return Ok(decrypted_key);
            } else if decrypted_key.starts_with("0x") && decrypted_key.len() == 66 && decrypted_key[2..].chars().all(|c| c.is_ascii_hexdigit()) {
                log_info!("zap_blockchain_commands", "✅ Decrypted key appears to be valid 0x-prefixed hex private key");
                return Ok(decrypted_key);
            } else {
                log_info!("zap_blockchain_commands", &format!("⚠️ Decrypted key doesn't look like standard private key format. Length: {}, starts with: {}", decrypted_key.len(), &decrypted_key[..std::cmp::min(20, decrypted_key.len())]));
                // Still return it, but log the warning
                return Ok(decrypted_key);
            }
        }
        Err(e) => {
            log_error!("zap_blockchain_commands", &format!("❌ Key generator decrypt failed: {}", e));
            Err(format!("Failed to decrypt private key: {}", e))
        }
    }
}
