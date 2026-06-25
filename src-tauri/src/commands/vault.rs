use crate::commands::keys::{
    atomic_write, keys_file_path, load_keys, save_keys, KeyStore, MasterSeed, SessionKey,
};
use crate::crypto::{encryption, kdf, mnemonic};
use crate::error::{Result, VaultError};
use crate::models::vault::VaultState;
use chrono::Utc;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, State};
use zeroize::Zeroizing;

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
        Some(crate::commands::yubikey::respond(
            vault.yubikey_slot,
            &challenge,
        )?)
    } else {
        None
    };
    let master = Zeroizing::new(kdf::derive_master_key_with_factor_params(
        password.as_bytes(),
        response.as_deref(),
        &salt,
        vault.kdf_params(),
    )?);
    Ok(Zeroizing::new(kdf::derive_encryption_key(
        &master,
        "vault_encryption",
    )))
}

/// Encrypt the BIP39 master seed under the vault encryption key, returning the
/// `nonce_hex:ciphertext_hex` form stored in `vault.json`.
fn encrypt_master_seed(enc_key: &[u8; 32], seed: &[u8; 64]) -> Result<String> {
    let ct =
        encryption::encrypt_vault(enc_key, seed).map_err(|e| VaultError::Storage(e.to_string()))?;
    Ok(hex::encode(ct.nonce) + ":" + &hex::encode(ct.ciphertext))
}

/// Decrypt the stored `nonce_hex:ciphertext_hex` master seed with `enc_key`.
/// Returns `None` for vaults that have no stored seed (legacy/password-only).
fn decrypt_master_seed(enc_key: &[u8; 32], stored: &str) -> Result<Option<Zeroizing<[u8; 64]>>> {
    if stored.is_empty() {
        return Ok(None);
    }
    let parts: Vec<&str> = stored.split(':').collect();
    if parts.len() != 2 {
        return Err(VaultError::Storage("malformed master seed record".into()));
    }
    let nonce = hex::decode(parts[0]).map_err(|e| VaultError::Storage(e.to_string()))?;
    let ciphertext = hex::decode(parts[1]).map_err(|e| VaultError::Storage(e.to_string()))?;
    let ct = encryption::Ciphertext { nonce, ciphertext };
    let plain =
        encryption::decrypt_vault(enc_key, &ct).map_err(|e| VaultError::Storage(e.to_string()))?;
    let arr: [u8; 64] = plain
        .as_slice()
        .try_into()
        .map_err(|_| VaultError::Storage("master seed has wrong length".into()))?;
    Ok(Some(Zeroizing::new(arr)))
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

    // Re-wrap the HD master seed under the new key (the seed itself is constant,
    // only its encryption changes), so HD-derived keys remain stable across a
    // password / YubiKey change. No-op for legacy vaults with no stored seed.
    if let Some(seed) = decrypt_master_seed(old_enc, &vault.master_seed_enc_hex)? {
        vault.master_seed_enc_hex = encrypt_master_seed(&new_enc, &seed)?;
    }

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
pub fn vault_status(app: AppHandle, state: State<'_, VaultMutex>) -> Result<bool> {
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
pub fn yubikey_status(app: AppHandle, state: State<'_, VaultMutex>) -> Result<YubiKeyStatus> {
    let mut vault = state.0.lock().unwrap();
    load_vault_if_needed(&app, &mut vault);
    Ok(YubiKeyStatus {
        enabled: vault.yubikey_enabled,
        slot: vault.yubikey_slot,
    })
}

/// Result of creating (or restoring) a vault. Carries the BIP39 mnemonic so the
/// UI can present it once for the user to write down — it is never persisted in
/// plaintext and cannot be retrieved again later.
#[derive(Debug, Clone, serde::Serialize)]
pub struct CreateVaultResult {
    pub mnemonic: String,
}

/// Initialize a fresh vault around an existing 64-byte BIP39 master seed: derive
/// key material with the high Argon2 profile, store the encrypted verifier +
/// master seed + KDF params, persist `vault.json`, and open the session. Shared
/// by `create_vault` (new random mnemonic) and `restore_from_mnemonic`.
fn init_vault_with_seed(
    app: &AppHandle,
    password: &str,
    seed: &[u8; mnemonic::SEED_SIZE],
    vault: &mut VaultState,
    session: &State<'_, SessionKey>,
    master_seed: &State<'_, MasterSeed>,
) -> Result<()> {
    let params = kdf::KdfParams::high();
    let salt = kdf::generate_salt();
    let master_key = Zeroizing::new(kdf::derive_master_key_with_params(
        password.as_bytes(),
        &salt,
        params,
    )?);
    let enc_key = Zeroizing::new(kdf::derive_encryption_key(&master_key, "vault_encryption"));

    let verifier = b"ZAP_VAULT_VERIFIER";
    let ct = encryption::encrypt_vault(&enc_key, verifier)
        .map_err(|e| VaultError::Storage(e.to_string()))?;

    vault.salt_hex = hex::encode(salt);
    vault.verifier_hash_hex = hex::encode(ct.nonce) + ":" + &hex::encode(ct.ciphertext);
    vault.kdf_version = kdf::KDF_VERSION;
    vault.argon2_memory_kib = params.memory_kib;
    vault.argon2_iterations = params.iterations;
    vault.argon2_parallelism = params.parallelism;
    vault.master_seed_enc_hex = encrypt_master_seed(&enc_key, seed)?;
    vault.initialized = true;

    persist_vault(app, vault)?;

    // Open the freshly created vault for this session.
    *master_seed.0.lock().unwrap() = Some(Zeroizing::new(*seed));
    *session.0.lock().unwrap() = Some(enc_key);
    Ok(())
}

#[tauri::command]
pub fn create_vault(
    app: AppHandle,
    password: String,
    state: State<'_, VaultMutex>,
    session: State<'_, SessionKey>,
    master_seed: State<'_, MasterSeed>,
) -> Result<CreateVaultResult> {
    let mut vault = state.0.lock().unwrap();
    // Make sure we don't clobber an existing on-disk vault.
    load_vault_if_needed(&app, &mut vault);
    if vault.initialized {
        return Err(VaultError::AlreadyUnlocked);
    }

    // Generate a fresh 24-word BIP39 mnemonic and its standard 64-byte seed.
    let phrase = mnemonic::generate_mnemonic();
    let seed =
        mnemonic::mnemonic_to_seed(&phrase).map_err(|e| VaultError::Storage(e.to_string()))?;

    init_vault_with_seed(&app, &password, &seed, &mut vault, &session, &master_seed)?;

    Ok(CreateVaultResult { mnemonic: phrase })
}

/// Restore a vault from an existing BIP39 mnemonic (recovery). Refuses to run if
/// a vault already exists on disk — the user must wipe it first (see the reset
/// instructions). Re-establishes the same HD master seed; the user then
/// regenerates their keys at the same paths to recover identical keys.
#[tauri::command]
pub fn restore_from_mnemonic(
    app: AppHandle,
    mnemonic_phrase: String,
    password: String,
    state: State<'_, VaultMutex>,
    session: State<'_, SessionKey>,
    master_seed: State<'_, MasterSeed>,
) -> Result<String> {
    let mut vault = state.0.lock().unwrap();
    load_vault_if_needed(&app, &mut vault);
    if vault.initialized {
        return Err(VaultError::AlreadyUnlocked);
    }

    let phrase = mnemonic_phrase.trim();
    mnemonic::validate_mnemonic(phrase)
        .map_err(|e| VaultError::Storage(format!("invalid recovery phrase: {e}")))?;
    let seed =
        mnemonic::mnemonic_to_seed(phrase).map_err(|e| VaultError::Storage(e.to_string()))?;

    init_vault_with_seed(&app, &password, &seed, &mut vault, &session, &master_seed)?;

    Ok("Vault restored from recovery phrase".to_string())
}

#[tauri::command]
pub fn unlock_vault(
    app: AppHandle,
    password: String,
    state: State<'_, VaultMutex>,
    keystore: State<'_, KeyStore>,
    session: State<'_, SessionKey>,
    master_seed: State<'_, MasterSeed>,
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
            // load the keystore + HD master seed, then open the session.
            throttle.0.lock().unwrap().record_success();
            let entries = load_keys(&app, &vault.keys_file, &enc_key)?;
            let seed = decrypt_master_seed(&enc_key, &vault.master_seed_enc_hex)?;
            *keystore.0.lock().unwrap() = entries;
            *master_seed.0.lock().unwrap() = seed;
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

/// Test whether the currently-inserted YubiKey is a valid backup for this vault,
/// WITHOUT modifying anything. Derives the vault key using the inserted key's
/// response to the stored challenge and checks it against the verifier. Use this
/// to confirm a second (backup) key was programmed with the same HMAC secret
/// before relying on it for recovery.
#[tauri::command]
pub fn verify_yubikey_backup(
    app: AppHandle,
    password: String,
    state: State<'_, VaultMutex>,
) -> Result<bool> {
    let mut vault = state.0.lock().unwrap();
    load_vault_if_needed(&app, &mut vault);
    if !vault.initialized {
        return Err(VaultError::NotInitialized);
    }
    if !vault.yubikey_enabled {
        return Err(VaultError::YubiKeyNotEnrolled);
    }

    // Derive with the inserted key's challenge-response and check the verifier.
    // No state is mutated, so a wrong key simply reports failure.
    let enc = derive_vault_enc_key(&vault, &password)?;
    match verify_enc_key(&vault, &enc) {
        Ok(()) => Ok(true),
        Err(_) => Err(VaultError::YubiKey(
            "This key does not match the enrolled secret. Program it with the same \
             HMAC secret (ykman otp chalresp --touch <secret> <slot>)."
                .to_string(),
        )),
    }
}

/// Guard against (re)programming or erasing the slot the vault currently relies
/// on, which would otherwise irreversibly lock the user out.
fn ensure_slot_not_enrolled(
    app: &AppHandle,
    vault: &mut VaultState,
    slot: u8,
    action: &str,
) -> Result<()> {
    load_vault_if_needed(app, vault);
    if vault.initialized && vault.yubikey_enabled && vault.yubikey_slot == slot {
        return Err(VaultError::YubiKey(format!(
            "Slot {slot} is currently enrolled for this vault. Disable the YubiKey \
             factor first — {action} it now would permanently lock you out."
        )));
    }
    Ok(())
}

/// Program a YubiKey slot for HMAC-SHA1 challenge-response (native USB, no
/// external tools). If `secret_hex` is omitted, a fresh random 20-byte secret is
/// generated. Returns the secret hex used, so the UI can display it once for the
/// user to save and program backup keys with the SAME secret.
#[tauri::command]
pub fn yk_program_hmac(
    app: AppHandle,
    slot: u8,
    secret_hex: Option<String>,
    require_touch: bool,
    state: State<'_, VaultMutex>,
) -> Result<String> {
    use crate::commands::yubikey::{self, UsbProgrammer, YubiKeyProgrammer, HMAC_SECRET_SIZE};

    {
        let mut vault = state.0.lock().unwrap();
        ensure_slot_not_enrolled(&app, &mut vault, slot, "reprogramming")?;
    }

    let secret: [u8; HMAC_SECRET_SIZE] = match secret_hex {
        Some(h) => {
            let bytes = hex::decode(h.trim())
                .map_err(|e| VaultError::YubiKey(format!("invalid secret hex: {e}")))?;
            bytes.as_slice().try_into().map_err(|_| {
                VaultError::YubiKey(format!(
                    "secret must be {HMAC_SECRET_SIZE} bytes ({} hex characters)",
                    HMAC_SECRET_SIZE * 2
                ))
            })?
        }
        None => yubikey::generate_hmac_secret(),
    };

    let mut programmer = UsbProgrammer;
    programmer.program_hmac(slot, &secret, require_touch)?;
    Ok(hex::encode(secret))
}

/// Erase (format) a YubiKey slot. Refuses to erase the slot currently enrolled
/// for this vault.
#[tauri::command]
pub fn yk_erase_slot(app: AppHandle, slot: u8, state: State<'_, VaultMutex>) -> Result<String> {
    use crate::commands::yubikey::{UsbProgrammer, YubiKeyProgrammer};

    {
        let mut vault = state.0.lock().unwrap();
        ensure_slot_not_enrolled(&app, &mut vault, slot, "erasing")?;
    }

    let mut programmer = UsbProgrammer;
    programmer.erase_slot(slot)?;
    Ok(format!("Slot {slot} erased"))
}

#[tauri::command]
pub fn lock_vault(
    state: State<'_, VaultMutex>,
    keystore: State<'_, KeyStore>,
    session: State<'_, SessionKey>,
    master_seed: State<'_, MasterSeed>,
) -> Result<()> {
    let vault = state.0.lock().unwrap();
    if !vault.initialized {
        return Err(VaultError::NotInitialized);
    }
    // Drop the session key, HD master seed, and decrypted keys from memory.
    *session.0.lock().unwrap() = None;
    *master_seed.0.lock().unwrap() = None;
    keystore.0.lock().unwrap().clear();
    Ok(())
}
