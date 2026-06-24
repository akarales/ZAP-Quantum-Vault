use ml_dsa::{
    Generate, Keypair, KeyExport, KeyInit, Signer, Verifier,
    MlDsa87, SigningKey as MlSigningKey, VerifyingKey as MlVerifyingKey,
    Signature as MlSignature, Seed, EncodedVerifyingKey, EncodedSignature,
};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use zeroize::{Zeroize, ZeroizeOnDrop};

pub const PUBLIC_KEY_SIZE: usize = 2592;
pub const SEED_SIZE: usize = 32;
pub const SIGNATURE_SIZE: usize = 4627;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("invalid key encoding: expected {expected} bytes, got {got}")]
    InvalidKeySize { expected: usize, got: usize },
    #[error("invalid signature encoding: expected {expected} bytes, got {got}")]
    InvalidSignatureSize { expected: usize, got: usize },
    #[error("signature verification failed")]
    VerificationFailed,
    #[error("key decode error: {0}")]
    KeyDecodeError(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, Zeroize)]
pub struct PublicKey(pub Vec<u8>);

#[derive(Debug, Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
pub struct SecretKey(pub Vec<u8>);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signature(pub Vec<u8>);

impl PublicKey {
    pub fn as_bytes(&self) -> &[u8] {
        &self.0
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, CryptoError> {
        if bytes.len() != PUBLIC_KEY_SIZE {
            return Err(CryptoError::InvalidKeySize {
                expected: PUBLIC_KEY_SIZE,
                got: bytes.len(),
            });
        }
        Ok(Self(bytes.to_vec()))
    }

    pub fn to_hex(&self) -> String {
        hex::encode(&self.0)
    }

    pub fn from_hex(hex_str: &str) -> Result<Self, CryptoError> {
        let bytes = hex::decode(hex_str)
            .map_err(|e| CryptoError::KeyDecodeError(e.to_string()))?;
        Self::from_bytes(&bytes)
    }
}

impl SecretKey {
    pub fn as_bytes(&self) -> &[u8] {
        &self.0
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, CryptoError> {
        if bytes.len() != SEED_SIZE {
            return Err(CryptoError::InvalidKeySize {
                expected: SEED_SIZE,
                got: bytes.len(),
            });
        }
        Ok(Self(bytes.to_vec()))
    }

    pub fn to_hex(&self) -> String {
        hex::encode(&self.0)
    }

    pub fn from_hex(hex_str: &str) -> Result<Self, CryptoError> {
        let bytes = hex::decode(hex_str)
            .map_err(|e| CryptoError::KeyDecodeError(e.to_string()))?;
        Self::from_bytes(&bytes)
    }
}

impl Signature {
    pub fn as_bytes(&self) -> &[u8] {
        &self.0
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, CryptoError> {
        if bytes.len() != SIGNATURE_SIZE {
            return Err(CryptoError::InvalidSignatureSize {
                expected: SIGNATURE_SIZE,
                got: bytes.len(),
            });
        }
        Ok(Self(bytes.to_vec()))
    }

    pub fn to_hex(&self) -> String {
        hex::encode(&self.0)
    }

    pub fn from_hex(hex_str: &str) -> Result<Self, CryptoError> {
        let bytes = hex::decode(hex_str)
            .map_err(|e| CryptoError::KeyDecodeError(e.to_string()))?;
        Self::from_bytes(&bytes)
    }
}

pub fn generate() -> (PublicKey, SecretKey) {
    let sk = MlSigningKey::<MlDsa87>::generate();
    let pk = sk.verifying_key();
    let seed: Seed = sk.to_bytes();
    let pk_bytes: EncodedVerifyingKey<MlDsa87> = pk.to_bytes();
    (
        PublicKey(pk_bytes.to_vec()),
        SecretKey(seed.to_vec()),
    )
}

pub fn sign(secret: &SecretKey, message: &[u8]) -> Result<Signature, CryptoError> {
    if secret.0.len() != SEED_SIZE {
        return Err(CryptoError::InvalidKeySize {
            expected: SEED_SIZE,
            got: secret.0.len(),
        });
    }
    let seed_arr: [u8; SEED_SIZE] = secret.0.as_slice().try_into().unwrap();
    let seed = Seed::from(seed_arr);
    let sk = MlSigningKey::<MlDsa87>::new(&seed);
    let sig = sk.sign(message);
    let sig_bytes: EncodedSignature<MlDsa87> = sig.encode();
    Ok(Signature(sig_bytes.to_vec()))
}

pub fn verify(public: &PublicKey, message: &[u8], signature: &Signature) -> Result<bool, CryptoError> {
    if public.0.len() != PUBLIC_KEY_SIZE {
        return Err(CryptoError::InvalidKeySize {
            expected: PUBLIC_KEY_SIZE,
            got: public.0.len(),
        });
    }
    if signature.0.len() != SIGNATURE_SIZE {
        return Err(CryptoError::InvalidSignatureSize {
            expected: SIGNATURE_SIZE,
            got: signature.0.len(),
        });
    }
    let pk_arr: [u8; PUBLIC_KEY_SIZE] = public.0.as_slice().try_into().unwrap();
    let pk_enc = EncodedVerifyingKey::<MlDsa87>::from(pk_arr);
    let vk = MlVerifyingKey::<MlDsa87>::new(&pk_enc);

    let sig_result = MlSignature::<MlDsa87>::try_from(signature.0.as_slice());
    match sig_result {
        Ok(sig) => Ok(vk.verify(message, &sig).is_ok()),
        Err(_) => Ok(false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keypair_generation() {
        let (pk1, sk1) = generate();
        let (pk2, sk2) = generate();
        assert_ne!(pk1.0, pk2.0);
        assert_ne!(sk1.0, sk2.0);
        assert_eq!(pk1.0.len(), PUBLIC_KEY_SIZE);
        assert_eq!(sk1.0.len(), SEED_SIZE);
    }

    #[test]
    fn test_sign_and_verify() {
        let (pk, sk) = generate();
        let message = b"Hello, post-quantum ZAP Blockchain!";
        let sig = sign(&sk, message).unwrap();
        assert_eq!(sig.0.len(), SIGNATURE_SIZE);
        assert!(verify(&pk, message, &sig).unwrap());
    }

    #[test]
    fn test_verify_wrong_message() {
        let (pk, sk) = generate();
        let sig = sign(&sk, b"original message").unwrap();
        assert!(!verify(&pk, b"wrong message", &sig).unwrap());
    }

    #[test]
    fn test_verify_wrong_key() {
        let (_, sk1) = generate();
        let (pk2, _) = generate();
        let sig = sign(&sk1, b"test message").unwrap();
        assert!(!verify(&pk2, b"test message", &sig).unwrap());
    }

    #[test]
    fn test_public_key_hex_roundtrip() {
        let (pk, _) = generate();
        let hex = pk.to_hex();
        let restored = PublicKey::from_hex(&hex).unwrap();
        assert_eq!(pk.0, restored.0);
    }

    #[test]
    fn test_secret_key_hex_roundtrip() {
        let (_, sk) = generate();
        let hex = sk.to_hex();
        let restored = SecretKey::from_hex(&hex).unwrap();
        assert_eq!(sk.0, restored.0);
    }

    #[test]
    fn test_signature_hex_roundtrip() {
        let (pk, sk) = generate();
        let sig = sign(&sk, b"test").unwrap();
        let hex = sig.to_hex();
        let restored = Signature::from_hex(&hex).unwrap();
        assert_eq!(sig.0, restored.0);
        assert!(verify(&pk, b"test", &restored).unwrap());
    }

    #[test]
    fn test_deterministic_keypair_from_seed() {
        let (_, sk) = generate();
        let seed_arr: [u8; SEED_SIZE] = sk.0.as_slice().try_into().unwrap();
        let seed1 = Seed::from(seed_arr);
        let seed2 = Seed::from(seed_arr);
        let sk1 = MlSigningKey::<MlDsa87>::new(&seed1);
        let sk2 = MlSigningKey::<MlDsa87>::new(&seed2);
        let pk1 = sk1.verifying_key();
        let pk2 = sk2.verifying_key();
        assert_eq!(pk1.to_bytes().to_vec(), pk2.to_bytes().to_vec());
    }
}
