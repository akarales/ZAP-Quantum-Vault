use serde::{Deserialize, Serialize};

/// Default keystore filename used by vaults created before the generation-based
/// naming was introduced (and for the first generation of new vaults).
pub fn default_keys_file() -> String {
    "keys.enc".to_string()
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
}

impl Default for VaultState {
    fn default() -> Self {
        Self {
            initialized: false,
            salt_hex: String::new(),
            verifier_hash_hex: String::new(),
            keys_file: default_keys_file(),
        }
    }
}
