use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const HARDENED_OFFSET: u32 = 0x80000000;

/// BIP44-style purpose for ZAP HD paths.
pub const ZAP_PURPOSE: u32 = 44;
/// Placeholder SLIP-44 coin type for ZAP. TODO: register an official value.
/// Changing this changes every derived address, so it is fixed at v1.
pub const ZAP_COIN_TYPE: u32 = 9999;

#[derive(Debug, Error)]
pub enum DerivationError {
    #[error("invalid path component: {0}")]
    InvalidPathComponent(String),
    #[error("path too deep: max {max}, got {got}")]
    PathTooDeep { max: usize, got: usize },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct KeyPath {
    pub purpose: u32,
    pub account: u32,
    pub indices: Vec<u32>,
}

impl KeyPath {
    pub fn new(purpose: u32) -> Self {
        Self {
            purpose: purpose | HARDENED_OFFSET,
            account: 0,
            indices: vec![],
        }
    }

    pub fn with_account(mut self, account: u32) -> Self {
        self.account = account | HARDENED_OFFSET;
        self
    }

    pub fn with_index(mut self, index: u32) -> Self {
        self.indices.push(index);
        self
    }

    pub fn hardened(purpose: u32, account: u32, index: u32) -> Self {
        Self {
            purpose: purpose | HARDENED_OFFSET,
            account: account | HARDENED_OFFSET,
            indices: vec![index | HARDENED_OFFSET],
        }
    }

    pub fn parse(path_str: &str) -> Result<Self, DerivationError> {
        let path_str = path_str.trim_start_matches('m').trim_start_matches('/');
        if path_str.is_empty() {
            return Ok(Self::new(0));
        }

        let parts: Vec<&str> = path_str.split('/').collect();
        if parts.len() < 2 {
            return Err(DerivationError::InvalidPathComponent(
                "path must have at least purpose/account".to_string(),
            ));
        }

        let parse_part = |s: &str| -> Result<u32, DerivationError> {
            let hardened = s.ends_with('\'');
            let num_str = s.trim_end_matches('\'');
            let num: u32 = num_str
                .parse()
                .map_err(|e: std::num::ParseIntError| DerivationError::InvalidPathComponent(e.to_string()))?;
            Ok(if hardened { num | HARDENED_OFFSET } else { num })
        };

        let purpose = parse_part(parts[0])?;
        let account = parse_part(parts[1])?;
        let mut indices = Vec::new();
        for part in &parts[2..] {
            indices.push(parse_part(part)?);
        }

        if indices.len() > 5 {
            return Err(DerivationError::PathTooDeep { max: 5, got: indices.len() });
        }

        Ok(Self { purpose, account, indices })
    }

    pub fn to_string(&self) -> String {
        let mut result = format!("m/{}'/{}'", self.purpose & 0x7FFFFFFF, self.account & 0x7FFFFFFF);
        for idx in &self.indices {
            if *idx & HARDENED_OFFSET != 0 {
                result.push_str(&format!("/{}'", idx & 0x7FFFFFFF));
            } else {
                result.push_str(&format!("/{}", idx));
            }
        }
        result
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&self.purpose.to_be_bytes());
        bytes.extend_from_slice(&self.account.to_be_bytes());
        for idx in &self.indices {
            bytes.extend_from_slice(&idx.to_be_bytes());
        }
        bytes
    }
}

pub fn derive_key_path(purpose: u32, account: u32, index: u32) -> KeyPath {
    KeyPath::hardened(purpose, account, index)
}

/// Build the canonical ZAP HD path `m/44'/9999'/{purpose}'/{account}'/{index}'`.
/// The user-facing purpose/account/index become the lower path components inside
/// the fixed ZAP namespace, so identical inputs always derive the same key while
/// distinct inputs are domain-separated. All components are hardened.
pub fn zap_path(purpose: u32, account: u32, index: u32) -> KeyPath {
    KeyPath {
        purpose: ZAP_PURPOSE | HARDENED_OFFSET,
        account: ZAP_COIN_TYPE | HARDENED_OFFSET,
        indices: vec![
            purpose | HARDENED_OFFSET,
            account | HARDENED_OFFSET,
            index | HARDENED_OFFSET,
        ],
    }
}

pub fn derive_seed_from_master(
    master_seed: &[u8; 64],
    path: &KeyPath,
) -> [u8; 32] {
    let mut hasher = blake3::Hasher::new();
    hasher.update(b"ZAP_HD_derive");
    hasher.update(master_seed);
    hasher.update(&path.to_bytes());
    let hash = hasher.finalize();
    let mut result = [0u8; 32];
    result.copy_from_slice(&hash.as_bytes()[..32]);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_and_format_roundtrip() {
        let path_str = "m/44'/9999'/0'/0/1";
        let path = KeyPath::parse(path_str).unwrap();
        assert_eq!(path.purpose, 44 | HARDENED_OFFSET);
        assert_eq!(path.account, 9999 | HARDENED_OFFSET);
        assert_eq!(path.indices.len(), 3);
        assert_eq!(path.indices[0], 0 | HARDENED_OFFSET);
        assert_eq!(path.indices[1], 0);
        assert_eq!(path.indices[2], 1);
    }

    #[test]
    fn test_hardened_path() {
        let path = derive_key_path(0, 0, 0);
        assert_eq!(path.purpose, HARDENED_OFFSET);
        assert_eq!(path.account, HARDENED_OFFSET);
        assert_eq!(path.indices[0], HARDENED_OFFSET);
    }

    #[test]
    fn test_derive_seed_deterministic() {
        let master = [42u8; 64];
        let path = derive_key_path(0, 0, 0);
        let s1 = derive_seed_from_master(&master, &path);
        let s2 = derive_seed_from_master(&master, &path);
        assert_eq!(s1, s2);
    }

    #[test]
    fn test_different_paths_different_seeds() {
        let master = [42u8; 64];
        let p1 = derive_key_path(0, 0, 0);
        let p2 = derive_key_path(0, 0, 1);
        let s1 = derive_seed_from_master(&master, &p1);
        let s2 = derive_seed_from_master(&master, &p2);
        assert_ne!(s1, s2);
    }

    #[test]
    fn test_path_to_bytes() {
        let path = KeyPath::hardened(1, 2, 3);
        let bytes = path.to_bytes();
        assert_eq!(bytes.len(), 12);
    }

    #[test]
    fn test_zap_path_format() {
        // The canonical ZAP path embeds the fixed namespace then the user's
        // purpose/account/index, all hardened.
        let path = zap_path(0, 0, 0);
        assert_eq!(path.to_string(), "m/44'/9999'/0'/0'/0'");
        let path = zap_path(7, 3, 5);
        assert_eq!(path.to_string(), "m/44'/9999'/7'/3'/5'");
    }

    #[test]
    fn test_zap_path_is_fully_hardened() {
        let path = zap_path(1, 2, 3);
        assert_eq!(path.purpose, ZAP_PURPOSE | HARDENED_OFFSET);
        assert_eq!(path.account, ZAP_COIN_TYPE | HARDENED_OFFSET);
        for idx in &path.indices {
            assert_ne!(*idx & HARDENED_OFFSET, 0);
        }
    }

    #[test]
    fn test_zap_path_distinct_inputs_distinct_seeds() {
        // Different user inputs must derive distinct child seeds from one master.
        let master = [9u8; 64];
        let a = derive_seed_from_master(&master, &zap_path(0, 0, 0));
        let b = derive_seed_from_master(&master, &zap_path(0, 0, 1));
        let c = derive_seed_from_master(&master, &zap_path(0, 1, 0));
        let d = derive_seed_from_master(&master, &zap_path(1, 0, 0));
        assert_ne!(a, b);
        assert_ne!(a, c);
        assert_ne!(a, d);
        assert_ne!(b, c);
    }

    #[test]
    fn test_zap_path_recovery_is_reproducible() {
        // The same master seed + same inputs always derive the same child seed,
        // which is what makes mnemonic recovery work.
        let master = [0x33u8; 64];
        let s1 = derive_seed_from_master(&master, &zap_path(44, 2, 9));
        let s2 = derive_seed_from_master(&master, &zap_path(44, 2, 9));
        assert_eq!(s1, s2);
    }
}
