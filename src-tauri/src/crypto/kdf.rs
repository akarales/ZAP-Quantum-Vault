use argon2::{
    Algorithm, Argon2, Params, Version,
};
use thiserror::Error;

pub const ARGON2_MEMORY_KIB: u32 = 65536;
pub const ARGON2_ITERATIONS: u32 = 3;
pub const ARGON2_PARALLELISM: u32 = 4;
pub const SALT_SIZE: usize = 16;
pub const MASTER_KEY_SIZE: usize = 32;

/// Current KDF profile version. Stored per-vault so the parameters used to
/// create a vault are always reproducible, and future bumps never break
/// existing vaults (each vault carries the params it was built with).
pub const KDF_VERSION: u32 = 1;

/// High-security profile for an offline, air-gapped vault (RFC 9106 "first
/// recommended"-class). Memory-hard at ~1 GiB to maximize the cost of an
/// offline brute-force on dedicated hardware, accepting a ~1-2s unlock. This is
/// appropriate here because the vault is unlocked rarely and interactively,
/// unlike a high-throughput server.
pub const ARGON2_HIGH_MEMORY_KIB: u32 = 1_048_576; // 1 GiB
pub const ARGON2_HIGH_ITERATIONS: u32 = 1;
pub const ARGON2_HIGH_PARALLELISM: u32 = 4;

#[derive(Debug, Error)]
pub enum KdfError {
    #[error("Argon2id derivation failed: {0}")]
    DerivationFailed(String),
    #[error("invalid salt size: expected {expected}, got {got}")]
    InvalidSaltSize { expected: usize, got: usize },
}

/// Tunable Argon2id parameters persisted alongside a vault so its key
/// derivation is fully reproducible regardless of future default changes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct KdfParams {
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
}

impl KdfParams {
    /// The default profile for newly created vaults (high-security offline).
    pub fn high() -> Self {
        Self {
            memory_kib: ARGON2_HIGH_MEMORY_KIB,
            iterations: ARGON2_HIGH_ITERATIONS,
            parallelism: ARGON2_HIGH_PARALLELISM,
        }
    }

    /// The legacy/interactive profile (64 MiB, t=3). Kept for tests and any
    /// vaults explicitly built with it.
    pub fn legacy() -> Self {
        Self {
            memory_kib: ARGON2_MEMORY_KIB,
            iterations: ARGON2_ITERATIONS,
            parallelism: ARGON2_PARALLELISM,
        }
    }
}

impl Default for KdfParams {
    fn default() -> Self {
        Self::high()
    }
}

pub fn derive_master_key(password: &[u8], salt: &[u8]) -> Result<[u8; MASTER_KEY_SIZE], KdfError> {
    derive_master_key_with_params(password, salt, KdfParams::legacy())
}

/// Derive the master key using explicit Argon2id parameters. This is the single
/// primitive; `derive_master_key` is the legacy-profile convenience wrapper.
pub fn derive_master_key_with_params(
    password: &[u8],
    salt: &[u8],
    p: KdfParams,
) -> Result<[u8; MASTER_KEY_SIZE], KdfError> {
    if salt.len() != SALT_SIZE {
        return Err(KdfError::InvalidSaltSize {
            expected: SALT_SIZE,
            got: salt.len(),
        });
    }

    let params = Params::new(p.memory_kib, p.iterations, p.parallelism, Some(MASTER_KEY_SIZE))
        .map_err(|e| KdfError::DerivationFailed(e.to_string()))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut output = [0u8; MASTER_KEY_SIZE];
    argon2
        .hash_password_into(password, salt, &mut output)
        .map_err(|e| KdfError::DerivationFailed(e.to_string()))?;

    Ok(output)
}

/// Derive the master key, optionally binding in a hardware second factor
/// (e.g. a YubiKey HMAC-SHA1 challenge-response).
///
/// When `hardware_response` is `None`, this is byte-for-byte identical to
/// [`derive_master_key`] (so password-only vaults are unaffected). When a
/// response is supplied, the password and response are first folded together
/// with a domain-separated, length-prefixed BLAKE3 hash, and the result is used
/// as the Argon2id input. Because the slow Argon2id step depends on the
/// hardware response, the vault cannot be derived (let alone decrypted) without
/// the physical key — an attacker needs *both* the password and the YubiKey.
pub fn derive_master_key_with_factor(
    password: &[u8],
    hardware_response: Option<&[u8]>,
    salt: &[u8],
) -> Result<[u8; MASTER_KEY_SIZE], KdfError> {
    derive_master_key_with_factor_params(password, hardware_response, salt, KdfParams::legacy())
}

/// As [`derive_master_key_with_factor`], but with explicit Argon2id parameters
/// so the vault's stored profile drives the (expensive) derivation.
pub fn derive_master_key_with_factor_params(
    password: &[u8],
    hardware_response: Option<&[u8]>,
    salt: &[u8],
    p: KdfParams,
) -> Result<[u8; MASTER_KEY_SIZE], KdfError> {
    match hardware_response {
        None => derive_master_key_with_params(password, salt, p),
        Some(response) => {
            let mut hasher = blake3::Hasher::new();
            hasher.update(b"ZAP_VAULT_2FA_v1");
            hasher.update(&(password.len() as u64).to_le_bytes());
            hasher.update(password);
            hasher.update(&(response.len() as u64).to_le_bytes());
            hasher.update(response);
            let combined = hasher.finalize();
            derive_master_key_with_params(combined.as_bytes(), salt, p)
        }
    }
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

    #[test]
    fn test_factor_none_matches_plain_derivation() {
        // With no hardware response, the factor variant must be byte-for-byte
        // identical to the plain derivation (password-only vaults unaffected).
        let salt = [7u8; SALT_SIZE];
        let plain = derive_master_key(b"correct horse", &salt).unwrap();
        let factor_none = derive_master_key_with_factor(b"correct horse", None, &salt).unwrap();
        assert_eq!(plain, factor_none);
    }

    #[test]
    fn test_factor_changes_master_key() {
        // Adding a hardware response must change the derived key vs password-only.
        let salt = [7u8; SALT_SIZE];
        let none = derive_master_key_with_factor(b"pw", None, &salt).unwrap();
        let with = derive_master_key_with_factor(b"pw", Some(&[0xABu8; 20]), &salt).unwrap();
        assert_ne!(none, with);
    }

    #[test]
    fn test_factor_different_responses_differ() {
        let salt = [7u8; SALT_SIZE];
        let r1 = derive_master_key_with_factor(b"pw", Some(&[0x01u8; 20]), &salt).unwrap();
        let r2 = derive_master_key_with_factor(b"pw", Some(&[0x02u8; 20]), &salt).unwrap();
        assert_ne!(r1, r2);
    }

    #[test]
    fn test_factor_deterministic() {
        let salt = [7u8; SALT_SIZE];
        let a = derive_master_key_with_factor(b"pw", Some(&[0x11u8; 20]), &salt).unwrap();
        let b = derive_master_key_with_factor(b"pw", Some(&[0x11u8; 20]), &salt).unwrap();
        assert_eq!(a, b);
    }

    #[test]
    fn test_factor_password_and_response_not_interchangeable() {
        // Length-prefixed folding must prevent the boundary between password and
        // response from being ambiguous (so "ab"+"c" != "a"+"bc").
        let salt = [7u8; SALT_SIZE];
        let x = derive_master_key_with_factor(b"ab", Some(b"c"), &salt).unwrap();
        let y = derive_master_key_with_factor(b"a", Some(b"bc"), &salt).unwrap();
        assert_ne!(x, y);
    }
}
