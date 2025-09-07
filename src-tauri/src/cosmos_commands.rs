use crate::AppState;
use anyhow::{anyhow, Result};
use sqlx::{SqlitePool, Row};
use tauri::State;
use serde::{Deserialize, Serialize};
use aes_gcm::{Aes256Gcm, Nonce, aead::{Aead, KeyInit}};
use argon2::{Argon2, PasswordHasher, password_hash::{SaltString, PasswordHash, PasswordVerifier}};
use base64::{Engine as _, engine::general_purpose};
use rand::rngs::OsRng;
use uuid::Uuid;
use chrono;
use crate::cosmos_keys::{CosmosKeyGenerator, CosmosNetworkConfig, get_network_by_name, get_default_networks};

#[derive(Debug, Serialize, Deserialize)]
pub struct CosmosKeyInfo {
    pub id: String,
    pub vault_id: String,
    pub network_name: String,
    pub bech32_prefix: String,
    pub address: String,
    pub public_key: String,
    pub encrypted_private_key: String,
    pub derivation_path: Option<String>,
    pub description: Option<String>,
    pub quantum_enhanced: bool,
    pub created_at: String,
    pub updated_at: String,
    pub is_active: bool,
    pub entropy_source: String,
    pub encryption_password: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct CosmosKeyRow {
    pub id: String,
    pub vault_id: String,
    pub network_name: String,
    pub bech32_prefix: String,
    pub address: String,
    pub public_key: String,
    pub encrypted_private_key: String,
    pub derivation_path: Option<String>,
    pub description: Option<String>,
    pub quantum_enhanced: bool,
    pub created_at: String,
    pub updated_at: String,
    pub is_active: bool,
    pub entropy_source: String,
    pub encryption_password: Option<String>,
}

// Helper function to encrypt data using AES-256-GCM (same as Bitcoin commands)
fn encrypt_private_key(private_key: &str, password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut rand::thread_rng());
    let argon2 = Argon2::default();
    let password_hash = argon2.hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Password hashing failed: {}", e))?;
    
    let hash_bytes = password_hash.hash.unwrap();
    let key_bytes = hash_bytes.as_bytes()[..32].try_into()
        .map_err(|_| "Failed to create encryption key")?;
    
    let cipher = Aes256Gcm::new_from_slice(key_bytes)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;
    
    let nonce_bytes = rand::random::<[u8; 12]>();
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    let ciphertext = cipher.encrypt(nonce, private_key.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;
    
    let mut encrypted_data = Vec::new();
    let salt_bytes = salt.as_str().as_bytes();
    encrypted_data.push(salt_bytes.len() as u8); // Store salt length as first byte
    encrypted_data.extend_from_slice(salt_bytes);
    encrypted_data.extend_from_slice(&nonce_bytes);
    encrypted_data.extend_from_slice(&ciphertext);
    
    Ok(general_purpose::STANDARD.encode(encrypted_data))
}

// Helper function to decrypt data using AES-256-GCM (same as Bitcoin commands)
pub fn decrypt_private_key(encrypted_data: &str, password: &str) -> Result<String, String> {
    log::info!("=== COSMOS DECRYPTION AUDIT START ===");
    log::info!("Input encrypted_data length: {}", encrypted_data.len());
    log::info!("Input encrypted_data (first 50 chars): {}", &encrypted_data[..std::cmp::min(50, encrypted_data.len())]);
    log::info!("Password length: {}", password.len());
    
    // First, try to decode the base64 data
    let mut encrypted_bytes = general_purpose::STANDARD.decode(encrypted_data)
        .map_err(|e| {
            log::error!("AUDIT: Base64 decode failed: {}", e);
            format!("Base64 decode failed: {}", e)
        })?;
    
    log::info!("AUDIT: First base64 decode successful - length: {}, first_bytes: {:?}", 
        encrypted_bytes.len(), 
        &encrypted_bytes[..std::cmp::min(10, encrypted_bytes.len())]);
    
    // Check if this might be double base64 encoded (common issue)
    let is_ascii = encrypted_bytes.iter().all(|&b| b.is_ascii());
    log::info!("AUDIT: Data is ASCII: {}, length > 50: {}", is_ascii, encrypted_bytes.len() > 50);
    
    if encrypted_bytes.len() > 50 && is_ascii {
        let as_string = String::from_utf8_lossy(&encrypted_bytes);
        log::info!("AUDIT: Attempting second base64 decode on: {}", &as_string[..std::cmp::min(50, as_string.len())]);
        
        if let Ok(double_decoded) = general_purpose::STANDARD.decode(&*as_string) {
            log::info!("AUDIT: Double base64 decode successful - new length: {}", double_decoded.len());
            encrypted_bytes = double_decoded;
        } else {
            log::warn!("AUDIT: Second base64 decode failed, continuing with first decode");
        }
    } else {
        log::info!("AUDIT: Skipping double base64 decode check");
    }
    
    log::info!("AUDIT: Final encrypted_bytes - length: {}, first_bytes: {:?}", 
        encrypted_bytes.len(), 
        &encrypted_bytes[..std::cmp::min(10, encrypted_bytes.len())]);
    
    // Try new format first (with length byte) - but validate salt length is reasonable
    if encrypted_bytes.len() > 13 {
        let salt_len = encrypted_bytes[0] as usize;
        log::info!("AUDIT: New format check - salt_len: {}, total_len: {}", salt_len, encrypted_bytes.len());
        
        // Salt length should be reasonable (typically 22-44 chars for base64 encoded salt)
        if salt_len > 15 && salt_len < 50 && encrypted_bytes.len() >= salt_len + 13 {
            log::info!("AUDIT: Attempting new format decryption");
            match decrypt_new_format(&encrypted_bytes, password) {
                Ok(result) => {
                    log::info!("AUDIT: New format decryption SUCCESSFUL");
                    log::info!("=== COSMOS DECRYPTION AUDIT END (SUCCESS) ===");
                    return Ok(result);
                },
                Err(e) => {
                    log::warn!("AUDIT: New format decryption failed: {}", e);
                }
            }
        } else {
            log::warn!("AUDIT: Salt length {} is unreasonable (expected 15-50), skipping new format", salt_len);
        }
    } else {
        log::warn!("AUDIT: Data too short for new format (length: {})", encrypted_bytes.len());
    }
    
    // Try old format (legacy compatibility)
    if encrypted_bytes.len() >= 44 {
        log::info!("AUDIT: Attempting old format decryption");
        match decrypt_old_format(&encrypted_bytes, password) {
            Ok(result) => {
                log::info!("AUDIT: Old format decryption SUCCESSFUL");
                log::info!("=== COSMOS DECRYPTION AUDIT END (SUCCESS) ===");
                return Ok(result);
            },
            Err(e) => {
                log::error!("AUDIT: Old format decryption failed: {}", e);
                log::error!("=== COSMOS DECRYPTION AUDIT END (FAILURE) ===");
                return Err(format!("Both formats failed. Last error: {}", e));
            }
        }
    } else {
        log::error!("AUDIT: Data too short for any format (length: {})", encrypted_bytes.len());
    }
    
    log::error!("=== COSMOS DECRYPTION AUDIT END (FAILURE) ===");
    Err("Invalid encrypted data format - too short".to_string())
}

// New format decryption (with length byte)
fn decrypt_new_format(encrypted_bytes: &[u8], password: &str) -> Result<String, String> {
    log::info!("AUDIT: decrypt_new_format called");
    let salt_len = encrypted_bytes[0] as usize;
    log::info!("AUDIT: Salt length from first byte: {}", salt_len);
    
    if encrypted_bytes.len() < salt_len + 13 {
        let error_msg = format!("Invalid new format - insufficient length. Need: {}, Have: {}", salt_len + 13, encrypted_bytes.len());
        log::error!("AUDIT: {}", error_msg);
        return Err(error_msg);
    }
    
    let salt_bytes = &encrypted_bytes[1..salt_len + 1];
    let salt_str = std::str::from_utf8(salt_bytes)
        .map_err(|e| format!("Invalid salt UTF-8: {}", e))?;
    let salt = SaltString::from_b64(salt_str)
        .map_err(|e| format!("Invalid salt: {}", e))?;
    
    let nonce_bytes = &encrypted_bytes[salt_len + 1..salt_len + 13];
    let ciphertext = &encrypted_bytes[salt_len + 13..];
    
    decrypt_with_salt_and_nonce(&salt, nonce_bytes, ciphertext, password)
}

// Old format decryption (legacy compatibility)
fn decrypt_old_format(encrypted_bytes: &[u8], password: &str) -> Result<String, String> {
    let salt_bytes = &encrypted_bytes[0..32];
    let nonce_bytes = &encrypted_bytes[32..44];
    let ciphertext = &encrypted_bytes[44..];
    
    // Try to interpret salt_bytes as a salt string
    let salt_str = std::str::from_utf8(salt_bytes)
        .map_err(|e| format!("Invalid salt UTF-8: {}", e))?;
    let salt = SaltString::from_b64(salt_str)
        .map_err(|e| format!("Invalid salt: {}", e))?;
    
    decrypt_with_salt_and_nonce(&salt, nonce_bytes, ciphertext, password)
}

// Common decryption logic
fn decrypt_with_salt_and_nonce(salt: &SaltString, nonce_bytes: &[u8], ciphertext: &[u8], password: &str) -> Result<String, String> {
    let argon2 = Argon2::default();
    let password_hash = argon2.hash_password(password.as_bytes(), salt)
        .map_err(|e| format!("Password hashing failed: {}", e))?;
    
    let hash_bytes = password_hash.hash.unwrap();
    let key_bytes = hash_bytes.as_bytes()[..32].try_into()
        .map_err(|_| "Failed to create decryption key")?;
    
    let cipher = Aes256Gcm::new_from_slice(key_bytes)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;
    
    let nonce = Nonce::from_slice(nonce_bytes);
    
    let plaintext = cipher.decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed - wrong password?")?;
    
    String::from_utf8(plaintext)
        .map_err(|e| format!("Invalid UTF-8 in decrypted data: {}", e))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CosmosKeyResponse {
    pub id: String,
    pub address: String,
    pub public_key: String,
    pub network_name: String,
    pub bech32_prefix: String,
    pub derivation_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CosmosKeyListItem {
    pub id: String,
    pub vault_id: String,
    pub network_name: String,
    pub bech32_prefix: String,
    pub address: String,
    pub public_key: String,
    pub description: Option<String>,
    pub created_at: String,
    pub is_active: bool,
}

#[tauri::command]
pub async fn generate_cosmos_key(
    vault_id: Option<String>,
    network_name: String,
    password: String,
    description: Option<String>,
    app_state: State<'_, AppState>,
) -> Result<CosmosKeyResponse, String> {
    log::info!("cosmos_commands: Starting Cosmos key generation for network: {}", network_name);
    
    // Ensure vault exists or use default
    let effective_vault_id = match vault_id {
        Some(id) => {
            log::info!("cosmos_commands: Resolving vault '{}'", id);
            match app_state.vault_service.get_vault_by_name_or_id(&id).await {
                Ok(Some(vault)) => {
                    log::info!("cosmos_commands: Resolved vault '{}' to UUID: {}", id, vault.id);
                    vault.id
                },
                Ok(None) => {
                    log::error!("cosmos_commands: Vault '{}' does not exist", id);
                    return Err(format!("Vault '{}' does not exist", id));
                },
                Err(e) => {
                    log::error!("cosmos_commands: Failed to verify vault '{}': {}", id, e);
                    return Err(format!("Failed to verify vault: {}", e));
                }
            }
        },
        None => {
            log::info!("cosmos_commands: Using default vault");
            match app_state.vault_service.ensure_default_vault().await {
                Ok(vault_id) => {
                    log::info!("cosmos_commands: Default vault resolved to UUID: {}", vault_id);
                    vault_id
                },
                Err(e) => {
                    log::error!("cosmos_commands: Failed to ensure default vault: {}", e);
                    return Err(format!("Failed to ensure default vault: {}", e));
                }
            }
        }
    };

    // Get network configuration
    let network_config = get_network_by_name(&network_name)
        .ok_or_else(|| {
            log::error!("cosmos_commands: Unknown network: {}", network_name);
            format!("Unknown network: {}", network_name)
        })?;
    log::info!("cosmos_commands: Using network config - name: {}, prefix: {}", network_config.name, network_config.bech32_prefix);

    // Generate key pair
    let generator = CosmosKeyGenerator::new();
    log::info!("cosmos_commands: Generating key pair...");
    let key_pair = generator.generate_key_pair(&network_config)
        .map_err(|e| {
            log::error!("cosmos_commands: Failed to generate key pair: {}", e);
            format!("Failed to generate key pair: {}", e)
        })?;
    log::info!("cosmos_commands: Generated address: {}", key_pair.address);

    // Generate unique ID
    let key_id = Uuid::new_v4().to_string();
    log::info!("cosmos_commands: Generated key ID: {}", key_id);
    
    // Convert keys to hex
    let private_key_hex = generator.private_key_to_hex(&key_pair.private_key);
    let public_key_base64 = generator.public_key_to_base64(&key_pair.public_key);
    log::info!("cosmos_commands: Private key length: {}, Public key length: {}", private_key_hex.len(), public_key_base64.len());

    // Encrypt private key
    log::info!("cosmos_commands: Encrypting private key...");
    let encrypted_private_key = encrypt_private_key(&private_key_hex, &password)?;
    log::info!("cosmos_commands: Private key encrypted successfully");

    // Store in database
    let now = chrono::Utc::now().to_rfc3339();
    log::info!("cosmos_commands: Storing key in database - vault_id: {}, address: {}", effective_vault_id, key_pair.address);
    
    let result = sqlx::query(
        "INSERT INTO cosmos_keys (
            id, vault_id, network_name, bech32_prefix, address, public_key, 
            encrypted_private_key, derivation_path, description, quantum_enhanced,
            created_at, updated_at, is_active, encryption_password
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)"
    )
    .bind(&key_id)
    .bind(&effective_vault_id)
    .bind(&network_config.name)
    .bind(&network_config.bech32_prefix)
    .bind(&key_pair.address)
    .bind(&public_key_base64)
    .bind(&encrypted_private_key)
    .bind::<Option<String>>(None) // derivation_path
    .bind(&description)
    .bind(true) // quantum_enhanced
    .bind(&now)
    .bind(&now)
    .bind(true) // is_active
    .bind(&password) // encryption_password
    .execute(&*app_state.db)
    .await
    .map_err(|e| {
        log::error!("cosmos_commands: Failed to store key in database: {}", e);
        format!("Failed to store key in database: {}", e)
    })?;

    log::info!("cosmos_commands: Key stored successfully - rows affected: {}", result.rows_affected());
    log::info!("cosmos_commands: Cosmos key generation completed successfully for address: {}", key_pair.address);

    Ok(CosmosKeyResponse {
        id: key_id,
        address: key_pair.address,
        public_key: public_key_base64,
        network_name: network_config.name,
        bech32_prefix: network_config.bech32_prefix,
        derivation_path: None,
    })
}

#[tauri::command]
pub async fn list_cosmos_keys(
    vault_id: Option<String>,
    app_state: State<'_, AppState>,
) -> Result<Vec<CosmosKeyInfo>, String> {
    log::info!("cosmos_commands: Starting list_cosmos_keys - vault_id: {:?}", vault_id);
    let effective_vault_id = match &vault_id {
        Some(id) => {
            log::info!("cosmos_commands: Using provided vault_id: {}", id);
            id.clone()
        },
        None => {
            log::info!("cosmos_commands: No vault_id provided, getting default vault");
            // Get default vault
            match app_state.vault_service.ensure_default_vault().await {
                Ok(vault_id) => {
                    log::info!("cosmos_commands: Found default vault: {}", vault_id);
                    vault_id
                },
                Err(e) => {
                    log::error!("cosmos_commands: Failed to get default vault: {}", e);
                    return Err(format!("Failed to get default vault: {}", e));
                }
            }
        }
    };

    log::info!("cosmos_commands: Querying cosmos keys for vault_id: {}", effective_vault_id);

    // Query cosmos keys
    let rows = sqlx::query_as::<_, CosmosKeyRow>(
        "SELECT id, vault_id, network_name, bech32_prefix, address, public_key, 
         encrypted_private_key, derivation_path, description, quantum_enhanced,
         created_at, updated_at, is_active, COALESCE(entropy_source, 'system') as entropy_source,
         encryption_password
         FROM cosmos_keys 
         WHERE vault_id = $1 AND is_active = true 
         ORDER BY created_at DESC"
    )
    .bind(&effective_vault_id)
    .fetch_all(&*app_state.db)
    .await
    .map_err(|e| {
        log::error!("cosmos_commands: Failed to query cosmos keys: {}", e);
        format!("Failed to query cosmos keys: {}", e)
    })?;

    log::info!("cosmos_commands: Found {} cosmos key rows in database", rows.len());

    // Convert to response format
    let keys: Vec<CosmosKeyInfo> = rows
        .into_iter()
        .enumerate()
        .map(|(index, row)| {
            log::info!("cosmos_commands: Processing key {} - id: {}, address: {}, network: {}", 
                      index + 1, row.id, row.address, row.network_name);
            CosmosKeyInfo {
                id: row.id,
                vault_id: row.vault_id,
                network_name: row.network_name,
                bech32_prefix: row.bech32_prefix,
                address: row.address,
                public_key: row.public_key,
                encrypted_private_key: row.encrypted_private_key,
                derivation_path: row.derivation_path,
                description: row.description,
                quantum_enhanced: row.quantum_enhanced,
                created_at: row.created_at,
                updated_at: row.updated_at,
                is_active: row.is_active,
                entropy_source: row.entropy_source,
                encryption_password: row.encryption_password,
            }
        })
        .collect();

    log::info!("cosmos_commands: Retrieved {} Cosmos keys for vault {} (resolved to: {}, query used vault_id: {})", 
              keys.len(), 
              vault_id.as_deref().unwrap_or("default_vault"), 
              effective_vault_id, 
              effective_vault_id);
    Ok(keys)
}

#[tauri::command]
pub async fn decrypt_cosmos_key(
    key_id: String,
    password: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    let row = sqlx::query(
        "SELECT encrypted_private_key FROM cosmos_keys WHERE id = $1 AND is_active = 1"
    )
    .bind(&key_id)
    .fetch_one(&*app_state.db)
    .await
    .map_err(|e| format!("Key not found or database error: {}", e))?;

    let encrypted_private_key: String = row.get("encrypted_private_key");
    decrypt_private_key(&encrypted_private_key, &password)
}

#[tauri::command]
pub async fn delete_cosmos_key(
    key_id: String,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    let result = sqlx::query(
        "UPDATE cosmos_keys SET is_active = 0, updated_at = $1 WHERE id = $2"
    )
    .bind(&now)
    .bind(&key_id)
    .execute(&*app_state.db)
    .await
    .map_err(|e| format!("Failed to delete key: {}", e))?;

    if result.rows_affected() == 0 {
        return Err("Key not found".to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn get_cosmos_networks() -> Result<Vec<CosmosNetworkConfig>, String> {
    Ok(get_default_networks())
}

#[tauri::command]
pub async fn validate_cosmos_address(
    address: String,
    network_name: String,
) -> Result<bool, String> {
    let network_config = get_network_by_name(&network_name)
        .ok_or_else(|| format!("Unknown network: {}", network_name))?;

    let generator = CosmosKeyGenerator::new();
    let is_valid = generator.validate_address(&address, &network_config.bech32_prefix)
        .map_err(|e| format!("Address validation error: {}", e))?;

    Ok(is_valid)
}

#[tauri::command]
pub async fn get_cosmos_key_info(
    key_id: String,
    app_state: State<'_, AppState>,
) -> Result<CosmosKeyListItem, String> {
    let row = sqlx::query(
        "SELECT id, vault_id, network_name, bech32_prefix, address, public_key,
               description, created_at, is_active
        FROM cosmos_keys 
        WHERE id = $1"
    )
    .bind(&key_id)
    .fetch_one(&*app_state.db)
    .await
    .map_err(|e| format!("Key not found or database error: {}", e))?;

    Ok(CosmosKeyListItem {
        id: row.get("id"),
        vault_id: row.get("vault_id"),
        network_name: row.get("network_name"),
        bech32_prefix: row.get("bech32_prefix"),
        address: row.get("address"),
        public_key: row.get("public_key"),
        description: row.get("description"),
        created_at: row.get("created_at"),
        is_active: row.get("is_active"),
    })
}

#[tauri::command]
pub async fn update_cosmos_key_description(
    key_id: String,
    description: String,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    let result = sqlx::query(
        "UPDATE cosmos_keys SET description = $1, updated_at = $2 WHERE id = $3"
    )
    .bind(&description)
    .bind(&now)
    .bind(&key_id)
    .execute(&*app_state.db)
    .await
    .map_err(|e| format!("Failed to update description: {}", e))?;

    if result.rows_affected() == 0 {
        return Err("Key not found".to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn get_cosmos_key_by_id(
    key_id: String,
    app_state: State<'_, AppState>,
) -> Result<CosmosKeyInfo, String> {
    log::info!("cosmos_commands: Getting Cosmos key by ID: {}", key_id);
    
    let row = sqlx::query(
        "SELECT id, vault_id, network_name, bech32_prefix, address, public_key,
               encrypted_private_key, derivation_path, description, created_at, 
               updated_at, is_active, quantum_enhanced, entropy_source, encryption_password
        FROM cosmos_keys 
        WHERE id = $1"
    )
    .bind(&key_id)
    .fetch_one(&*app_state.db)
    .await
    .map_err(|e| {
        log::error!("cosmos_commands: Failed to fetch Cosmos key {}: {}", key_id, e);
        format!("Key not found or database error: {}", e)
    })?;

    let key_info = CosmosKeyInfo {
        id: row.get("id"),
        vault_id: row.get("vault_id"),
        network_name: row.get("network_name"),
        bech32_prefix: row.get("bech32_prefix"),
        address: row.get("address"),
        public_key: row.get("public_key"),
        encrypted_private_key: row.get("encrypted_private_key"),
        derivation_path: row.get("derivation_path"),
        description: row.get("description"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        is_active: row.get("is_active"),
        quantum_enhanced: row.get("quantum_enhanced"),
        entropy_source: row.get("entropy_source"),
        encryption_password: row.get("encryption_password"),
    };

    log::info!("cosmos_commands: Successfully retrieved Cosmos key: {}", key_info.address);
    Ok(key_info)
}

#[tauri::command]
pub async fn decrypt_cosmos_private_key(
    key_id: String,
    password: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    log::info!("=== COSMOS COMMAND AUDIT START ===");
    log::info!("AUDIT: decrypt_cosmos_private_key called with key_id: {}", key_id);
    log::info!("AUDIT: Password provided: {}, length: {}", !password.is_empty(), password.len());
    
    let row = sqlx::query(
        "SELECT encrypted_private_key, encryption_password FROM cosmos_keys WHERE id = $1 AND is_active = 1"
    )
    .bind(&key_id)
    .fetch_one(&*app_state.db)
    .await
    .map_err(|e| {
        log::error!("AUDIT: Database query failed for key {}: {}", key_id, e);
        format!("Key not found or database error: {}", e)
    })?;

    let encrypted_private_key: String = row.get("encrypted_private_key");
    let stored_password: Option<String> = row.get("encryption_password");
    
    log::info!("AUDIT: Retrieved encrypted_private_key length: {}", encrypted_private_key.len());
    log::info!("AUDIT: Stored password exists: {}", stored_password.is_some());
    
    // Use stored password if available, otherwise use provided password
    let password_to_use = if let Some(stored_pwd) = &stored_password {
        log::info!("AUDIT: Using stored password (length: {})", stored_pwd.len());
        stored_pwd
    } else {
        log::info!("AUDIT: Using provided password (length: {})", password.len());
        &password
    };
    
    log::info!("AUDIT: About to call decrypt_private_key with encrypted data (first 50 chars): {}", 
        &encrypted_private_key[..std::cmp::min(50, encrypted_private_key.len())]);
    
    let decrypted_key = decrypt_private_key(&encrypted_private_key, password_to_use)
        .map_err(|e| {
            log::error!("AUDIT: decrypt_private_key failed for {}: {}", key_id, e);
            format!("Failed to decrypt private key: {}", e)
        })?;

    log::info!("AUDIT: Successfully decrypted private key for: {}", key_id);
    log::info!("=== COSMOS COMMAND AUDIT END (SUCCESS) ===");
    Ok(decrypted_key)
}

#[tauri::command]
pub async fn export_cosmos_key(
    key_id: String,
    password: String,
    app_state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    log::info!("cosmos_commands: Exporting Cosmos key: {}", key_id);
    
    let key_info = get_cosmos_key_by_id(key_id.clone(), app_state.clone()).await?;
    let private_key = decrypt_cosmos_private_key(key_id, password, app_state).await?;
    
    let export_data = serde_json::json!({
        "type": "cosmos_key_export",
        "version": "1.0",
        "key_data": {
            "id": key_info.id,
            "network": key_info.network_name,
            "address": key_info.address,
            "public_key": key_info.public_key,
            "private_key": private_key,
            "bech32_prefix": key_info.bech32_prefix,
            "description": key_info.description,
            "created_at": key_info.created_at,
            "quantum_enhanced": key_info.quantum_enhanced,
            "entropy_source": key_info.entropy_source
        },
        "export_metadata": {
            "exported_at": chrono::Utc::now().to_rfc3339(),
            "exported_by": "zap_vault"
        }
    });

    log::info!("cosmos_commands: Successfully exported Cosmos key: {}", key_info.address);
    Ok(export_data)
}

#[tauri::command]
pub async fn trash_cosmos_key(
    key_id: String,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    log::info!("cosmos_commands: Moving Cosmos key to trash: {}", key_id);
    
    sqlx::query("UPDATE cosmos_keys SET is_active = false WHERE id = $1")
        .bind(&key_id)
        .execute(&*app_state.db)
        .await
        .map_err(|e| {
            log::error!("cosmos_commands: Failed to trash Cosmos key {}: {}", key_id, e);
            format!("Failed to move key to trash: {}", e)
        })?;

    log::info!("cosmos_commands: Successfully moved Cosmos key to trash: {}", key_id);
    Ok(())
}

#[tauri::command]
pub async fn restore_cosmos_key(
    key_id: String,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    log::info!("cosmos_commands: Restoring Cosmos key from trash: {}", key_id);
    
    sqlx::query("UPDATE cosmos_keys SET is_active = true WHERE id = $1")
        .bind(&key_id)
        .execute(&*app_state.db)
        .await
        .map_err(|e| {
            log::error!("cosmos_commands: Failed to restore Cosmos key {}: {}", key_id, e);
            format!("Failed to restore key: {}", e)
        })?;

    log::info!("cosmos_commands: Successfully restored Cosmos key: {}", key_id);
    Ok(())
}

#[tauri::command]
pub async fn list_trashed_cosmos_keys(
    vault_id: Option<String>,
    app_state: State<'_, AppState>,
) -> Result<Vec<CosmosKeyInfo>, String> {
    log::info!("cosmos_commands: Starting list_trashed_cosmos_keys - vault_id: {:?}", vault_id);
    let effective_vault_id = match &vault_id {
        Some(id) => {
            log::info!("cosmos_commands: Using provided vault_id: {}", id);
            id.clone()
        },
        None => {
            log::info!("cosmos_commands: No vault_id provided, getting default vault");
            match app_state.vault_service.ensure_default_vault().await {
                Ok(vault_id) => {
                    log::info!("cosmos_commands: Found default vault: {}", vault_id);
                    vault_id
                },
                Err(e) => {
                    log::error!("cosmos_commands: Failed to get default vault: {}", e);
                    return Err(format!("Failed to get default vault: {}", e));
                }
            }
        }
    };

    log::info!("cosmos_commands: Querying trashed cosmos keys for vault_id: {}", effective_vault_id);

    // Query trashed cosmos keys (is_active = false)
    let rows = sqlx::query_as::<_, CosmosKeyRow>(
        "SELECT id, vault_id, network_name, bech32_prefix, address, public_key, 
         encrypted_private_key, derivation_path, description, quantum_enhanced,
         created_at, updated_at, is_active, COALESCE(entropy_source, 'system') as entropy_source,
         encryption_password
         FROM cosmos_keys 
         WHERE vault_id = $1 AND is_active = false 
         ORDER BY created_at DESC"
    )
    .bind(&effective_vault_id)
    .fetch_all(&*app_state.db)
    .await
    .map_err(|e| {
        log::error!("cosmos_commands: Failed to query trashed cosmos keys: {}", e);
        format!("Failed to query trashed cosmos keys: {}", e)
    })?;

    // Convert to response format
    let keys: Vec<CosmosKeyInfo> = rows
        .into_iter()
        .enumerate()
        .map(|(index, row)| {
            log::info!("cosmos_commands: Processing trashed key {} - id: {}, address: {}, network: {}", 
                      index + 1, row.id, row.address, row.network_name);
            CosmosKeyInfo {
                id: row.id,
                vault_id: row.vault_id,
                network_name: row.network_name,
                bech32_prefix: row.bech32_prefix,
                address: row.address,
                public_key: row.public_key,
                encrypted_private_key: row.encrypted_private_key,
                derivation_path: row.derivation_path,
                description: row.description,
                quantum_enhanced: row.quantum_enhanced,
                created_at: row.created_at,
                updated_at: row.updated_at,
                is_active: row.is_active,
                entropy_source: row.entropy_source,
                encryption_password: row.encryption_password,
            }
        })
        .collect();

    log::info!("cosmos_commands: Retrieved {} trashed Cosmos keys for vault {} (resolved to: {}, query used vault_id: {})", 
              keys.len(), 
              vault_id.as_deref().unwrap_or("default_vault"), 
              effective_vault_id, 
              effective_vault_id);
    Ok(keys)
}

#[tauri::command]
pub async fn delete_cosmos_key_permanently(
    app_state: tauri::State<'_, AppState>,
    key_id: String,
) -> Result<(), String> {
    log::info!("cosmos_commands: Permanently deleting Cosmos key with ID: {}", key_id);

    let result = sqlx::query("DELETE FROM cosmos_keys WHERE id = $1")
        .bind(&key_id)
        .execute(&*app_state.db)
        .await
        .map_err(|e| {
            log::error!("cosmos_commands: Failed to permanently delete Cosmos key {}: {}", key_id, e);
            format!("Failed to permanently delete Cosmos key: {}", e)
        })?;

    if result.rows_affected() == 0 {
        log::warn!("cosmos_commands: No Cosmos key found with ID {} for permanent deletion", key_id);
        return Err("Cosmos key not found".to_string());
    }

    log::info!("cosmos_commands: Successfully permanently deleted Cosmos key with ID: {}", key_id);
    Ok(())
}
