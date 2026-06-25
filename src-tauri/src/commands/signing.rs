use crate::commands::keys::{secret_hex_for, KeyStore};
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
