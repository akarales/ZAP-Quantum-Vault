use crate::crypto::mldsa87;
use crate::error::{Result, VaultError};
use crate::models::airgap::{AirGapEnvelope, TransferType};
use ml_dsa::{Keypair, KeyExport};
use serde::{Deserialize, Serialize};
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize)]
pub struct QrRequest {
    pub payload_hex: String,
    pub transfer_type: String,
    pub secret_key_hex: String,
}

pub fn secret_to_public_hex(secret_hex: &str) -> Result<String> {
    let sk = mldsa87::SecretKey::from_hex(secret_hex)?;
    let seed_arr: [u8; mldsa87::SEED_SIZE] = sk.as_bytes()
        .try_into()
        .map_err(|_| VaultError::Storage("seed conversion failed".to_string()))?;
    let seed = ml_dsa::Seed::from(seed_arr);
    let signing_key = ml_dsa::SigningKey::<ml_dsa::MlDsa87>::from_seed(&seed);
    let vk = signing_key.verifying_key();
    let pk_bytes: ml_dsa::EncodedVerifyingKey<ml_dsa::MlDsa87> = vk.to_bytes();
    Ok(hex::encode(pk_bytes.to_vec()))
}

#[tauri::command]
pub fn generate_qr(request: QrRequest) -> Result<String> {
    let sk = mldsa87::SecretKey::from_hex(&request.secret_key_hex)?;
    let payload = hex::decode(&request.payload_hex)
        .map_err(|e| VaultError::Storage(e.to_string()))?;

    let sig = mldsa87::sign(&sk, &payload)?;

    let checksum = blake3::hash(&payload);
    let pk = secret_to_public_hex(&request.secret_key_hex)?;

    let tt = match request.transfer_type.as_str() {
        "unsigned_tx" => TransferType::UnsignedTx,
        "signed_tx" => TransferType::SignedTx,
        "encrypted_key" => TransferType::EncryptedKey,
        _ => TransferType::UnsignedTx,
    };

    let envelope = AirGapEnvelope {
        version: 1,
        transfer_type: tt,
        payload_hex: request.payload_hex,
        nonce_hex: hex::encode(&[0u8; 24]),
        signature_hex: sig.to_hex(),
        public_key_hex: pk,
        timestamp: Utc::now().timestamp() as u64,
        checksum_hex: hex::encode(checksum.as_bytes()),
    };

    serde_json::to_string(&envelope).map_err(|e| VaultError::AirGap(e.to_string()))
}

#[tauri::command]
pub fn parse_qr(qr_json: String) -> Result<AirGapEnvelope> {
    serde_json::from_str(&qr_json).map_err(|e| VaultError::AirGap(e.to_string()))
}
