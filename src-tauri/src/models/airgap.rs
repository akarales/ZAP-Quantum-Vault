use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TransferType {
    UnsignedTx,
    SignedTx,
    EncryptedKey,
}

impl TransferType {
    /// Stable single-byte tag used when binding the transfer type into the
    /// envelope's signed message. Must never be reordered/reused.
    pub fn tag(&self) -> u8 {
        match self {
            TransferType::UnsignedTx => 1,
            TransferType::SignedTx => 2,
            TransferType::EncryptedKey => 3,
        }
    }
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
