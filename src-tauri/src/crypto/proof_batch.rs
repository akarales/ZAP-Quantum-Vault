use blake3::Hasher;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AggregationError {
    #[error("no proofs to aggregate")]
    Empty,
    #[error("proof verification failed at index {0}")]
    VerificationFailed(usize),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchedProof {
    pub batch_root: [u8; 32],
    pub proof_hashes: Vec<[u8; 32]>,
    pub count: usize,
}

pub struct ProofBatcher;

impl ProofBatcher {
    pub fn aggregate(proof_hashes: Vec<[u8; 32]>) -> Result<BatchedProof, AggregationError> {
        if proof_hashes.is_empty() {
            return Err(AggregationError::Empty);
        }

        let mut layer: Vec<[u8; 32]> = proof_hashes.clone();
        let count = layer.len();

        while layer.len() > 1 {
            let mut next_layer = Vec::with_capacity((layer.len() + 1) / 2);
            for chunk in layer.chunks(2) {
                let mut h = Hasher::new();
                h.update(b"ZAP_proof_batch_node");
                h.update(&chunk[0]);
                if chunk.len() == 2 {
                    h.update(&chunk[1]);
                } else {
                    h.update(&[0u8; 32]);
                }
                next_layer.push(*h.finalize().as_bytes());
            }
            layer = next_layer;
        }

        Ok(BatchedProof {
            batch_root: layer[0],
            proof_hashes,
            count,
        })
    }

    pub fn verify(batched: &BatchedProof) -> Result<bool, AggregationError> {
        if batched.proof_hashes.is_empty() {
            return Err(AggregationError::Empty);
        }

        let mut layer: Vec<[u8; 32]> = batched.proof_hashes.clone();

        while layer.len() > 1 {
            let mut next_layer = Vec::with_capacity((layer.len() + 1) / 2);
            for chunk in layer.chunks(2) {
                let mut h = Hasher::new();
                h.update(b"ZAP_proof_batch_node");
                h.update(&chunk[0]);
                if chunk.len() == 2 {
                    h.update(&chunk[1]);
                } else {
                    h.update(&[0u8; 32]);
                }
                next_layer.push(*h.finalize().as_bytes());
            }
            layer = next_layer;
        }

        Ok(layer[0] == batched.batch_root)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_hashes(n: usize) -> Vec<[u8; 32]> {
        (0..n).map(|i| {
            let mut h = Hasher::new();
            h.update(b"test_proof");
            h.update(&(i as u64).to_le_bytes());
            *h.finalize().as_bytes()
        }).collect()
    }

    #[test]
    fn test_aggregate_single() {
        let hashes = make_hashes(1);
        let batched = ProofBatcher::aggregate(hashes).unwrap();
        assert_eq!(batched.count, 1);
        assert!(ProofBatcher::verify(&batched).unwrap());
    }

    #[test]
    fn test_aggregate_multiple() {
        let hashes = make_hashes(5);
        let batched = ProofBatcher::aggregate(hashes).unwrap();
        assert_eq!(batched.count, 5);
        assert!(ProofBatcher::verify(&batched).unwrap());
    }

    #[test]
    fn test_aggregate_empty() {
        assert!(ProofBatcher::aggregate(vec![]).is_err());
    }

    #[test]
    fn test_verify_tampered_root() {
        let hashes = make_hashes(3);
        let mut batched = ProofBatcher::aggregate(hashes).unwrap();
        batched.batch_root[0] ^= 0xFF;
        assert!(!ProofBatcher::verify(&batched).unwrap());
    }

    #[test]
    fn test_verify_tampered_proof() {
        let hashes = make_hashes(3);
        let mut batched = ProofBatcher::aggregate(hashes).unwrap();
        batched.proof_hashes[0][0] ^= 0xFF;
        assert!(!ProofBatcher::verify(&batched).unwrap());
    }

    #[test]
    fn test_power_of_two() {
        let hashes = make_hashes(8);
        let batched = ProofBatcher::aggregate(hashes).unwrap();
        assert_eq!(batched.count, 8);
        assert!(ProofBatcher::verify(&batched).unwrap());
    }
}
