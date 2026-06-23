use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultState {
    pub initialized: bool,
    pub salt_hex: String,
    pub verifier_hash_hex: String,
}

impl Default for VaultState {
    fn default() -> Self {
        Self {
            initialized: false,
            salt_hex: String::new(),
            verifier_hash_hex: String::new(),
        }
    }
}
