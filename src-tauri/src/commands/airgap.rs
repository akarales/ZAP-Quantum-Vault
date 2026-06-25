use crate::commands::keys::{secret_hex_for, KeyStore};
use crate::crypto::mldsa87;
use crate::error::{Result, VaultError};
use crate::models::airgap::{AirGapEnvelope, TransferType};
use chrono::Utc;
use ml_dsa::{KeyExport, Keypair};
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Mutex;
use tauri::State;

/// Current air-gap envelope format version. v2 binds the nonce, timestamp and
/// transfer type into the signature (v1 signed only the payload, which allowed
/// replay / field tampering).
pub const ENVELOPE_VERSION: u32 = 2;
/// Random nonce length, in bytes.
pub const NONCE_SIZE: usize = 24;
/// Reject envelopes whose timestamp is older than this (seconds).
pub const MAX_AGE_SECS: u64 = 300;
/// Tolerate this much clock skew for timestamps slightly in the future (seconds).
pub const MAX_SKEW_SECS: u64 = 60;

/// Tracks envelope nonces already consumed by `verify_qr` during this process,
/// so a captured-and-replayed envelope is rejected even within its freshness
/// window. `None`-free; always present as managed state.
pub struct SeenNonces(pub Mutex<HashSet<String>>);

impl Default for SeenNonces {
    fn default() -> Self {
        SeenNonces(Mutex::new(HashSet::new()))
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QrRequest {
    pub payload_hex: String,
    pub transfer_type: String,
    pub secret_key_hex: String,
}

/// Canonical, unambiguous byte encoding of the replay-relevant envelope fields.
/// This is what gets signed and verified, so tampering with the nonce,
/// timestamp, transfer type, version or payload invalidates the signature.
/// Length-prefixed fields prevent concatenation ambiguities.
pub fn signing_message(
    version: u32,
    transfer_type: &TransferType,
    timestamp: u64,
    nonce: &[u8],
    payload: &[u8],
) -> Vec<u8> {
    let mut m = Vec::with_capacity(32 + nonce.len() + payload.len());
    m.extend_from_slice(b"ZAP_AIRGAP_ENVELOPE_V2");
    m.extend_from_slice(&version.to_le_bytes());
    m.push(transfer_type.tag());
    m.extend_from_slice(&timestamp.to_le_bytes());
    m.extend_from_slice(&(nonce.len() as u32).to_le_bytes());
    m.extend_from_slice(nonce);
    m.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    m.extend_from_slice(payload);
    m
}

fn parse_transfer_type(s: &str) -> TransferType {
    match s {
        "unsigned_tx" => TransferType::UnsignedTx,
        "signed_tx" => TransferType::SignedTx,
        "encrypted_key" => TransferType::EncryptedKey,
        _ => TransferType::UnsignedTx,
    }
}

pub fn secret_to_public_hex(secret_hex: &str) -> Result<String> {
    let sk = mldsa87::SecretKey::from_hex(secret_hex)?;
    let seed_arr: [u8; mldsa87::SEED_SIZE] = sk
        .as_bytes()
        .try_into()
        .map_err(|_| VaultError::Storage("seed conversion failed".to_string()))?;
    let seed = ml_dsa::Seed::from(seed_arr);
    let signing_key = ml_dsa::SigningKey::<ml_dsa::MlDsa87>::from_seed(&seed);
    let vk = signing_key.verifying_key();
    let pk_bytes: ml_dsa::EncodedVerifyingKey<ml_dsa::MlDsa87> = vk.to_bytes();
    Ok(hex::encode(pk_bytes.to_vec()))
}

/// Build and serialize a signed air-gap envelope from a secret key hex.
/// The signature binds the version, transfer type, a fresh random nonce, the
/// timestamp and the payload, so the envelope cannot be replayed or tampered
/// with field-by-field.
fn build_envelope(secret_key_hex: &str, payload_hex: &str, transfer_type: &str) -> Result<String> {
    let sk = mldsa87::SecretKey::from_hex(secret_key_hex)?;
    let payload = hex::decode(payload_hex).map_err(|e| VaultError::Storage(e.to_string()))?;

    let tt = parse_transfer_type(transfer_type);
    let timestamp = Utc::now().timestamp() as u64;

    let mut nonce = [0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce);

    let message = signing_message(ENVELOPE_VERSION, &tt, timestamp, &nonce, &payload);
    let sig = mldsa87::sign(&sk, &message)?;

    let checksum = blake3::hash(&payload);
    let pk = secret_to_public_hex(secret_key_hex)?;

    let envelope = AirGapEnvelope {
        version: ENVELOPE_VERSION,
        transfer_type: tt,
        payload_hex: payload_hex.to_string(),
        nonce_hex: hex::encode(nonce),
        signature_hex: sig.to_hex(),
        public_key_hex: pk,
        timestamp,
        checksum_hex: hex::encode(checksum.as_bytes()),
    };

    serde_json::to_string(&envelope).map_err(|e| VaultError::AirGap(e.to_string()))
}

/// Cryptographically and temporally validate a parsed envelope against the
/// reference time `now` (unix seconds). Verifies version, payload checksum,
/// the canonical-message signature, and timestamp freshness. Does NOT perform
/// nonce-replay detection — that is stateful and handled by `verify_qr`.
pub fn verify_envelope(env: &AirGapEnvelope, now: u64) -> Result<()> {
    if env.version != ENVELOPE_VERSION {
        return Err(VaultError::AirGap(format!(
            "unsupported envelope version: {}",
            env.version
        )));
    }

    let payload = hex::decode(&env.payload_hex)
        .map_err(|e| VaultError::AirGap(format!("invalid payload hex: {e}")))?;
    let nonce = hex::decode(&env.nonce_hex)
        .map_err(|e| VaultError::AirGap(format!("invalid nonce hex: {e}")))?;
    if nonce.len() != NONCE_SIZE {
        return Err(VaultError::AirGap("invalid nonce length".to_string()));
    }

    // Payload integrity.
    let checksum = blake3::hash(&payload);
    if env.checksum_hex != hex::encode(checksum.as_bytes()) {
        return Err(VaultError::AirGap("checksum mismatch".to_string()));
    }

    // Signature over the canonical message (binds nonce/timestamp/type/payload).
    let pk = mldsa87::PublicKey::from_hex(&env.public_key_hex)?;
    let sig = mldsa87::Signature::from_hex(&env.signature_hex)?;
    let message = signing_message(
        env.version,
        &env.transfer_type,
        env.timestamp,
        &nonce,
        &payload,
    );
    if !mldsa87::verify(&pk, &message, &sig)? {
        return Err(VaultError::AirGap(
            "signature verification failed".to_string(),
        ));
    }

    // Freshness: reject far-future (beyond skew) and expired envelopes.
    if env.timestamp > now.saturating_add(MAX_SKEW_SECS) {
        return Err(VaultError::AirGap(
            "envelope timestamp is in the future".to_string(),
        ));
    }
    if now > env.timestamp.saturating_add(MAX_AGE_SECS) {
        return Err(VaultError::AirGap("envelope has expired".to_string()));
    }

    Ok(())
}

/// Record an envelope nonce as consumed, rejecting it if already seen.
/// Factored out (operating on a plain `HashSet`) so it is unit-testable
/// without Tauri managed state.
pub fn record_nonce(seen: &mut HashSet<String>, nonce_hex: &str) -> Result<()> {
    if !seen.insert(nonce_hex.to_string()) {
        return Err(VaultError::AirGap(
            "envelope already consumed (replay)".to_string(),
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn generate_qr(request: QrRequest) -> Result<String> {
    build_envelope(
        &request.secret_key_hex,
        &request.payload_hex,
        &request.transfer_type,
    )
}

/// Generate a signed air-gap envelope for a stored key, resolving the secret
/// key server-side from the in-memory keystore. The secret never crosses IPC.
#[tauri::command]
pub fn generate_qr_with_key(
    key_id: String,
    payload_hex: String,
    transfer_type: String,
    keystore: State<'_, KeyStore>,
) -> Result<String> {
    let secret_hex = secret_hex_for(&keystore, &key_id)?;
    build_envelope(&secret_hex, &payload_hex, &transfer_type)
}

#[tauri::command]
pub fn parse_qr(qr_json: String) -> Result<AirGapEnvelope> {
    serde_json::from_str(&qr_json).map_err(|e| VaultError::AirGap(e.to_string()))
}

/// Parse, cryptographically verify, freshness-check, and replay-protect an
/// incoming air-gap envelope. On success the envelope's nonce is recorded so a
/// replayed copy is rejected. Returns the validated envelope.
#[tauri::command]
pub fn verify_qr(qr_json: String, seen: State<'_, SeenNonces>) -> Result<AirGapEnvelope> {
    let envelope: AirGapEnvelope =
        serde_json::from_str(&qr_json).map_err(|e| VaultError::AirGap(e.to_string()))?;

    let now = Utc::now().timestamp() as u64;
    verify_envelope(&envelope, now)?;

    // Only consume the nonce after full cryptographic + freshness validation so
    // a malformed/forged envelope can't burn a legitimate nonce.
    let mut guard = seen.0.lock().unwrap();
    record_nonce(&mut guard, &envelope.nonce_hex)?;

    Ok(envelope)
}
