use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransferType {
    UnsignedTx,
    SignedTx,
    EncryptedKey,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AirGapEnvelope {
    pub version: u32,
    pub transfer_type: TransferType,
    pub payload_hex: String,
    pub nonce_hex: String,
    pub signature_hex: String,
    pub public_key_hex: String,
    pub timestamp: u64,
    pub checksum_hex: String,
}
