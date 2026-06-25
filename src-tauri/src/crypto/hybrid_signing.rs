use crate::crypto::mldsa87::{self, PublicKey, SecretKey, Signature};
use ml_dsa::{KeyExport, Keypair};
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use zeroize::{Zeroize, ZeroizeOnDrop};

#[derive(Debug, Error)]
pub enum HybridSigningError {
    #[error("primary signature failed: {0}")]
    PrimaryFailed(String),
    #[error("secondary signature failed: {0}")]
    SecondaryFailed(String),
    #[error("verification failed: primary signature invalid")]
    PrimaryVerificationFailed,
    #[error("verification failed: secondary signature invalid")]
    SecondaryVerificationFailed,
    #[error("crypto error: {0}")]
    Crypto(#[from] mldsa87::CryptoError),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HybridSignature {
    pub primary: Vec<u8>,
    pub secondary: Vec<u8>,
    pub primary_public_key: Vec<u8>,
    pub secondary_public_key: [u8; 32],
    pub algorithm: String,
}

#[derive(Zeroize, ZeroizeOnDrop)]
pub struct HybridSigner {
    primary_secret: SecretKey,
    primary_public: PublicKey,
    pub secondary_secret: [u8; 32],
    secondary_public: [u8; 32],
}

fn derive_public_from_secret(secret: &SecretKey) -> Result<PublicKey, HybridSigningError> {
    let seed_arr: [u8; mldsa87::SEED_SIZE] = secret
        .as_bytes()
        .try_into()
        .map_err(|_| HybridSigningError::PrimaryFailed("seed conversion failed".to_string()))?;
    let seed = ml_dsa::Seed::from(seed_arr);
    let signing_key = ml_dsa::SigningKey::<ml_dsa::MlDsa87>::from_seed(&seed);
    let vk = signing_key.verifying_key();
    let pk_bytes: ml_dsa::EncodedVerifyingKey<ml_dsa::MlDsa87> = vk.to_bytes();
    Ok(PublicKey(pk_bytes.to_vec()))
}

impl HybridSigner {
    pub fn generate() -> Result<Self, HybridSigningError> {
        let (pk, sk) = mldsa87::generate();

        let mut sec_seed = [0u8; 32];
        OsRng.fill_bytes(&mut sec_seed);

        let mut h = blake3::Hasher::new();
        h.update(b"ZAP_hybrid_secondary_pub");
        h.update(&sec_seed);
        let secondary_public = *h.finalize().as_bytes();

        Ok(Self {
            primary_secret: sk,
            primary_public: pk,
            secondary_secret: sec_seed,
            secondary_public,
        })
    }

    pub fn from_secret(secret: &SecretKey) -> Result<Self, HybridSigningError> {
        let pk = derive_public_from_secret(secret)?;

        let mut sec_seed = [0u8; 32];
        OsRng.fill_bytes(&mut sec_seed);

        let mut h = blake3::Hasher::new();
        h.update(b"ZAP_hybrid_secondary_pub");
        h.update(&sec_seed);
        let secondary_public = *h.finalize().as_bytes();

        Ok(Self {
            primary_secret: secret.clone(),
            primary_public: pk,
            secondary_secret: sec_seed,
            secondary_public,
        })
    }

    pub fn primary_public_key(&self) -> &PublicKey {
        &self.primary_public
    }

    pub fn secondary_public_key(&self) -> &[u8; 32] {
        &self.secondary_public
    }

    pub fn sign(&self, message: &[u8]) -> Result<HybridSignature, HybridSigningError> {
        let primary_sig = mldsa87::sign(&self.primary_secret, message)?;

        let mut h = blake3::Hasher::new_keyed(&self.secondary_public);
        h.update(b"ZAP_hybrid_secondary");
        h.update(message);
        let secondary_sig = h.finalize().as_bytes().to_vec();

        Ok(HybridSignature {
            primary: primary_sig.0,
            secondary: secondary_sig,
            primary_public_key: self.primary_public.0.clone(),
            secondary_public_key: self.secondary_public,
            algorithm: "ML-DSA-87+BLAKE3-HMAC".to_string(),
        })
    }

    pub fn verify(message: &[u8], sig: &HybridSignature) -> Result<(), HybridSigningError> {
        let pk = PublicKey::from_bytes(&sig.primary_public_key)?;
        let primary_sig = Signature::from_bytes(&sig.primary)?;
        if !mldsa87::verify(&pk, message, &primary_sig)? {
            return Err(HybridSigningError::PrimaryVerificationFailed);
        }

        let mut h = blake3::Hasher::new_keyed(&sig.secondary_public_key);
        h.update(b"ZAP_hybrid_secondary");
        h.update(message);
        let expected = h.finalize().as_bytes().to_vec();

        if sig.secondary != expected {
            return Err(HybridSigningError::SecondaryVerificationFailed);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use zeroize::Zeroize;

    #[test]
    fn test_hybrid_signer_zeroize_clears_secrets() {
        let mut signer = HybridSigner::generate().unwrap();
        assert!(!signer.primary_secret.as_bytes().is_empty());
        signer.zeroize();
        assert!(signer.primary_secret.as_bytes().is_empty());
        assert_eq!(signer.secondary_secret, [0u8; 32]);
    }

    #[test]
    fn test_hybrid_sign_and_verify() {
        let signer = HybridSigner::generate().unwrap();
        let sig = signer.sign(b"test message").unwrap();
        assert!(HybridSigner::verify(b"test message", &sig).is_ok());
    }

    #[test]
    fn test_verify_wrong_message() {
        let signer = HybridSigner::generate().unwrap();
        let sig = signer.sign(b"original").unwrap();
        assert!(HybridSigner::verify(b"tampered", &sig).is_err());
    }

    #[test]
    fn test_tampered_primary_sig() {
        let signer = HybridSigner::generate().unwrap();
        let mut sig = signer.sign(b"test").unwrap();
        sig.primary[0] ^= 0xFF;
        assert!(HybridSigner::verify(b"test", &sig).is_err());
    }

    #[test]
    fn test_tampered_secondary_sig() {
        let signer = HybridSigner::generate().unwrap();
        let mut sig = signer.sign(b"test").unwrap();
        sig.secondary[0] ^= 0xFF;
        assert!(HybridSigner::verify(b"test", &sig).is_err());
    }

    #[test]
    fn test_algorithm_label() {
        let signer = HybridSigner::generate().unwrap();
        let sig = signer.sign(b"test").unwrap();
        assert_eq!(sig.algorithm, "ML-DSA-87+BLAKE3-HMAC");
    }

    #[test]
    fn test_different_signers_different_keys() {
        let s1 = HybridSigner::generate().unwrap();
        let s2 = HybridSigner::generate().unwrap();
        assert_ne!(
            s1.primary_public_key().as_bytes(),
            s2.primary_public_key().as_bytes()
        );
        assert_ne!(s1.secondary_public_key(), s2.secondary_public_key());
    }

    #[test]
    fn test_from_secret() {
        let (_, sk) = mldsa87::generate();
        let signer = HybridSigner::from_secret(&sk).unwrap();
        let sig = signer.sign(b"from_secret_test").unwrap();
        assert!(HybridSigner::verify(b"from_secret_test", &sig).is_ok());
    }
}
