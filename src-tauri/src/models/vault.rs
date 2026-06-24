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
        }
    }
}
