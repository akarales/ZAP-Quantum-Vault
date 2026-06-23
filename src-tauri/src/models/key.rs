use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyEntry {
    pub id: String,
    pub metadata: KeyMetadata,
    pub public_key_hex: String,
    pub encrypted_secret_hex: String,
}

impl KeyEntry {
    pub fn new(
        key_type: KeyType,
        purpose: u32,
        account: u32,
        index: u32,
        public_key_hex: &str,
        encrypted_secret_hex: &str,
        address: &str,
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
            },
            public_key_hex: public_key_hex.to_string(),
            encrypted_secret_hex: encrypted_secret_hex.to_string(),
        }
    }
}
