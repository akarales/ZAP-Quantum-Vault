pub mod address;
pub mod encryption;
pub mod hash;
pub mod hd_derivation;
pub mod hybrid_signing;
pub mod kdf;
pub mod mldsa87;
pub mod mlkem1024;
pub mod mnemonic;
pub mod proof_batch;
pub mod threshold;
pub mod vrf;

pub use address::derive_address;
pub use encryption::{decrypt_aead, decrypt_vault, encrypt_aead, encrypt_vault};
pub use hash::{hash_block, hash_block_hex, hash_tx, hash_tx_hex};
pub use hd_derivation::{derive_key_path, KeyPath};
pub use hybrid_signing::{HybridSignature, HybridSigner, HybridSigningError};
pub use kdf::{derive_encryption_key, derive_master_key};
pub use mldsa87::{
    generate, sign, verify, CryptoError, PublicKey, SecretKey, Signature, PUBLIC_KEY_SIZE,
    SEED_SIZE, SIGNATURE_SIZE,
};
pub use mlkem1024::{KemCiphertext, KemError, KemKeyPair};
pub use mnemonic::{
    generate_mnemonic, mnemonic_to_seed, mnemonic_to_seed_with_passphrase, validate_mnemonic,
};
pub use proof_batch::{AggregationError, BatchedProof, ProofBatcher};
pub use threshold::{ThresholdError, ThresholdShare, ThresholdSignature, ThresholdSigner};
pub use vrf::{PqVrf, VrfError, VrfOutput, VrfProof};
