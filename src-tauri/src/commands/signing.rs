use crate::crypto::mldsa87;
use crate::error::Result;
use serde::{Deserialize, Serialize};

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

#[tauri::command]
pub fn verify_message(request: VerifyRequest) -> Result<bool> {
    let pk = mldsa87::PublicKey::from_hex(&request.public_key_hex)?;
    let message = hex::decode(&request.message_hex)
        .map_err(|e| crate::error::VaultError::Storage(e.to_string()))?;
    let sig = mldsa87::Signature::from_hex(&request.signature_hex)?;
    Ok(mldsa87::verify(&pk, &message, &sig)?)
}
