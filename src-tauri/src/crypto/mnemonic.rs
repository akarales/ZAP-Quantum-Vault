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

pub fn mnemonic_to_seed(words: &str) -> Result<[u8; SEED_SIZE], MnemonicError> {
    let mnemonic = Mnemonic::parse_in(Language::English, words)
        .map_err(|e| MnemonicError::InvalidMnemonic(e.to_string()))?;

    let seed = mnemonic.to_seed("ZAP_Quantum_Vault_v1");
    Ok(seed)
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
}
