use thiserror::Error;

#[derive(Debug, Error)]
pub enum VaultError {
    #[error("crypto error: {0}")]
    Crypto(#[from] crate::crypto::CryptoError),
    #[error("KDF error: {0}")]
    Kdf(#[from] crate::crypto::kdf::KdfError),
    #[error("encryption error: {0}")]
    Encryption(#[from] crate::crypto::encryption::EncryptionError),
    #[error("mnemonic error: {0}")]
    Mnemonic(#[from] crate::crypto::mnemonic::MnemonicError),
    #[error("vault not initialized")]
    NotInitialized,
    #[error("vault already locked")]
    AlreadyLocked,
    #[error("vault already unlocked")]
    AlreadyUnlocked,
    #[error("invalid password")]
    InvalidPassword,
    #[error("too many failed unlock attempts; try again in {0} seconds")]
    TooManyAttempts(u64),
    #[error("key not found: {0}")]
    KeyNotFound(String),
    #[error("key already exists: {0}")]
    KeyAlreadyExists(String),
    #[error("serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("storage error: {0}")]
    Storage(String),
    #[error("airgap error: {0}")]
    AirGap(String),
}

impl serde::Serialize for VaultError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type Result<T> = std::result::Result<T, VaultError>;
