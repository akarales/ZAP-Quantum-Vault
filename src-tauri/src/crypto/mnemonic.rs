use bip39::{Language, Mnemonic};
use thiserror::Error;

pub const MNEMONIC_WORD_COUNT: usize = 24;
pub const SEED_SIZE: usize = 64;

#[derive(Debug, Error)]
pub enum MnemonicError {
    #[error("invalid mnemonic: {0}")]
    InvalidMnemonic(String),
    #[error("invalid seed size: expected {expected}, got {got}")]
    InvalidSeedSize { expected: usize, got: usize },
}

pub fn generate_mnemonic() -> String {
    let mnemonic = Mnemonic::generate_in(Language::English, MNEMONIC_WORD_COUNT)
        .expect("24-word mnemonic generation should not fail");
    mnemonic.to_string()
}

pub fn validate_mnemonic(words: &str) -> Result<(), MnemonicError> {
    Mnemonic::parse_in(Language::English, words)
        .map(|_| ())
        .map_err(|e| MnemonicError::InvalidMnemonic(e.to_string()))
}

/// Derive the 64-byte BIP39 seed using the **standard empty passphrase**, so the
/// result is interoperable with any other BIP39 wallet.
///
/// Note: earlier versions used a hardcoded passphrase ("the 25th word"), which
/// added zero security (the constant lived in the public source) while breaking
/// BIP39 interoperability. Use [`mnemonic_to_seed_with_passphrase`] to supply an
/// optional user-chosen passphrase.
pub fn mnemonic_to_seed(words: &str) -> Result<[u8; SEED_SIZE], MnemonicError> {
    mnemonic_to_seed_with_passphrase(words, "")
}

/// Derive the 64-byte BIP39 seed with a user-supplied passphrase (the optional
/// BIP39 "25th word"). An empty passphrase yields the standard BIP39 seed.
///
/// The passphrase is a secret that is intentionally **not** stored anywhere:
/// per BIP39 design, losing it makes the derived keys unrecoverable, and a
/// different passphrase silently derives a different (valid) wallet.
pub fn mnemonic_to_seed_with_passphrase(
    words: &str,
    passphrase: &str,
) -> Result<[u8; SEED_SIZE], MnemonicError> {
    let mnemonic = Mnemonic::parse_in(Language::English, words)
        .map_err(|e| MnemonicError::InvalidMnemonic(e.to_string()))?;

    Ok(mnemonic.to_seed(passphrase))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_mnemonic_has_24_words() {
        let mnemonic = generate_mnemonic();
        let word_count = mnemonic.split_whitespace().count();
        assert_eq!(word_count, MNEMONIC_WORD_COUNT);
    }

    #[test]
    fn test_generate_mnemonic_is_valid() {
        let mnemonic = generate_mnemonic();
        assert!(validate_mnemonic(&mnemonic).is_ok());
    }

    #[test]
    fn test_mnemonic_to_seed_deterministic() {
        let mnemonic = generate_mnemonic();
        let seed1 = mnemonic_to_seed(&mnemonic).unwrap();
        let seed2 = mnemonic_to_seed(&mnemonic).unwrap();
        assert_eq!(seed1, seed2);
    }

    #[test]
    fn test_different_mnemons_different_seeds() {
        let m1 = generate_mnemonic();
        let m2 = generate_mnemonic();
        let s1 = mnemonic_to_seed(&m1).unwrap();
        let s2 = mnemonic_to_seed(&m2).unwrap();
        assert_ne!(s1, s2);
    }

    #[test]
    fn test_invalid_mnemonic_rejected() {
        assert!(validate_mnemonic("invalid words here").is_err());
    }

    #[test]
    fn test_seed_size() {
        let mnemonic = generate_mnemonic();
        let seed = mnemonic_to_seed(&mnemonic).unwrap();
        assert_eq!(seed.len(), SEED_SIZE);
    }

    #[test]
    fn test_default_seed_equals_empty_passphrase() {
        // The convenience wrapper must use the standard empty BIP39 passphrase.
        let mnemonic = generate_mnemonic();
        let default = mnemonic_to_seed(&mnemonic).unwrap();
        let empty = mnemonic_to_seed_with_passphrase(&mnemonic, "").unwrap();
        assert_eq!(default, empty);
    }

    #[test]
    fn test_passphrase_changes_seed() {
        let mnemonic = generate_mnemonic();
        let no_pass = mnemonic_to_seed_with_passphrase(&mnemonic, "").unwrap();
        let with_pass = mnemonic_to_seed_with_passphrase(&mnemonic, "correct horse").unwrap();
        let other_pass = mnemonic_to_seed_with_passphrase(&mnemonic, "battery staple").unwrap();
        assert_ne!(no_pass, with_pass);
        assert_ne!(with_pass, other_pass);
    }

    #[test]
    fn test_bip39_official_vector_interop() {
        // Official BIP39 (Trezor) test vector: all-zero entropy 24-word mnemonic
        // with passphrase "TREZOR". Proves we follow the standard PBKDF2 scheme
        // and are interoperable with other BIP39 wallets.
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon \
abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon \
abandon abandon abandon abandon abandon art";
        let seed = mnemonic_to_seed_with_passphrase(mnemonic, "TREZOR").unwrap();
        let expected = "bda85446c68413707090a52022edd26a1c9462295029f2e60cd7c4f2bbd309717\
0af7a4d73245cafa9c3cca8d561a7c3de6f5d4a10be8ed2a5e608d68f92fcc8";
        assert_eq!(hex::encode(seed), expected);
    }
}
