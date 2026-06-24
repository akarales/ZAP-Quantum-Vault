use ml_kem::{
    MlKem1024,
    kem::{Decapsulate, Encapsulate, Kem},
    EncapsulationKey, DecapsulationKey,
    KeyExport, array::Array,
};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use zeroize::{Zeroize, ZeroizeOnDrop};

pub const ENCAPSULATION_KEY_SIZE: usize = 1568;
pub const DECAPSULATION_SEED_SIZE: usize = 64;
pub const CIPHERTEXT_SIZE: usize = 1568;
pub const SHARED_SECRET_SIZE: usize = 32;

#[derive(Debug, Error)]
pub enum KemError {
    #[error("KEM encapsulation failed")]
    EncapsulationFailed,
    #[error("KEM decapsulation failed")]
    DecapsulationFailed,
    #[error("invalid key size: expected {expected}, got {got}")]
    InvalidKeySize { expected: usize, got: usize },
    #[error("invalid ciphertext size: expected {expected}, got {got}")]
    InvalidCiphertextSize { expected: usize, got: usize },
    #[error("key decode error: {0}")]
    KeyDecodeError(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
pub struct KemKeyPair {
    pub encapsulation_key: Vec<u8>,
    pub decapsulation_seed: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KemCiphertext {
    pub ciphertext: Vec<u8>,
    pub encapsulated_key: Vec<u8>,
}

impl KemKeyPair {
    pub fn generate() -> Self {
        let (dk, ek) = MlKem1024::generate_keypair();
        let ek_bytes = ek.to_bytes();
        let dk_seed = dk.to_bytes();
        Self {
            encapsulation_key: ek_bytes.to_vec(),
            decapsulation_seed: dk_seed.to_vec(),
        }
    }

    pub fn encapsulate(&self) -> Result<(KemCiphertext, [u8; 32]), KemError> {
        if self.encapsulation_key.len() != ENCAPSULATION_KEY_SIZE {
            return Err(KemError::InvalidKeySize {
                expected: ENCAPSULATION_KEY_SIZE,
                got: self.encapsulation_key.len(),
            });
        }

        let ek_arr: [u8; ENCAPSULATION_KEY_SIZE] = self.encapsulation_key
            .as_slice()
            .try_into()
            .map_err(|_| KemError::KeyDecodeError("slice to array conversion failed".to_string()))?;

        let ek = EncapsulationKey::<MlKem1024>::new(&Array::from(ek_arr))
            .map_err(|e| KemError::KeyDecodeError(e.to_string()))?;

        let (ct, shared) = ek.encapsulate();

        let ct_vec = ct.to_vec();
        let shared_vec = shared.to_vec();

        let mut shared_arr = [0u8; 32];
        shared_arr.copy_from_slice(&shared_vec[..32]);

        Ok((
            KemCiphertext {
                ciphertext: ct_vec,
                encapsulated_key: self.encapsulation_key.clone(),
            },
            shared_arr,
        ))
    }

    pub fn decapsulate(&self, ct: &KemCiphertext) -> Result<[u8; 32], KemError> {
        if self.decapsulation_seed.len() != DECAPSULATION_SEED_SIZE {
            return Err(KemError::InvalidKeySize {
                expected: DECAPSULATION_SEED_SIZE,
                got: self.decapsulation_seed.len(),
            });
        }
        if ct.ciphertext.len() != CIPHERTEXT_SIZE {
            return Err(KemError::InvalidCiphertextSize {
                expected: CIPHERTEXT_SIZE,
                got: ct.ciphertext.len(),
            });
        }

        let seed_arr: [u8; DECAPSULATION_SEED_SIZE] = self.decapsulation_seed
            .as_slice()
            .try_into()
            .map_err(|_| KemError::KeyDecodeError("seed conversion failed".to_string()))?;

        let dk = DecapsulationKey::<MlKem1024>::from_seed(Array::from(seed_arr));

        let ct_arr: [u8; CIPHERTEXT_SIZE] = ct.ciphertext
            .as_slice()
            .try_into()
            .map_err(|_| KemError::KeyDecodeError("ciphertext conversion failed".to_string()))?;

        let shared = dk.decapsulate(&Array::from(ct_arr));
        let shared_vec = shared.to_vec();

        let mut shared_arr = [0u8; 32];
        shared_arr.copy_from_slice(&shared_vec[..32]);

        Ok(shared_arr)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use zeroize::Zeroize;

    #[test]
    fn test_keypair_generation() {
        let kp = KemKeyPair::generate();
        assert_eq!(kp.encapsulation_key.len(), ENCAPSULATION_KEY_SIZE);
        assert_eq!(kp.decapsulation_seed.len(), DECAPSULATION_SEED_SIZE);
    }

    #[test]
    fn test_keypair_zeroize_clears_secret() {
        let mut kp = KemKeyPair::generate();
        assert!(!kp.decapsulation_seed.is_empty());
        kp.zeroize();
        assert!(kp.decapsulation_seed.is_empty());
        assert!(kp.encapsulation_key.is_empty());
    }

    #[test]
    fn test_encapsulate_decapsulate_roundtrip() {
        let kp = KemKeyPair::generate();
        let (ct, shared_send) = kp.encapsulate().unwrap();
        let shared_recv = kp.decapsulate(&ct).unwrap();
        assert_eq!(shared_send, shared_recv);
    }

    #[test]
    fn test_two_keypairs_different_keys() {
        let kp1 = KemKeyPair::generate();
        let kp2 = KemKeyPair::generate();
        assert_ne!(kp1.encapsulation_key, kp2.encapsulation_key);
        assert_ne!(kp1.decapsulation_seed, kp2.decapsulation_seed);
    }

    #[test]
    fn test_shared_secret_size() {
        let kp = KemKeyPair::generate();
        let (_, shared) = kp.encapsulate().unwrap();
        assert_eq!(shared.len(), SHARED_SECRET_SIZE);
    }

    #[test]
    fn test_ciphertext_size() {
        let kp = KemKeyPair::generate();
        let (ct, _) = kp.encapsulate().unwrap();
        assert_eq!(ct.ciphertext.len(), CIPHERTEXT_SIZE);
    }
}
