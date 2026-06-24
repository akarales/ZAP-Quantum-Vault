use tauri::{State, AppHandle, Manager};
use std::sync::Mutex;
use std::path::{Path, PathBuf};
use crate::error::{Result, VaultError};
use crate::crypto::{mldsa87, address, encryption};
use crate::crypto::encryption::Ciphertext;
use crate::models::key::{KeyEntry, KeyEntryPublic, KeyType};
use crate::commands::vault::VaultMutex;
use zeroize::Zeroizing;

pub struct KeyStore(pub Mutex<Vec<KeyEntry>>);

/// Holds the AES-256-GCM key derived from the user's password for the current
/// unlocked session. `None` whenever the vault is locked. The key is wrapped in
/// `Zeroizing` so its bytes are wiped from memory as soon as the session is
/// replaced (re-key) or cleared (lock).
pub struct SessionKey(pub Mutex<Option<Zeroizing<[u8; 32]>>>);

/// The app's local data directory, created if missing. On Unix the directory is
/// restricted to owner-only access (`0700`) so other local users can't list or
/// read the vault/keystore files.
pub fn data_dir(app: &AppHandle) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| VaultError::Storage(e.to_string()))?;
    std::fs::create_dir_all(&dir).map_err(|e| VaultError::Storage(e.to_string()))?;
    restrict_dir_permissions(&dir)?;
    Ok(dir)
}

/// Resolve the on-disk path of a named encrypted keystore file.
pub fn keys_file_path(app: &AppHandle, file_name: &str) -> Result<PathBuf> {
    Ok(data_dir(app)?.join(file_name))
}

/// Tighten a directory to owner-only (`0700`) on Unix. No-op elsewhere
/// (Windows relies on the per-user profile ACLs of the app data directory).
#[cfg(unix)]
pub fn restrict_dir_permissions(dir: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o700))
        .map_err(|e| VaultError::Storage(e.to_string()))
}

#[cfg(not(unix))]
pub fn restrict_dir_permissions(_dir: &Path) -> Result<()> {
    Ok(())
}

/// Create a new file restricted to owner read/write (`0600`) on Unix. Using
/// `OpenOptions::mode` means the file is created private from the start, with no
/// window where it is briefly world-readable. On non-Unix the file is created
/// normally (Windows inherits the user-scoped data directory ACLs).
#[cfg(unix)]
fn create_private_file(path: &Path) -> Result<std::fs::File> {
    use std::os::unix::fs::OpenOptionsExt;
    std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(path)
        .map_err(|e| VaultError::Storage(e.to_string()))
}

#[cfg(not(unix))]
fn create_private_file(path: &Path) -> Result<std::fs::File> {
    std::fs::File::create(path).map_err(|e| VaultError::Storage(e.to_string()))
}

/// Crash-safe write: write to a unique temp file, fsync, then atomically
/// rename over the destination. Either the old or the new file is observed,
/// never a partial write. The temp file is created with owner-only permissions
/// (`0600` on Unix), and `rename` preserves those permissions on the target.
pub fn atomic_write(path: &Path, data: &[u8]) -> Result<()> {
    let tmp = path.with_extension(format!("tmp-{}", uuid::Uuid::new_v4()));
    {
        use std::io::Write;
        let mut f = create_private_file(&tmp)?;
        f.write_all(data).map_err(|e| VaultError::Storage(e.to_string()))?;
        f.sync_all().map_err(|e| VaultError::Storage(e.to_string()))?;
    }
    std::fs::rename(&tmp, path).map_err(|e| VaultError::Storage(e.to_string()))?;
    Ok(())
}

/// Serialize and AES-256-GCM encrypt the keystore into a byte blob.
/// Pure (no I/O) to keep it unit-testable.
pub fn encrypt_keys(key: &[u8; 32], entries: &[KeyEntry]) -> Result<Vec<u8>> {
    let json = serde_json::to_vec(entries)?;
    let ct = encryption::encrypt_vault(key, &json)
        .map_err(|e| VaultError::Storage(e.to_string()))?;
    Ok(serde_json::to_vec(&ct)?)
}

/// Decrypt and deserialize a keystore byte blob produced by `encrypt_keys`.
/// Pure (no I/O) to keep it unit-testable.
pub fn decrypt_keys(key: &[u8; 32], data: &[u8]) -> Result<Vec<KeyEntry>> {
    let ct: Ciphertext = serde_json::from_slice(data)?;
    let json = encryption::decrypt_vault(key, &ct)
        .map_err(|e| VaultError::Storage(e.to_string()))?;
    Ok(serde_json::from_slice(&json)?)
}

/// Encrypt and atomically persist the named keystore using the session key.
pub fn save_keys(app: &AppHandle, file_name: &str, key: &[u8; 32], entries: &[KeyEntry]) -> Result<()> {
    let serialized = encrypt_keys(key, entries)?;
    let path = keys_file_path(app, file_name)?;
    atomic_write(&path, &serialized)
}

/// Decrypt and load the named keystore using the session key.
/// Returns an empty vec if no keystore file exists yet.
pub fn load_keys(app: &AppHandle, file_name: &str, key: &[u8; 32]) -> Result<Vec<KeyEntry>> {
    let path = keys_file_path(app, file_name)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = std::fs::read(&path).map_err(|e| VaultError::Storage(e.to_string()))?;
    decrypt_keys(key, &data)
}

#[tauri::command]
pub fn generate_key(
    app: AppHandle,
    key_type: String,
    purpose: u32,
    account: u32,
    index: u32,
    vault: State<'_, VaultMutex>,
    keystore: State<'_, KeyStore>,
    session: State<'_, SessionKey>,
) -> Result<KeyEntryPublic> {
    let session_key = {
        let guard = session.0.lock().unwrap();
        guard.as_ref().ok_or(VaultError::NotInitialized)?.clone()
    };
    let keys_file = vault.0.lock().unwrap().keys_file.clone();

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
    save_keys(&app, &keys_file, &session_key, &store)?;
    Ok(entry.to_public())
}

#[tauri::command]
pub fn list_keys(keystore: State<'_, KeyStore>) -> Result<Vec<KeyEntryPublic>> {
    let store = keystore.0.lock().unwrap();
    Ok(store.iter().map(|k| k.to_public()).collect())
}

#[tauri::command]
pub fn get_key_detail(
    key_id: String,
    keystore: State<'_, KeyStore>,
) -> Result<KeyEntryPublic> {
    let store = keystore.0.lock().unwrap();
    store
        .iter()
        .find(|k| k.id == key_id)
        .map(|k| k.to_public())
        .ok_or_else(|| VaultError::KeyNotFound(key_id))
}

/// Resolve the plaintext secret key hex for a key id from the in-memory
/// keystore. Kept private to this crate so secrets are only ever used
/// server-side (e.g. by signing / air-gap commands) and never returned to the UI.
pub fn secret_hex_for(keystore: &State<'_, KeyStore>, key_id: &str) -> Result<Zeroizing<String>> {
    let store = keystore.0.lock().unwrap();
    store
        .iter()
        .find(|k| k.id == key_id)
        .map(|k| Zeroizing::new(k.encrypted_secret_hex.clone()))
        .ok_or_else(|| VaultError::KeyNotFound(key_id.to_string()))
}
