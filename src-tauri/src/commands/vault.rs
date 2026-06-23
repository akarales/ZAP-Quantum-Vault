use tauri::State;
use std::sync::Mutex;
use crate::error::{Result, VaultError};
use crate::crypto::{kdf, encryption};
use crate::models::vault::VaultState;

pub struct VaultMutex(pub Mutex<VaultState>);

#[tauri::command]
pub fn create_vault(
    password: String,
    state: State<'_, VaultMutex>,
) -> Result<String> {
    let mut vault = state.0.lock().unwrap();
    if vault.initialized {
        return Err(VaultError::AlreadyUnlocked);
    }

    let salt = kdf::generate_salt();
    let master_key = kdf::derive_master_key(password.as_bytes(), &salt)?;
    let enc_key = kdf::derive_encryption_key(&master_key, "vault_encryption");

    let verifier = b"ZAP_VAULT_VERIFIER";
    let ct = encryption::encrypt_vault(&enc_key, verifier)
        .map_err(|e| VaultError::Storage(e.to_string()))?;

    vault.salt_hex = hex::encode(salt);
    vault.verifier_hash_hex = hex::encode(ct.nonce) + ":" + &hex::encode(ct.ciphertext);
    vault.initialized = true;

    Ok("Vault created successfully".to_string())
}

#[tauri::command]
pub fn unlock_vault(
    password: String,
    state: State<'_, VaultMutex>,
) -> Result<bool> {
    let vault = state.0.lock().unwrap();
    if !vault.initialized {
        return Err(VaultError::NotInitialized);
    }

    let salt = hex::decode(&vault.salt_hex)
        .map_err(|e| VaultError::Storage(e.to_string()))?;
    let master_key = kdf::derive_master_key(password.as_bytes(), &salt)?;
    let enc_key = kdf::derive_encryption_key(&master_key, "vault_encryption");

    let parts: Vec<&str> = vault.verifier_hash_hex.split(':').collect();
    if parts.len() != 2 {
        return Err(VaultError::InvalidPassword);
    }

    let nonce = hex::decode(parts[0]).map_err(|e| VaultError::Storage(e.to_string()))?;
    let ciphertext = hex::decode(parts[1]).map_err(|e| VaultError::Storage(e.to_string()))?;

    let ct = encryption::Ciphertext { nonce, ciphertext };
    match encryption::decrypt_vault(&enc_key, &ct) {
        Ok(decrypted) if decrypted == b"ZAP_VAULT_VERIFIER" => Ok(true),
        _ => Err(VaultError::InvalidPassword),
    }
}

#[tauri::command]
pub fn lock_vault(state: State<'_, VaultMutex>) -> Result<()> {
    let vault = state.0.lock().unwrap();
    if !vault.initialized {
        return Err(VaultError::NotInitialized);
    }
    Ok(())
}
