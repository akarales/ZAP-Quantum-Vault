use std::time::Instant;
use tauri::State;
use sqlx::{SqlitePool, Row};
use base64::{Engine as _, engine::general_purpose};
use crate::AppState;
use crate::bitcoin_keys::{SimpleBitcoinKeyGenerator, BitcoinKeyType, BitcoinNetwork};
use crate::{log_error, log_info, log_bitcoin_event};
use crate::logging::BitcoinKeyEvent;

#[tauri::command]
pub async fn decrypt_private_key(
    key_id: String,
    password: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    let start_time = Instant::now();
    let db = &app_state.db;
    
    // Get the encrypted private key from database
    match sqlx::query("SELECT encrypted_private_key, address FROM bitcoin_keys WHERE id = ? AND is_active = 1")
        .bind(&key_id)
        .fetch_one(db.as_ref())
        .await {
        Ok(row) => {
            let encrypted_private_key: String = row.get("encrypted_private_key");
            let address: String = row.get("address");
            // Decrypt the private key using the same method as encryption
            match decrypt_private_key_data(&encrypted_private_key, &password) {
                Ok(private_key_bytes) => {
                    let private_key_hex = hex::encode(&private_key_bytes);
                    
                    log_bitcoin_event!(BitcoinKeyEvent {
                        event_type: "private_key_decryption_success".to_string(),
                        key_id: Some(key_id.clone()),
                        vault_id: "unknown".to_string(), // We don't have vault_id in this context
                        key_type: None,
                        network: None,
                        success: true,
                        error_message: None,
                        duration_ms: Some(start_time.elapsed().as_millis() as u64),
                    });
                    
                    log_info!("bitcoin_key_commands", &format!("Private key decrypted successfully for address: {}", address));
                    
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
                        error_message: Some(e.to_string()),
                        duration_ms: Some(start_time.elapsed().as_millis() as u64),
                    });
                    
                    log_error!("bitcoin_key_commands", &format!("Failed to decrypt private key for {}: {}", key_id, e));
                    Err(format!("Failed to decrypt private key: {}", e))
                }
            }
        },
        Err(e) => {
            log_error!("bitcoin_key_commands", &format!("Failed to find Bitcoin key {}: {}", key_id, e));
            Err(format!("Key not found: {}", e))
        }
    }
}

fn decrypt_private_key_data(encrypted_data: &str, password: &str) -> Result<Vec<u8>, String> {
    use aes_gcm::{Aes256Gcm, Nonce, KeyInit};
    use aes_gcm::aead::Aead;
    use argon2::{Argon2, password_hash::{PasswordHasher, SaltString}};
    
    // Decode base64 encrypted data
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
    
    // Use the same method as encryption: hash_password then extract hash bytes
    let password_hash = argon2.hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Failed to derive key: {}", e))?;
    
    let hash = password_hash.hash.ok_or_else(|| "Failed to get hash bytes".to_string())?;
    let hash_bytes = hash.as_bytes();
    let mut derived_key = [0u8; 32];
    derived_key.copy_from_slice(&hash_bytes[..32]);
    
    // Decrypt with AES-256-GCM
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&derived_key);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(nonce_bytes);
    
    let plaintext = cipher.decrypt(nonce, ciphertext)
        .map_err(|e| format!("Failed to decrypt: {}", e))?;
    
    Ok(plaintext)
}

#[tauri::command]
pub async fn get_bitcoin_key_details(
    key_id: String,
    app_state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let db = &app_state.db;
    
    match sqlx::query("SELECT bk.id, bk.vault_id, bk.key_type, bk.network, bk.public_key, bk.address, bk.derivation_path, bk.entropy_source, bk.quantum_enhanced, bk.created_at, bk.last_used, bk.is_active, bkm.label, bkm.description, bkm.tags, bkm.balance_satoshis, bkm.transaction_count, bkm.last_transaction, bkm.backup_count, bkm.last_backup FROM bitcoin_keys bk LEFT JOIN bitcoin_key_metadata bkm ON bk.id = bkm.key_id WHERE bk.id = ? AND bk.is_active = 1")
        .bind(&key_id)
        .fetch_one(db.as_ref())
        .await {
        Ok(row) => {
            let key_details = serde_json::json!({
                "id": row.get::<String, _>("id"),
                "vaultId": row.get::<Option<String>, _>("vault_id"),
                "keyType": row.get::<String, _>("key_type"),
                "network": row.get::<String, _>("network"),
                "address": row.get::<String, _>("address"),
                "publicKey": general_purpose::STANDARD.encode(&row.get::<Vec<u8>, _>("public_key")),
                "derivationPath": row.get::<Option<String>, _>("derivation_path"),
                "entropySource": row.get::<Option<String>, _>("entropy_source"),
                "quantumEnhanced": row.get::<bool, _>("quantum_enhanced"),
                "createdAt": row.get::<String, _>("created_at"),
                "lastUsed": row.get::<Option<String>, _>("last_used"),
                "isActive": row.get::<bool, _>("is_active"),
                "label": row.get::<Option<String>, _>("label"),
                "description": row.get::<Option<String>, _>("description"),
                "tags": row.get::<Option<String>, _>("tags"),
                "balanceSatoshis": row.get::<Option<i64>, _>("balance_satoshis").unwrap_or(0),
                "transactionCount": row.get::<Option<i32>, _>("transaction_count").unwrap_or(0),
                "lastTransaction": row.get::<Option<String>, _>("last_transaction"),
                "backupCount": row.get::<Option<i32>, _>("backup_count").unwrap_or(0),
                "lastBackup": row.get::<Option<String>, _>("last_backup")
            });
            
            log_info!("bitcoin_key_commands", &format!("Retrieved details for Bitcoin key: {}", row.get::<String, _>("address")));
            Ok(key_details)
        },
        Err(e) => {
            log_error!("bitcoin_key_commands", &format!("Failed to get Bitcoin key details for {}: {}", key_id, e));
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
    let db = &app_state.db;
    
    match sqlx::query("UPDATE bitcoin_key_metadata SET label = COALESCE(?, label), description = COALESCE(?, description), tags = COALESCE(?, tags) WHERE key_id = ?")
        .bind(&label)
        .bind(&description)
        .bind(&tags)
        .bind(&key_id)
        .execute(db.as_ref())
        .await {
        Ok(_) => {
            log_info!("bitcoin_key_commands", &format!("Updated metadata for Bitcoin key: {}", key_id));
            Ok("Metadata updated successfully".to_string())
        },
        Err(e) => {
            log_error!("bitcoin_key_commands", &format!("Failed to update metadata for {}: {}", key_id, e));
            Err(format!("Failed to update metadata: {}", e))
        }
    }
}

#[tauri::command]
pub async fn delete_bitcoin_key(
    key_id: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    let db = &app_state.db;
    
    // Soft delete by setting is_active to false
    match sqlx::query("UPDATE bitcoin_keys SET is_active = 0 WHERE id = ?")
        .bind(&key_id)
        .execute(db.as_ref())
        .await {
        Ok(_) => {
            log_info!("bitcoin_key_commands", &format!("Soft deleted Bitcoin key: {}", key_id));
            Ok("Key deleted successfully".to_string())
        },
        Err(e) => {
            log_error!("bitcoin_key_commands", &format!("Failed to delete Bitcoin key {}: {}", key_id, e));
            Err(format!("Failed to delete key: {}", e))
        }
    }
}
