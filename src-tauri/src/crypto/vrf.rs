use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum VrfError {
    #[error("VRF verification failed: output mismatch")]
    OutputMismatch,
    #[error("VRF verification failed: invalid proof")]
    InvalidProof,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VrfProof {
    pub value: [u8; 32],
    pub public_key: [u8; 32],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VrfOutput {
    pub output: [u8; 32],
    pub proof: VrfProof,
}

pub struct PqVrf {
    pub secret_key: [u8; 32],
    public_key: [u8; 32],
}

impl PqVrf {
    pub fn generate() -> Self {
        let mut sk = [0u8; 32];
        OsRng.fill_bytes(&mut sk);
        Self::from_secret(sk)
    }

    pub fn from_secret(secret: [u8; 32]) -> Self {
        let mut h = blake3::Hasher::new();
        h.update(b"ZAP_vrf_pubkey");
        h.update(&secret);
        let pk = *h.finalize().as_bytes();
        Self { secret_key: secret, public_key: pk }
    }

    pub fn public_key(&self) -> [u8; 32] {
        self.public_key
    }

    pub fn evaluate(&self, input: &[u8]) -> VrfOutput {
        let mut h = blake3::Hasher::new_keyed(&self.public_key);
        h.update(b"ZAP_vrf_output");
        h.update(input);
        let output = *h.finalize().as_bytes();

        let mut proof_h = blake3::Hasher::new_keyed(&self.public_key);
        proof_h.update(b"ZAP_vrf_proof");
        proof_h.update(input);
        let value = *proof_h.finalize().as_bytes();

        VrfOutput {
            output,
            proof: VrfProof {
                value,
                public_key: self.public_key,
            },
        }
    }

    pub fn verify(input: &[u8], output: &VrfOutput) -> Result<(), VrfError> {
        let mut h = blake3::Hasher::new_keyed(&output.proof.public_key);
        h.update(b"ZAP_vrf_output");
        h.update(input);
        let expected_output = *h.finalize().as_bytes();

        if output.output != expected_output {
            return Err(VrfError::OutputMismatch);
        }

        let mut proof_h = blake3::Hasher::new_keyed(&output.proof.public_key);
        proof_h.update(b"ZAP_vrf_proof");
        proof_h.update(input);
        let expected_proof = *proof_h.finalize().as_bytes();

        if output.proof.value != expected_proof {
            return Err(VrfError::InvalidProof);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vrf_deterministic() {
        let vrf = PqVrf::generate();
        let out1 = vrf.evaluate(b"input1");
        let out2 = vrf.evaluate(b"input1");
        assert_eq!(out1.output, out2.output);
    }

    #[test]
    fn test_vrf_different_inputs() {
        let vrf = PqVrf::generate();
        let out1 = vrf.evaluate(b"input1");
        let out2 = vrf.evaluate(b"input2");
        assert_ne!(out1.output, out2.output);
    }

    #[test]
    fn test_vrf_different_keys() {
        let vrf1 = PqVrf::generate();
        let vrf2 = PqVrf::generate();
        let out1 = vrf1.evaluate(b"same_input");
        let out2 = vrf2.evaluate(b"same_input");
        assert_ne!(out1.output, out2.output);
    }

    #[test]
    fn test_vrf_verify_valid() {
        let vrf = PqVrf::generate();
        let output = vrf.evaluate(b"test_input");
        assert!(PqVrf::verify(b"test_input", &output).is_ok());
    }

    #[test]
    fn test_vrf_verify_wrong_input() {
        let vrf = PqVrf::generate();
        let output = vrf.evaluate(b"correct_input");
        assert!(PqVrf::verify(b"wrong_input", &output).is_err());
    }

    #[test]
    fn test_vrf_from_secret() {
        let sk = [0x42u8; 32];
        let vrf1 = PqVrf::from_secret(sk);
        let vrf2 = PqVrf::from_secret(sk);
        assert_eq!(vrf1.public_key(), vrf2.public_key());
        assert_eq!(vrf1.evaluate(b"x").output, vrf2.evaluate(b"x").output);
    }

    #[test]
    fn test_vrf_tampered_output() {
        let vrf = PqVrf::generate();
        let mut output = vrf.evaluate(b"input");
        output.output[0] ^= 0xFF;
        assert!(PqVrf::verify(b"input", &output).is_err());
    }

    #[test]
    fn test_vrf_tampered_proof() {
        let vrf = PqVrf::generate();
        let mut output = vrf.evaluate(b"input");
        output.proof.value[0] ^= 0xFF;
        assert!(PqVrf::verify(b"input", &output).is_err());
    }
}
