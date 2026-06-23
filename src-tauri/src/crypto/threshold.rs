use crate::crypto::mldsa87::{self, PublicKey, SecretKey, Signature};
use ml_dsa::{Keypair, KeyExport};
use blake3::Hasher;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ThresholdError {
    #[error("insufficient shares: got {got}, need {threshold}")]
    InsufficientShares { got: usize, threshold: usize },
    #[error("duplicate signer")]
    DuplicateSigner,
    #[error("invalid share: signature verification failed")]
    InvalidShare,
    #[error("crypto error: {0}")]
    Crypto(#[from] mldsa87::CryptoError),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThresholdShare {
    pub signer_public_key: Vec<u8>,
    pub signature: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThresholdSignature {
    pub message_hash: [u8; 32],
    pub shares: Vec<ThresholdShare>,
    pub threshold: usize,
    pub algorithm: String,
}

pub struct ThresholdSigner {
    secret_key: SecretKey,
    public_key: PublicKey,
    threshold: usize,
}

fn derive_public_from_secret(secret: &SecretKey) -> Result<PublicKey, ThresholdError> {
    let seed_arr: [u8; mldsa87::SEED_SIZE] = secret.as_bytes()
        .try_into()
        .map_err(|_| mldsa87::CryptoError::KeyDecodeError("seed conversion failed".to_string()))?;
    let seed = ml_dsa::Seed::from(seed_arr);
    let signing_key = ml_dsa::SigningKey::<ml_dsa::MlDsa87>::from_seed(&seed);
    let vk = signing_key.verifying_key();
    let pk_bytes: ml_dsa::EncodedVerifyingKey<ml_dsa::MlDsa87> = vk.to_bytes();
    Ok(PublicKey(pk_bytes.to_vec()))
}

impl ThresholdSigner {
    pub fn new(secret_key: SecretKey, threshold: usize) -> Result<Self, ThresholdError> {
        let public_key = derive_public_from_secret(&secret_key)?;
        Ok(Self { secret_key, public_key, threshold })
    }

    pub fn generate(threshold: usize) -> Result<Self, ThresholdError> {
        let (_, sk) = mldsa87::generate();
        Self::new(sk, threshold)
    }

    pub fn public_key(&self) -> &PublicKey {
        &self.public_key
    }

    pub fn threshold(&self) -> usize {
        self.threshold
    }

    pub fn create_share(&self, message: &[u8]) -> Result<ThresholdShare, ThresholdError> {
        let sig = mldsa87::sign(&self.secret_key, message)?;
        Ok(ThresholdShare {
            signer_public_key: self.public_key.0.clone(),
            signature: sig.0,
        })
    }

    pub fn verify_share(share: &ThresholdShare, message: &[u8]) -> Result<bool, ThresholdError> {
        let pk = PublicKey::from_bytes(&share.signer_public_key)?;
        let sig = Signature::from_bytes(&share.signature)?;
        Ok(mldsa87::verify(&pk, message, &sig)?)
    }

    pub fn aggregate(
        message: &[u8],
        shares: Vec<ThresholdShare>,
        threshold: usize,
    ) -> Result<ThresholdSignature, ThresholdError> {
        if shares.len() < threshold {
            return Err(ThresholdError::InsufficientShares {
                got: shares.len(),
                threshold,
            });
        }

        let mut seen = std::collections::HashSet::new();
        for share in &shares {
            if !seen.insert(&share.signer_public_key[..]) {
                return Err(ThresholdError::DuplicateSigner);
            }
            if !Self::verify_share(share, message)? {
                return Err(ThresholdError::InvalidShare);
            }
        }

        let mut hasher = Hasher::new();
        hasher.update(b"ZAP_threshold_msg_hash");
        hasher.update(message);
        let msg_hash = *hasher.finalize().as_bytes();

        Ok(ThresholdSignature {
            message_hash: msg_hash,
            shares,
            threshold,
            algorithm: "ML-DSA-87-Threshold".to_string(),
        })
    }

    pub fn verify(sig: &ThresholdSignature, message: &[u8]) -> Result<bool, ThresholdError> {
        let mut hasher = Hasher::new();
        hasher.update(b"ZAP_threshold_msg_hash");
        hasher.update(message);
        let expected_hash = *hasher.finalize().as_bytes();

        if sig.message_hash != expected_hash {
            return Ok(false);
        }

        if sig.shares.len() < sig.threshold {
            return Ok(false);
        }

        let mut seen = std::collections::HashSet::new();
        for share in &sig.shares {
            if !seen.insert(&share.signer_public_key[..]) {
                return Ok(false);
            }
            if !Self::verify_share(share, message)? {
                return Ok(false);
            }
        }

        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_and_verify_share() {
        let signer = ThresholdSigner::generate(2).unwrap();
        let share = signer.create_share(b"test message").unwrap();
        assert!(ThresholdSigner::verify_share(&share, b"test message").unwrap());
    }

    #[test]
    fn test_verify_share_wrong_message() {
        let signer = ThresholdSigner::generate(2).unwrap();
        let share = signer.create_share(b"original").unwrap();
        assert!(!ThresholdSigner::verify_share(&share, b"tampered").unwrap());
    }

    #[test]
    fn test_aggregate_sufficient_shares() {
        let s1 = ThresholdSigner::generate(2).unwrap();
        let s2 = ThresholdSigner::generate(2).unwrap();
        let msg = b"threshold test";
        let shares = vec![
            s1.create_share(msg).unwrap(),
            s2.create_share(msg).unwrap(),
        ];
        let sig = ThresholdSigner::aggregate(msg, shares, 2).unwrap();
        assert!(ThresholdSigner::verify(&sig, msg).unwrap());
    }

    #[test]
    fn test_aggregate_insufficient_shares() {
        let s1 = ThresholdSigner::generate(3).unwrap();
        let msg = b"threshold test";
        let shares = vec![s1.create_share(msg).unwrap()];
        assert!(ThresholdSigner::aggregate(msg, shares, 3).is_err());
    }

    #[test]
    fn test_aggregate_duplicate_signer() {
        let s1 = ThresholdSigner::generate(2).unwrap();
        let msg = b"threshold test";
        let share = s1.create_share(msg).unwrap();
        let shares = vec![share.clone(), share];
        assert!(ThresholdSigner::aggregate(msg, shares, 2).is_err());
    }

    #[test]
    fn test_verify_wrong_message() {
        let s1 = ThresholdSigner::generate(2).unwrap();
        let s2 = ThresholdSigner::generate(2).unwrap();
        let shares = vec![
            s1.create_share(b"original").unwrap(),
            s2.create_share(b"original").unwrap(),
        ];
        let sig = ThresholdSigner::aggregate(b"original", shares, 2).unwrap();
        assert!(!ThresholdSigner::verify(&sig, b"tampered").unwrap());
    }

    #[test]
    fn test_algorithm_label() {
        let s1 = ThresholdSigner::generate(1).unwrap();
        let shares = vec![s1.create_share(b"test").unwrap()];
        let sig = ThresholdSigner::aggregate(b"test", shares, 1).unwrap();
        assert_eq!(sig.algorithm, "ML-DSA-87-Threshold");
    }
}
