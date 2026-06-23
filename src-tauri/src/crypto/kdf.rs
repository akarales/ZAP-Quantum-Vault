use argon2::{
    Algorithm, Argon2, Params, Version,
};
use thiserror::Error;

pub const ARGON2_MEMORY_KIB: u32 = 65536;
pub const ARGON2_ITERATIONS: u32 = 3;
pub const ARGON2_PARALLELISM: u32 = 4;
pub const SALT_SIZE: usize = 16;
pub const MASTER_KEY_SIZE: usize = 32;

#[derive(Debug, Error)]
pub enum KdfError {
    #[error("Argon2id derivation failed: {0}")]
    DerivationFailed(String),
    #[error("invalid salt size: expected {expected}, got {got}")]
    InvalidSaltSize { expected: usize, got: usize },
}

pub fn derive_master_key(password: &[u8], salt: &[u8]) -> Result<[u8; MASTER_KEY_SIZE], KdfError> {
    if salt.len() != SALT_SIZE {
        return Err(KdfError::InvalidSaltSize {
            expected: SALT_SIZE,
            got: salt.len(),
        });
    }

    let params = Params::new(ARGON2_MEMORY_KIB, ARGON2_ITERATIONS, ARGON2_PARALLELISM, Some(MASTER_KEY_SIZE))
        .map_err(|e| KdfError::DerivationFailed(e.to_string()))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut output = [0u8; MASTER_KEY_SIZE];
    argon2
        .hash_password_into(password, salt, &mut output)
        .map_err(|e| KdfError::DerivationFailed(e.to_string()))?;

    Ok(output)
}

pub fn derive_encryption_key(master_key: &[u8; 32], domain: &str) -> [u8; 32] {
    let mut hasher = blake3::Hasher::new();
    hasher.update(domain.as_bytes());
    hasher.update(master_key);
    let hash = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&hash.as_bytes()[..32]);
    key
}

pub fn generate_salt() -> [u8; SALT_SIZE] {
    use rand::RngCore;
    let mut salt = [0u8; SALT_SIZE];
    rand::thread_rng().fill_bytes(&mut salt);
    salt
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_master_key_deterministic() {
        let salt = [0u8; SALT_SIZE];
        let k1 = derive_master_key(b"password123", &salt).unwrap();
        let k2 = derive_master_key(b"password123", &salt).unwrap();
        assert_eq!(k1, k2);
    }

    #[test]
    fn test_derive_master_key_different_passwords() {
        let salt = [0u8; SALT_SIZE];
        let k1 = derive_master_key(b"password1", &salt).unwrap();
        let k2 = derive_master_key(b"password2", &salt).unwrap();
        assert_ne!(k1, k2);
    }

    #[test]
    fn test_derive_master_key_different_salts() {
        let salt1 = [0u8; SALT_SIZE];
        let salt2 = [1u8; SALT_SIZE];
        let k1 = derive_master_key(b"password", &salt1).unwrap();
        let k2 = derive_master_key(b"password", &salt2).unwrap();
        assert_ne!(k1, k2);
    }

    #[test]
    fn test_derive_encryption_key_deterministic() {
        let master = [42u8; 32];
        let k1 = derive_encryption_key(&master, "vault_encryption");
        let k2 = derive_encryption_key(&master, "vault_encryption");
        assert_eq!(k1, k2);
    }

    #[test]
    fn test_derive_encryption_key_different_domains() {
        let master = [42u8; 32];
        let k1 = derive_encryption_key(&master, "vault_encryption");
        let k2 = derive_encryption_key(&master, "vault_metadata");
        assert_ne!(k1, k2);
    }

    #[test]
    fn test_invalid_salt_size() {
        assert!(derive_master_key(b"password", &[0u8; 8]).is_err());
    }

    #[test]
    fn test_generate_salt_unique() {
        let s1 = generate_salt();
        let s2 = generate_salt();
        assert_ne!(s1, s2);
    }
}
