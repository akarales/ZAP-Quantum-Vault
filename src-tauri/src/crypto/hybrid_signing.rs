use crate::crypto::mldsa87::{self, PublicKey, SecretKey, Signature};
use ed25519_dalek::{
    Signature as EdSignature, Signer, SigningKey as EdSigningKey, VerifyingKey as EdVerifyingKey,
};
use ml_dsa::{KeyExport, Keypair};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Domain separation tag used when deterministically deriving the Ed25519
/// secondary key from the primary ML-DSA-87 seed. Bumping the version here
/// would change every derived secondary key, so it is fixed.
const ED25519_DERIVATION_DOMAIN: &[u8] = b"ZAP_hybrid_ed25519_v1";

const ALGORITHM_LABEL: &str = "ML-DSA-87+Ed25519";

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
    #[error("malformed secondary signature: {0}")]
    MalformedSecondary(String),
    #[error("crypto error: {0}")]
    Crypto(#[from] mldsa87::CryptoError),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HybridSignature {
    /// ML-DSA-87 (post-quantum) signature over the message.
    pub primary: Vec<u8>,
    /// Ed25519 (classical) signature over the same message (64 bytes).
    pub secondary: Vec<u8>,
    pub primary_public_key: Vec<u8>,
    /// Ed25519 verifying key (32 bytes). Only the public key is published.
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

/// Deterministically derive the Ed25519 secondary seed from the primary
/// ML-DSA-87 seed. This binds the classical key to the post-quantum key so the
/// entire hybrid identity is recoverable from the single HD-derived seed.
fn derive_ed25519_seed(primary_secret: &SecretKey) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(ED25519_DERIVATION_DOMAIN);
    h.update(primary_secret.as_bytes());
    *h.finalize().as_bytes()
}

impl HybridSigner {
    pub fn generate() -> Result<Self, HybridSigningError> {
        let (_pk, sk) = mldsa87::generate();
        Self::from_secret(&sk)
    }

    pub fn from_secret(secret: &SecretKey) -> Result<Self, HybridSigningError> {
        let pk = derive_public_from_secret(secret)?;

        // The Ed25519 key is deterministically derived from the primary seed,
        // so the full hybrid identity is reproducible from one HD seed.
        let sec_seed = derive_ed25519_seed(secret);
        let ed_signing = EdSigningKey::from_bytes(&sec_seed);
        let secondary_public = ed_signing.verifying_key().to_bytes();

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

        // Real Ed25519 signature over the message; only the public key is ever
        // published, so it cannot be forged from the envelope contents.
        let ed_signing = EdSigningKey::from_bytes(&self.secondary_secret);
        let secondary_sig = ed_signing.sign(message).to_bytes().to_vec();

        Ok(HybridSignature {
            primary: primary_sig.0,
            secondary: secondary_sig,
            primary_public_key: self.primary_public.0.clone(),
            secondary_public_key: self.secondary_public,
            algorithm: ALGORITHM_LABEL.to_string(),
        })
    }

    pub fn verify(message: &[u8], sig: &HybridSignature) -> Result<(), HybridSigningError> {
        // Both signatures must independently verify over the same message.
        let pk = PublicKey::from_bytes(&sig.primary_public_key)?;
        let primary_sig = Signature::from_bytes(&sig.primary)?;
        if !mldsa87::verify(&pk, message, &primary_sig)? {
            return Err(HybridSigningError::PrimaryVerificationFailed);
        }

        let ed_pk = EdVerifyingKey::from_bytes(&sig.secondary_public_key)
            .map_err(|e| HybridSigningError::MalformedSecondary(e.to_string()))?;
        let sig_bytes: [u8; 64] =
            sig.secondary.as_slice().try_into().map_err(|_| {
                HybridSigningError::MalformedSecondary("expected 64 bytes".to_string())
            })?;
        let ed_sig = EdSignature::from_bytes(&sig_bytes);
        ed_pk
            .verify_strict(message, &ed_sig)
            .map_err(|_| HybridSigningError::SecondaryVerificationFailed)?;

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
        assert_eq!(sig.algorithm, "ML-DSA-87+Ed25519");
        // The secondary is a full 64-byte Ed25519 signature.
        assert_eq!(sig.secondary.len(), 64);
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

    #[test]
    fn test_from_secret_is_deterministic() {
        // The whole hybrid identity (primary + Ed25519 secondary) must be
        // reproducible from the same primary seed, so HD recovery restores both.
        let (_, sk) = mldsa87::generate();
        let a = HybridSigner::from_secret(&sk).unwrap();
        let b = HybridSigner::from_secret(&sk).unwrap();
        assert_eq!(a.secondary_secret, b.secondary_secret);
        assert_eq!(a.secondary_public_key(), b.secondary_public_key());
        assert_eq!(
            a.primary_public_key().as_bytes(),
            b.primary_public_key().as_bytes()
        );
    }

    #[test]
    fn test_secondary_cannot_be_forged_from_public_key() {
        // Regression: previously the secondary was a keyed-BLAKE3 hash whose key
        // (secondary_public_key) was published in the signature, making it
        // trivially forgeable. With Ed25519, knowing only the public key must
        // NOT allow producing a valid secondary signature.
        let signer = HybridSigner::generate().unwrap();
        let valid = signer.sign(b"authorized").unwrap();

        // Attacker keeps the published public key but fabricates a signature for
        // a different message; verification must reject it.
        let mut forged = valid.clone();
        forged.secondary = vec![0u8; 64];
        assert!(HybridSigner::verify(b"authorized", &forged).is_err());

        // A signature valid for one message must not verify for another.
        assert!(HybridSigner::verify(b"different", &valid).is_err());
    }

    #[test]
    fn test_malformed_secondary_length_rejected() {
        let signer = HybridSigner::generate().unwrap();
        let mut sig = signer.sign(b"msg").unwrap();
        sig.secondary.truncate(10);
        assert!(matches!(
            HybridSigner::verify(b"msg", &sig),
            Err(HybridSigningError::MalformedSecondary(_))
        ));
    }
}
