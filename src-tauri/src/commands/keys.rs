use tauri::State;
use std::sync::Mutex;
use crate::error::{Result, VaultError};
use crate::crypto::{mldsa87, address};
use crate::models::key::{KeyEntry, KeyType};

pub struct KeyStore(pub Mutex<Vec<KeyEntry>>);

#[tauri::command]
pub fn generate_key(
    key_type: String,
    purpose: u32,
    account: u32,
    index: u32,
    keystore: State<'_, KeyStore>,
) -> Result<KeyEntry> {
    let (pk, sk) = mldsa87::generate();
    let addr = address::derive_address(pk.as_bytes());

    let kt = match key_type.as_str() {
        "genesis" => KeyType::Genesis,
        "validator" => KeyType::Validator,
        "governance" => KeyType::Governance,
        "treasury" => KeyType::Treasury,
        "security" => KeyType::SecurityAdmin,
        "user" => KeyType::User,
        "quantum" => KeyType::QuantumSafe,
        "custom" => KeyType::Custom,
        _ => KeyType::Custom,
    };

    let entry = KeyEntry::new(
        kt,
        purpose,
        account,
        index,
        &pk.to_hex(),
        &sk.to_hex(),
        &addr,
    );

    let mut store = keystore.0.lock().unwrap();
    store.push(entry.clone());
    Ok(entry)
}

#[tauri::command]
pub fn list_keys(keystore: State<'_, KeyStore>) -> Result<Vec<KeyEntry>> {
    let store = keystore.0.lock().unwrap();
    Ok(store.clone())
}

#[tauri::command]
pub fn get_key_detail(
    key_id: String,
    keystore: State<'_, KeyStore>,
) -> Result<KeyEntry> {
    let store = keystore.0.lock().unwrap();
    store
        .iter()
        .find(|k| k.id == key_id)
        .cloned()
        .ok_or_else(|| VaultError::KeyNotFound(key_id))
}
