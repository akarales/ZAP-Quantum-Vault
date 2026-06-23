pub mod mldsa87;
pub mod mlkem1024;
pub mod address;
pub mod hash;
pub mod encryption;
pub mod kdf;
pub mod mnemonic;
pub mod hd_derivation;
pub mod vrf;
pub mod hybrid_signing;
pub mod threshold;
pub mod proof_batch;

pub use mldsa87::{
    generate, sign, verify,
    PublicKey, SecretKey, Signature, CryptoError,
    PUBLIC_KEY_SIZE, SEED_SIZE, SIGNATURE_SIZE,
};
pub use address::derive_address;
pub use hash::{hash_tx, hash_tx_hex, hash_block, hash_block_hex};
pub use mlkem1024::{KemKeyPair, KemCiphertext, KemError};
pub use encryption::{encrypt_vault, decrypt_vault, encrypt_aead, decrypt_aead};
pub use kdf::{derive_master_key, derive_encryption_key};
pub use mnemonic::{generate_mnemonic, mnemonic_to_seed, validate_mnemonic};
pub use hd_derivation::{derive_key_path, KeyPath};
pub use vrf::{PqVrf, VrfOutput, VrfProof, VrfError};
pub use hybrid_signing::{HybridSigner, HybridSignature, HybridSigningError};
pub use threshold::{ThresholdSigner, ThresholdSignature, ThresholdShare, ThresholdError};
pub use proof_batch::{ProofBatcher, BatchedProof, AggregationError};
