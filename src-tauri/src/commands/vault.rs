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

/// Derive the vault encryption key from the password, transparently mixing in
/// the YubiKey HMAC-SHA1 response when the vault has a YubiKey enrolled. This is
/// the single place that knows how a vault's key material is derived, so unlock,
/// change-password and (dis)enrollment all stay consistent.
fn derive_vault_enc_key(
    vault: &VaultState,
    password: &str,
) -> Result<Zeroizing<[u8; kdf::MASTER_KEY_SIZE]>> {
    let salt = hex::decode(&vault.salt_hex).map_err(|e| VaultError::Storage(e.to_string()))?;
    let response = if vault.yubikey_enabled {
        let challenge = hex::decode(&vault.yubikey_challenge_hex)
            .map_err(|e| VaultError::Storage(e.to_string()))?;
        Some(crate::commands::yubikey::respond(vault.yubikey_slot, &challenge)?)
    } else {
        None
    };
    let master = Zeroizing::new(kdf::derive_master_key_with_factor(
        password.as_bytes(),
        response.as_deref(),
        &salt,
    )?);
    Ok(Zeroizing::new(kdf::derive_encryption_key(&master, "vault_encryption")))
}

/// Decrypt the stored verifier with `enc_key` and confirm it matches the known
/// plaintext. Returns `Ok(())` on success, [`VaultError::InvalidPassword`] otherwise.
fn verify_enc_key(vault: &VaultState, enc_key: &[u8; 32]) -> Result<()> {
    let parts: Vec<&str> = vault.verifier_hash_hex.split(':').collect();
    if parts.len() != 2 {
        return Err(VaultError::InvalidPassword);
    }
    let nonce = hex::decode(parts[0]).map_err(|e| VaultError::Storage(e.to_string()))?;
    let ciphertext = hex::decode(parts[1]).map_err(|e| VaultError::Storage(e.to_string()))?;
    let ct = encryption::Ciphertext { nonce, ciphertext };
    match encryption::decrypt_vault(enc_key, &ct) {
        Ok(decrypted) if decrypted == b"ZAP_VAULT_VERIFIER" => Ok(()),
        _ => Err(VaultError::InvalidPassword),
    }
}

/// Re-encrypt the keystore and verifier under `new_enc`, writing to a fresh
/// generation file and committing the (already-mutated) `vault` metadata in a
/// single atomic step. The old keystore is left intact until the commit, then
/// cleaned up. Used by change-password and YubiKey (dis)enrollment.
///
/// Caller must set `vault.salt_hex` (and any YubiKey fields) before calling.
fn rekey_vault(
    app: &AppHandle,
    vault: &mut VaultState,
    old_enc: &[u8; 32],
    new_enc: Zeroizing<[u8; 32]>,
    keystore: &State<'_, KeyStore>,
    session: &State<'_, SessionKey>,
) -> Result<()> {
    // Read the keystore using the old key (disk is authoritative).
    let old_keys_file = vault.keys_file.clone();
    let entries = load_keys(app, &old_keys_file, old_enc)?;

    // Write the re-encrypted keystore to a NEW generation file; the live file is
    // untouched so the vault stays readable with the old key until we commit.
    let new_keys_file = format!("keys-{}.enc", uuid::Uuid::new_v4());
    save_keys(app, &new_keys_file, &new_enc, &entries)?;

    // COMMIT: atomically write vault.json pointing at the new verifier/keystore.
    let verifier = b"ZAP_VAULT_VERIFIER";
    let new_ct = encryption::encrypt_vault(&new_enc, verifier)
        .map_err(|e| VaultError::Storage(e.to_string()))?;
    vault.verifier_hash_hex = hex::encode(new_ct.nonce) + ":" + &hex::encode(new_ct.ciphertext);
    vault.keys_file = new_keys_file;
    persist_vault(app, vault)?;

    // Best-effort cleanup of the now-orphaned old keystore file.
    if old_keys_file != vault.keys_file {
        if let Ok(old_path) = keys_file_path(app, &old_keys_file) {
            let _ = std::fs::remove_file(old_path);
        }
    }

    // Refresh the in-memory session.
    *keystore.0.lock().unwrap() = entries;
    *session.0.lock().unwrap() = Some(new_enc);
    Ok(())
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

/// Current YubiKey enrollment state for the vault, surfaced to the frontend so
/// the Settings UI can show enroll vs. disable, and the unlock screen can prompt
/// the user to insert their key.
#[derive(Debug, Clone, serde::Serialize)]
pub struct YubiKeyStatus {
    pub enabled: bool,
    pub slot: u8,
}

#[tauri::command]
pub fn yubikey_status(
    app: AppHandle,
    state: State<'_, VaultMutex>,
) -> Result<YubiKeyStatus> {
    let mut vault = state.0.lock().unwrap();
    load_vault_if_needed(&app, &mut vault);
    Ok(YubiKeyStatus {
        enabled: vault.yubikey_enabled,
        slot: vault.yubikey_slot,
    })
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

    // Derive the encryption key (folding in the YubiKey response if enrolled).
    let enc_key = derive_vault_enc_key(&vault, &password)?;

    match verify_enc_key(&vault, &enc_key) {
        Ok(()) => {
            // Password (and YubiKey, if enrolled) correct: clear the throttle,
            // load the keystore, then open the session.
            throttle.0.lock().unwrap().record_success();
            let entries = load_keys(&app, &vault.keys_file, &enc_key)?;
            *keystore.0.lock().unwrap() = entries;
            *session.0.lock().unwrap() = Some(enc_key);
            Ok(true)
        }
        Err(_) => {
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

    // 1. Verify the old password (folding in the YubiKey response if enrolled).
    let old_enc = derive_vault_enc_key(&vault, &old_password)?;
    verify_enc_key(&vault, &old_enc)?;

    // 2. Derive new key material from a fresh salt. The YubiKey factor (if any)
    //    is unchanged, so the same challenge/slot still apply to the new salt.
    let new_salt = kdf::generate_salt();
    vault.salt_hex = hex::encode(new_salt);
    let new_enc = derive_vault_enc_key(&vault, &new_password)?;

    // 3. Re-encrypt the keystore + verifier and atomically commit.
    rekey_vault(&app, &mut vault, &old_enc, new_enc, &keystore, &session)?;

    Ok("Password changed successfully".to_string())
}

/// Enroll a YubiKey as a second factor. Verifies the current (password-only)
/// vault, then re-keys it so the master key derivation also requires the
/// YubiKey's HMAC-SHA1 response to a freshly generated challenge.
#[tauri::command]
pub fn enroll_yubikey(
    app: AppHandle,
    password: String,
    slot: u8,
    state: State<'_, VaultMutex>,
    keystore: State<'_, KeyStore>,
    session: State<'_, SessionKey>,
) -> Result<String> {
    let mut vault = state.0.lock().unwrap();
    load_vault_if_needed(&app, &mut vault);
    if !vault.initialized {
        return Err(VaultError::NotInitialized);
    }
    if vault.yubikey_enabled {
        return Err(VaultError::YubiKeyAlreadyEnrolled);
    }

    // 1. Verify the current password (no factor yet).
    let old_enc = derive_vault_enc_key(&vault, &password)?;
    verify_enc_key(&vault, &old_enc)?;

    // 2. Generate a fresh challenge and confirm the YubiKey can respond now,
    //    before we commit anything (so a missing/failing key aborts cleanly).
    let challenge = crate::commands::yubikey::generate_challenge();
    crate::commands::yubikey::respond(slot, &challenge)?;

    // 3. Stage the new YubiKey metadata + fresh salt, then derive the new key.
    let new_salt = kdf::generate_salt();
    vault.salt_hex = hex::encode(new_salt);
    vault.yubikey_enabled = true;
    vault.yubikey_slot = slot;
    vault.yubikey_challenge_hex = hex::encode(challenge);
    let new_enc = derive_vault_enc_key(&vault, &password)?;

    // 4. Re-encrypt + atomically commit.
    rekey_vault(&app, &mut vault, &old_enc, new_enc, &keystore, &session)?;

    Ok("YubiKey enrolled successfully".to_string())
}

/// Disable the YubiKey second factor. Verifies the current (password + YubiKey)
/// vault, then re-keys it back to password-only.
#[tauri::command]
pub fn disable_yubikey(
    app: AppHandle,
    password: String,
    state: State<'_, VaultMutex>,
    keystore: State<'_, KeyStore>,
    session: State<'_, SessionKey>,
) -> Result<String> {
    let mut vault = state.0.lock().unwrap();
    load_vault_if_needed(&app, &mut vault);
    if !vault.initialized {
        return Err(VaultError::NotInitialized);
    }
    if !vault.yubikey_enabled {
        return Err(VaultError::YubiKeyNotEnrolled);
    }

    // 1. Verify with the current factor (password + YubiKey response).
    let old_enc = derive_vault_enc_key(&vault, &password)?;
    verify_enc_key(&vault, &old_enc)?;

    // 2. Stage password-only metadata + fresh salt, then derive the new key.
    let new_salt = kdf::generate_salt();
    vault.salt_hex = hex::encode(new_salt);
    vault.yubikey_enabled = false;
    vault.yubikey_challenge_hex = String::new();
    let new_enc = derive_vault_enc_key(&vault, &password)?;

    // 3. Re-encrypt + atomically commit.
    rekey_vault(&app, &mut vault, &old_enc, new_enc, &keystore, &session)?;

    Ok("YubiKey disabled successfully".to_string())
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
