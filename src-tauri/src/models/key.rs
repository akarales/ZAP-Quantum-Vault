use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum KeyType {
    Genesis,
    Validator,
    Governance,
    Treasury,
    SecurityAdmin,
    User,
    QuantumSafe,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyMetadata {
    pub key_type: KeyType,
    pub purpose: u32,
    pub account: u32,
    pub index: u32,
    pub address: String,
    pub created_at: DateTime<Utc>,
    pub label: Option<String>,
    /// The HD derivation path this key was deterministically derived from
    /// (e.g. `m/44'/9999'/0'/0'/0'`). Empty for non-HD/legacy keys.
    #[serde(default)]
    pub derivation_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyEntry {
    pub id: String,
    pub metadata: KeyMetadata,
    pub public_key_hex: String,
    pub encrypted_secret_hex: String,
}

/// Wipe the plaintext secret-key hex from memory when a `KeyEntry` is dropped
/// (e.g. when the keystore is cleared on lock, or a temporary clone goes out of
/// scope). A manual `Drop` is used because `KeyMetadata`/`DateTime` do not
/// implement `Zeroize`, so deriving `ZeroizeOnDrop` on the whole struct is not
/// possible. Only the secret field carries sensitive material.
impl Drop for KeyEntry {
    fn drop(&mut self) {
        self.encrypted_secret_hex.zeroize();
    }
}

/// A redacted view of a `KeyEntry` that intentionally omits the secret key.
/// Returned over the Tauri IPC boundary so secret material never leaves the
/// Rust process. Signing is performed server-side via `sign_with_key`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyEntryPublic {
    pub id: String,
    pub metadata: KeyMetadata,
    pub public_key_hex: String,
}

impl KeyEntry {
    /// Project this entry into its secret-free public view.
    pub fn to_public(&self) -> KeyEntryPublic {
        KeyEntryPublic {
            id: self.id.clone(),
            metadata: self.metadata.clone(),
            public_key_hex: self.public_key_hex.clone(),
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn new(
        key_type: KeyType,
        purpose: u32,
        account: u32,
        index: u32,
        public_key_hex: &str,
        encrypted_secret_hex: &str,
        address: &str,
        derivation_path: &str,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            metadata: KeyMetadata {
                key_type,
                purpose,
                account,
                index,
                address: address.to_string(),
                created_at: Utc::now(),
                label: None,
                derivation_path: derivation_path.to_string(),
            },
            public_key_hex: public_key_hex.to_string(),
            encrypted_secret_hex: encrypted_secret_hex.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> KeyEntry {
        KeyEntry::new(
            KeyType::User,
            44,
            0,
            0,
            "aabbcc",
            "deadbeefcafe",
            "zap1qtest",
            "m/44'/9999'/0'/0'/0'",
        )
    }

    #[test]
    fn key_entry_secret_field_zeroizes() {
        let mut e = sample();
        assert!(!e.encrypted_secret_hex.is_empty());
        e.encrypted_secret_hex.zeroize();
        assert!(e.encrypted_secret_hex.is_empty());
    }

    #[test]
    fn key_entry_public_view_omits_secret() {
        let e = sample();
        let public = e.to_public();
        assert_eq!(public.id, e.id);
        assert_eq!(public.public_key_hex, e.public_key_hex);
        // The public projection has no field that can carry the secret.
        let json = serde_json::to_string(&public).unwrap();
        assert!(!json.contains(&e.encrypted_secret_hex));
    }
}
