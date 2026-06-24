use tauri::{State, AppHandle};
use std::sync::Mutex;
use std::path::PathBuf;
use crate::error::{Result, VaultError};
use crate::crypto::{kdf, encryption};
use crate::models::vault::VaultState;
use crate::commands::keys::{KeyStore, SessionKey, load_keys, save_keys, keys_file_path, atomic_write};
use zeroize::Zeroizing;
use chrono::Utc;

pub struct VaultMutex(pub Mutex<VaultState>);

/// Number of consecutive failed unlocks tolerated before lockout begins.
pub const MAX_UNLOCK_ATTEMPTS: u32 = 5;
/// Base lockout once the threshold is crossed (seconds); doubles each further failure.
pub const BASE_LOCKOUT_SECS: u64 = 30;
/// Upper bound on a single lockout window (seconds).
pub const MAX_LOCKOUT_SECS: u64 = 300;

/// Brute-force throttle for `unlock_vault`. Tracks consecutive failures and an
/// exponential-backoff lockout. In-memory (per process); a successful unlock
/// resets it. Pure logic (takes `now` explicitly) so it is unit-testable.
#[derive(Debug, Default)]
pub struct UnlockThrottle {
    pub failures: u32,
    pub locked_until: u64,
}

impl UnlockThrottle {
    /// Lockout window applied after `failures` consecutive failures, or `None`
    /// while still under the threshold.
    fn lockout_secs(failures: u32) -> Option<u64> {
        if failures < MAX_UNLOCK_ATTEMPTS {
            return None;
        }
        let over = failures - MAX_UNLOCK_ATTEMPTS;
        // Saturating exponential backoff, capped.
        let secs = BASE_LOCKOUT_SECS
            .checked_shl(over)
            .unwrap_or(MAX_LOCKOUT_SECS)
            .min(MAX_LOCKOUT_SECS);
        Some(secs)
    }

    /// Reject the attempt if currently locked out, reporting remaining seconds.
    pub fn check(&self, now: u64) -> Result<()> {
        if now < self.locked_until {
            return Err(VaultError::TooManyAttempts(self.locked_until - now));
        }
        Ok(())
    }

    /// Record a failed unlock and, past the threshold, (re)arm the lockout.
    pub fn record_failure(&mut self, now: u64) {
        self.failures = self.failures.saturating_add(1);
        if let Some(secs) = Self::lockout_secs(self.failures) {
            self.locked_until = now.saturating_add(secs);
        }
    }

    /// Clear all throttle state after a successful unlock.
    pub fn record_success(&mut self) {
        self.failures = 0;
        self.locked_until = 0;
    }
}

pub struct UnlockState(pub Mutex<UnlockThrottle>);

impl Default for UnlockState {
    fn default() -> Self {
        UnlockState(Mutex::new(UnlockThrottle::default()))
    }
}

/// Resolve the on-disk path where the vault metadata (salt + verifier) is stored.
/// Uses the shared, permission-hardened (`0700` on Unix) data directory.
fn vault_file_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(crate::commands::keys::data_dir(app)?.join("vault.json"))
}

/// Persist the current vault metadata to disk via an atomic write. This is the
/// single commit point that binds the active keystore file to the current
/// salt/verifier, so a crash never leaves the two out of sync.
fn persist_vault(app: &AppHandle, vault: &VaultState) -> Result<()> {
    let path = vault_file_path(app)?;
    let data = serde_json::to_string_pretty(vault)?;
    atomic_write(&path, data.as_bytes())
}

/// Load vault metadata from disk into the provided state if it exists and the
/// in-memory state has not been initialized yet (e.g. after an app restart).
fn load_vault_if_needed(app: &AppHandle, vault: &mut VaultState) {
    if vault.initialized {
        return;
    }
    if let Ok(path) = vault_file_path(app) {
        if path.exists() {
            if let Ok(data) = std::fs::read_to_string(&path) {
                if let Ok(loaded) = serde_json::from_str::<VaultState>(&data) {
                    *vault = loaded;
                }
            }
        }
    }
}

/// Returns whether a vault has already been created on this machine.
/// The frontend uses this to decide between the "create vault" and
/// "unlock vault" experiences on first load.
#[tauri::command]
pub fn vault_status(
    app: AppHandle,
    state: State<'_, VaultMutex>,
) -> Result<bool> {
    let mut vault = state.0.lock().unwrap();
    load_vault_if_needed(&app, &mut vault);
    Ok(vault.initialized)
}

#[tauri::command]
pub fn create_vault(
    app: AppHandle,
    password: String,
    state: State<'_, VaultMutex>,
    session: State<'_, SessionKey>,
) -> Result<String> {
    let mut vault = state.0.lock().unwrap();
    // Make sure we don't clobber an existing on-disk vault.
    load_vault_if_needed(&app, &mut vault);
    if vault.initialized {
        return Err(VaultError::AlreadyUnlocked);
    }

    let salt = kdf::generate_salt();
    let master_key = Zeroizing::new(kdf::derive_master_key(password.as_bytes(), &salt)?);
    let enc_key = Zeroizing::new(kdf::derive_encryption_key(&master_key, "vault_encryption"));

    let verifier = b"ZAP_VAULT_VERIFIER";
    let ct = encryption::encrypt_vault(&enc_key, verifier)
        .map_err(|e| VaultError::Storage(e.to_string()))?;

    vault.salt_hex = hex::encode(salt);
    vault.verifier_hash_hex = hex::encode(ct.nonce) + ":" + &hex::encode(ct.ciphertext);
    vault.initialized = true;

    persist_vault(&app, &vault)?;

    // Open the freshly created vault for this session.
    *session.0.lock().unwrap() = Some(enc_key);

    Ok("Vault created successfully".to_string())
}

#[tauri::command]
pub fn unlock_vault(
    app: AppHandle,
    password: String,
    state: State<'_, VaultMutex>,
    keystore: State<'_, KeyStore>,
    session: State<'_, SessionKey>,
    throttle: State<'_, UnlockState>,
) -> Result<bool> {
    let now = Utc::now().timestamp() as u64;

    // Reject early (before the expensive Argon2 derivation) if locked out.
    throttle.0.lock().unwrap().check(now)?;

    let mut vault = state.0.lock().unwrap();
    load_vault_if_needed(&app, &mut vault);
    if !vault.initialized {
        return Err(VaultError::NotInitialized);
    }

    let salt = hex::decode(&vault.salt_hex)
        .map_err(|e| VaultError::Storage(e.to_string()))?;
    let master_key = Zeroizing::new(kdf::derive_master_key(password.as_bytes(), &salt)?);
    let enc_key = Zeroizing::new(kdf::derive_encryption_key(&master_key, "vault_encryption"));

    let parts: Vec<&str> = vault.verifier_hash_hex.split(':').collect();
    if parts.len() != 2 {
        throttle.0.lock().unwrap().record_failure(now);
        return Err(VaultError::InvalidPassword);
    }

    let nonce = hex::decode(parts[0]).map_err(|e| VaultError::Storage(e.to_string()))?;
    let ciphertext = hex::decode(parts[1]).map_err(|e| VaultError::Storage(e.to_string()))?;

    let ct = encryption::Ciphertext { nonce, ciphertext };
    match encryption::decrypt_vault(&enc_key, &ct) {
        Ok(decrypted) if decrypted == b"ZAP_VAULT_VERIFIER" => {
            // Password is correct: clear the throttle, load the keystore, then
            // open the session. The keystore is loaded before `enc_key` is moved.
            throttle.0.lock().unwrap().record_success();
            let entries = load_keys(&app, &vault.keys_file, &enc_key)?;
            *keystore.0.lock().unwrap() = entries;
            *session.0.lock().unwrap() = Some(enc_key);
            Ok(true)
        }
        _ => {
            throttle.0.lock().unwrap().record_failure(now);
            Err(VaultError::InvalidPassword)
        }
    }
}

/// Re-key the vault under a new password. Verifies the old password, then
/// re-wraps both the vault verifier and the encrypted keystore with a key
/// derived from the new password (and a fresh salt).
#[tauri::command]
pub fn change_password(
    app: AppHandle,
    old_password: String,
    new_password: String,
    state: State<'_, VaultMutex>,
    keystore: State<'_, KeyStore>,
    session: State<'_, SessionKey>,
) -> Result<String> {
    let mut vault = state.0.lock().unwrap();
    load_vault_if_needed(&app, &mut vault);
    if !vault.initialized {
        return Err(VaultError::NotInitialized);
    }

    // 1. Verify the old password by decrypting the existing verifier.
    let old_salt = hex::decode(&vault.salt_hex)
        .map_err(|e| VaultError::Storage(e.to_string()))?;
    let old_master = kdf::derive_master_key(old_password.as_bytes(), &old_salt)?;
    let old_enc = kdf::derive_encryption_key(&old_master, "vault_encryption");

    let parts: Vec<&str> = vault.verifier_hash_hex.split(':').collect();
    if parts.len() != 2 {
        return Err(VaultError::InvalidPassword);
    }
    let nonce = hex::decode(parts[0]).map_err(|e| VaultError::Storage(e.to_string()))?;
    let ciphertext = hex::decode(parts[1]).map_err(|e| VaultError::Storage(e.to_string()))?;
    let old_ct = encryption::Ciphertext { nonce, ciphertext };
    match encryption::decrypt_vault(&old_enc, &old_ct) {
        Ok(decrypted) if decrypted == b"ZAP_VAULT_VERIFIER" => {}
        _ => return Err(VaultError::InvalidPassword),
    }

    // 2. Read the keystore using the old key (disk is authoritative).
    let old_keys_file = vault.keys_file.clone();
    let entries = load_keys(&app, &old_keys_file, &old_enc)?;

    // 3. Derive new key material from a fresh salt.
    let new_salt = kdf::generate_salt();
    let new_master = Zeroizing::new(kdf::derive_master_key(new_password.as_bytes(), &new_salt)?);
    let new_enc = Zeroizing::new(kdf::derive_encryption_key(&new_master, "vault_encryption"));

    // 4. Write the re-encrypted keystore to a NEW generation file. The live
    //    keystore (old_keys_file) is left untouched, so until we commit below
    //    the vault is still fully readable with the old password.
    let new_keys_file = format!("keys-{}.enc", uuid::Uuid::new_v4());
    save_keys(&app, &new_keys_file, &new_enc, &entries)?;

    // 5. COMMIT: atomically write vault.json pointing at the new salt,
    //    verifier, and keystore file. This single atomic rename is the only
    //    point at which the change takes effect. A crash before this leaves the
    //    old vault intact; a crash after leaves a fully consistent new vault.
    let verifier = b"ZAP_VAULT_VERIFIER";
    let new_ct = encryption::encrypt_vault(&new_enc, verifier)
        .map_err(|e| VaultError::Storage(e.to_string()))?;
    vault.salt_hex = hex::encode(new_salt);
    vault.verifier_hash_hex = hex::encode(new_ct.nonce) + ":" + &hex::encode(new_ct.ciphertext);
    vault.keys_file = new_keys_file;
    persist_vault(&app, &vault)?;

    // 6. Best-effort cleanup of the now-orphaned old keystore file.
    if old_keys_file != vault.keys_file {
        if let Ok(old_path) = keys_file_path(&app, &old_keys_file) {
            let _ = std::fs::remove_file(old_path);
        }
    }

    // 7. Refresh the in-memory session.
    *keystore.0.lock().unwrap() = entries;
    *session.0.lock().unwrap() = Some(new_enc);

    Ok("Password changed successfully".to_string())
}

#[tauri::command]
pub fn lock_vault(
    state: State<'_, VaultMutex>,
    keystore: State<'_, KeyStore>,
    session: State<'_, SessionKey>,
) -> Result<()> {
    let vault = state.0.lock().unwrap();
    if !vault.initialized {
        return Err(VaultError::NotInitialized);
    }
    // Drop the session key and clear decrypted keys from memory.
    *session.0.lock().unwrap() = None;
    keystore.0.lock().unwrap().clear();
    Ok(())
}
