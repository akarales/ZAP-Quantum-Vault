use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Nonce,
};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const AES_NONCE_SIZE: usize = 12;
pub const XCHACHA_NONCE_SIZE: usize = 24;
pub const AEAD_TAG_SIZE: usize = 16;

#[derive(Debug, Error)]
pub enum EncryptionError {
    #[error("encryption failed: {0}")]
    EncryptFailed(String),
    #[error("decryption failed: {0}")]
    DecryptFailed(String),
    #[error("invalid key size: expected 32 bytes, got {got}")]
    InvalidKeySize { got: usize },
    #[error("invalid nonce size: expected {expected}, got {got}")]
    InvalidNonceSize { expected: usize, got: usize },
    #[error("ciphertext too short")]
    CiphertextTooShort,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ciphertext {
    pub nonce: Vec<u8>,
    pub ciphertext: Vec<u8>,
}

pub fn encrypt_vault(key: &[u8; 32], plaintext: &[u8]) -> Result<Ciphertext, EncryptionError> {
    let mut nonce_bytes = [0u8; AES_NONCE_SIZE];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);

    let cipher = Aes256Gcm::new(key.into());
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ct = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| EncryptionError::EncryptFailed(e.to_string()))?;

    Ok(Ciphertext {
        nonce: nonce_bytes.to_vec(),
        ciphertext: ct,
    })
}

pub fn decrypt_vault(key: &[u8; 32], ct: &Ciphertext) -> Result<Vec<u8>, EncryptionError> {
    if ct.nonce.len() != AES_NONCE_SIZE {
        return Err(EncryptionError::InvalidNonceSize {
            expected: AES_NONCE_SIZE,
            got: ct.nonce.len(),
        });
    }

    let cipher = Aes256Gcm::new(key.into());
    let nonce = Nonce::from_slice(&ct.nonce);
    cipher
        .decrypt(nonce, ct.ciphertext.as_ref())
        .map_err(|e| EncryptionError::DecryptFailed(e.to_string()))
}

pub fn encrypt_aead(key: &[u8; 32], plaintext: &[u8]) -> Result<Ciphertext, EncryptionError> {
    let mut nonce_bytes = [0u8; XCHACHA_NONCE_SIZE];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);

    let cipher = XChaCha20Poly1305::new(key.into());
    let ct = cipher
        .encrypt(
            &nonce_bytes.into(),
            Payload {
                msg: plaintext,
                aad: b"",
            },
        )
        .map_err(|e| EncryptionError::EncryptFailed(e.to_string()))?;

    Ok(Ciphertext {
        nonce: nonce_bytes.to_vec(),
        ciphertext: ct,
    })
}

pub fn decrypt_aead(key: &[u8; 32], ct: &Ciphertext) -> Result<Vec<u8>, EncryptionError> {
    if ct.nonce.len() != XCHACHA_NONCE_SIZE {
        return Err(EncryptionError::InvalidNonceSize {
            expected: XCHACHA_NONCE_SIZE,
            got: ct.nonce.len(),
        });
    }

    let cipher = XChaCha20Poly1305::new(key.into());
    let nonce = XNonce::from_slice(&ct.nonce);
    cipher
        .decrypt(
            nonce,
            Payload {
                msg: ct.ciphertext.as_ref(),
                aad: b"",
            },
        )
        .map_err(|e| EncryptionError::DecryptFailed(e.to_string()))
}

pub fn derive_aead_key(shared_secret: &[u8], domain: &str) -> [u8; 32] {
    let mut hasher = blake3::Hasher::new();
    hasher.update(domain.as_bytes());
    hasher.update(shared_secret);
    let hash = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&hash.as_bytes()[..32]);
    key
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vault_encrypt_decrypt_roundtrip() {
        let key = [42u8; 32];
        let plaintext = b"sensitive vault data";
        let ct = encrypt_vault(&key, plaintext).unwrap();
        let decrypted = decrypt_vault(&key, &ct).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_aead_encrypt_decrypt_roundtrip() {
        let key = [99u8; 32];
        let plaintext = b"blockchain channel message";
        let ct = encrypt_aead(&key, plaintext).unwrap();
        assert_eq!(ct.nonce.len(), XCHACHA_NONCE_SIZE);
        let decrypted = decrypt_aead(&key, &ct).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_aead_wrong_key_fails() {
        let key1 = [1u8; 32];
        let key2 = [2u8; 32];
        let ct = encrypt_aead(&key1, b"secret").unwrap();
        assert!(decrypt_aead(&key2, &ct).is_err());
    }

    #[test]
    fn test_vault_wrong_key_fails() {
        let key1 = [1u8; 32];
        let key2 = [2u8; 32];
        let ct = encrypt_vault(&key1, b"secret").unwrap();
        assert!(decrypt_vault(&key2, &ct).is_err());
    }

    #[test]
    fn test_aead_nonce_is_unique() {
        let key = [0u8; 32];
        let ct1 = encrypt_aead(&key, b"msg").unwrap();
        let ct2 = encrypt_aead(&key, b"msg").unwrap();
        assert_ne!(ct1.nonce, ct2.nonce);
    }

    #[test]
    fn test_derive_aead_key_deterministic() {
        let shared = [7u8; 32];
        let k1 = derive_aead_key(&shared, "ZAP_channel_aead_key");
        let k2 = derive_aead_key(&shared, "ZAP_channel_aead_key");
        assert_eq!(k1, k2);
    }

    #[test]
    fn test_derive_aead_key_different_domains() {
        let shared = [7u8; 32];
        let k1 = derive_aead_key(&shared, "ZAP_channel_aead_key");
        let k2 = derive_aead_key(&shared, "ZAP_note_aead_key");
        assert_ne!(k1, k2);
    }
}
