use serde::{Deserialize, Serialize};

/// Default keystore filename used by vaults created before the generation-based
/// naming was introduced (and for the first generation of new vaults).
pub fn default_keys_file() -> String {
    "keys.enc".to_string()
}

/// Default YubiKey slot used for HMAC-SHA1 challenge-response. Slot 2 is the
/// conventional slot for challenge-response (slot 1 typically holds Yubico OTP).
pub fn default_yubikey_slot() -> u8 {
    2
}

/// Serde defaults for the KDF profile block. Vaults written before this block
/// existed are read back as the legacy 64 MiB / t=3 profile so they still unlock.
pub fn default_kdf_version() -> u32 {
    1
}
pub fn default_argon2_memory_kib() -> u32 {
    crate::crypto::kdf::ARGON2_MEMORY_KIB
}
pub fn default_argon2_iterations() -> u32 {
    crate::crypto::kdf::ARGON2_ITERATIONS
}
pub fn default_argon2_parallelism() -> u32 {
    crate::crypto::kdf::ARGON2_PARALLELISM
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultState {
    pub initialized: bool,
    pub salt_hex: String,
    pub verifier_hash_hex: String,
    /// Name of the encrypted keystore file currently bound to this vault's
    /// salt/key. Updated atomically with the rest of the metadata during a
    /// password change so the keystore and verifier are always swapped together.
    #[serde(default = "default_keys_file")]
    pub keys_file: String,
    /// Whether a YubiKey HMAC-SHA1 challenge-response is required as a second
    /// factor mixed into the key derivation. Defaults to `false` so existing
    /// password-only vaults keep working unchanged.
    #[serde(default)]
    pub yubikey_enabled: bool,
    /// YubiKey slot (1 or 2) to use for the challenge-response.
    #[serde(default = "default_yubikey_slot")]
    pub yubikey_slot: u8,
    /// Hex-encoded, non-secret challenge sent to the YubiKey to obtain the HMAC
    /// response. Stored in plaintext metadata (its secrecy is irrelevant; the
    /// security comes from the YubiKey's on-device secret). Empty when disabled.
    #[serde(default)]
    pub yubikey_challenge_hex: String,
    /// KDF profile version this vault was created with (for reproducibility).
    #[serde(default = "default_kdf_version")]
    pub kdf_version: u32,
    /// Argon2id memory cost (KiB) used for this vault's key derivation.
    #[serde(default = "default_argon2_memory_kib")]
    pub argon2_memory_kib: u32,
    /// Argon2id iteration (time) cost for this vault.
    #[serde(default = "default_argon2_iterations")]
    pub argon2_iterations: u32,
    /// Argon2id parallelism (lanes) for this vault.
    #[serde(default = "default_argon2_parallelism")]
    pub argon2_parallelism: u32,
    /// The BIP39 master seed (64 bytes) encrypted under the vault encryption
    /// key, stored as `nonce_hex:ciphertext_hex`. This is the root of the HD
    /// key tree; it is re-wrapped (never regenerated) on password / YubiKey
    /// changes so derived keys remain stable. Empty for password-only legacy
    /// vaults created before HD derivation existed.
    #[serde(default)]
    pub master_seed_enc_hex: String,
}

impl VaultState {
    /// The Argon2id parameters this vault persists, as a `KdfParams`.
    pub fn kdf_params(&self) -> crate::crypto::kdf::KdfParams {
        crate::crypto::kdf::KdfParams {
            memory_kib: self.argon2_memory_kib,
            iterations: self.argon2_iterations,
            parallelism: self.argon2_parallelism,
        }
    }
}

impl Default for VaultState {
    fn default() -> Self {
        Self {
            initialized: false,
            salt_hex: String::new(),
            verifier_hash_hex: String::new(),
            keys_file: default_keys_file(),
            yubikey_enabled: false,
            yubikey_slot: default_yubikey_slot(),
            yubikey_challenge_hex: String::new(),
            kdf_version: default_kdf_version(),
            argon2_memory_kib: default_argon2_memory_kib(),
            argon2_iterations: default_argon2_iterations(),
            argon2_parallelism: default_argon2_parallelism(),
            master_seed_enc_hex: String::new(),
        }
    }
}
