use crate::commands::keys::{secret_hex_for, KeyStore};
use crate::crypto::hybrid_signing::{HybridSignature, HybridSigner};
use crate::crypto::mldsa87;
use crate::error::{Result, VaultError};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct SignRequest {
    pub secret_key_hex: String,
    pub message_hex: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VerifyRequest {
    pub public_key_hex: String,
    pub message_hex: String,
    pub signature_hex: String,
}

#[tauri::command]
pub fn sign_message(request: SignRequest) -> Result<String> {
    let sk = mldsa87::SecretKey::from_hex(&request.secret_key_hex)?;
    let message = hex::decode(&request.message_hex)
        .map_err(|e| crate::error::VaultError::Storage(e.to_string()))?;
    let sig = mldsa87::sign(&sk, &message)?;
    Ok(sig.to_hex())
}

/// Sign a message with a stored key, resolving the secret key server-side from
/// the in-memory keystore. The secret never crosses the IPC boundary.
#[tauri::command]
pub fn sign_message_with_key(
    key_id: String,
    message_hex: String,
    keystore: State<'_, KeyStore>,
) -> Result<String> {
    let secret_hex = secret_hex_for(&keystore, &key_id)?;
    let sk = mldsa87::SecretKey::from_hex(&secret_hex)?;
    let message = hex::decode(&message_hex).map_err(|e| VaultError::Storage(e.to_string()))?;
    let sig = mldsa87::sign(&sk, &message)?;
    Ok(sig.to_hex())
}

#[tauri::command]
pub fn verify_message(request: VerifyRequest) -> Result<bool> {
    let pk = mldsa87::PublicKey::from_hex(&request.public_key_hex)?;
    let message = hex::decode(&request.message_hex)
        .map_err(|e| crate::error::VaultError::Storage(e.to_string()))?;
    let sig = mldsa87::Signature::from_hex(&request.signature_hex)?;
    Ok(mldsa87::verify(&pk, &message, &sig)?)
}

/// Hex-encoded view of a hybrid (ML-DSA-87 + Ed25519) signature, suitable for
/// crossing the IPC boundary and round-tripping back for verification.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HybridSignatureHex {
    pub primary_hex: String,
    pub secondary_hex: String,
    pub primary_public_key_hex: String,
    pub secondary_public_key_hex: String,
    pub algorithm: String,
}

impl HybridSignatureHex {
    fn from_signature(sig: &HybridSignature) -> Self {
        Self {
            primary_hex: hex::encode(&sig.primary),
            secondary_hex: hex::encode(&sig.secondary),
            primary_public_key_hex: hex::encode(&sig.primary_public_key),
            secondary_public_key_hex: hex::encode(sig.secondary_public_key),
            algorithm: sig.algorithm.clone(),
        }
    }

    fn to_signature(&self) -> Result<HybridSignature> {
        let secondary_public_key: [u8; 32] = hex::decode(&self.secondary_public_key_hex)
            .map_err(|e| VaultError::Storage(e.to_string()))?
            .as_slice()
            .try_into()
            .map_err(|_| {
                VaultError::Storage("secondary public key must be 32 bytes".to_string())
            })?;
        Ok(HybridSignature {
            primary: hex::decode(&self.primary_hex)
                .map_err(|e| VaultError::Storage(e.to_string()))?,
            secondary: hex::decode(&self.secondary_hex)
                .map_err(|e| VaultError::Storage(e.to_string()))?,
            primary_public_key: hex::decode(&self.primary_public_key_hex)
                .map_err(|e| VaultError::Storage(e.to_string()))?,
            secondary_public_key,
            algorithm: self.algorithm.clone(),
        })
    }
}

/// Produce a hybrid signature (post-quantum ML-DSA-87 + classical Ed25519) for a
/// stored key. The Ed25519 key is deterministically derived from the same HD
/// seed, so a break in either algorithm alone cannot forge the signature. The
/// secret never crosses the IPC boundary.
#[tauri::command]
pub fn sign_message_hybrid_with_key(
    key_id: String,
    message_hex: String,
    keystore: State<'_, KeyStore>,
) -> Result<HybridSignatureHex> {
    let secret_hex = secret_hex_for(&keystore, &key_id)?;
    let sk = mldsa87::SecretKey::from_hex(&secret_hex)?;
    let message = hex::decode(&message_hex).map_err(|e| VaultError::Storage(e.to_string()))?;
    let signer = HybridSigner::from_secret(&sk)?;
    let sig = signer.sign(&message)?;
    Ok(HybridSignatureHex::from_signature(&sig))
}

/// Verify a hybrid signature. Both the ML-DSA-87 and Ed25519 components must
/// independently verify over the message.
#[tauri::command]
pub fn verify_message_hybrid(signature: HybridSignatureHex, message_hex: String) -> Result<bool> {
    let message = hex::decode(&message_hex).map_err(|e| VaultError::Storage(e.to_string()))?;
    let sig = signature.to_signature()?;
    Ok(HybridSigner::verify(&message, &sig).is_ok())
}
