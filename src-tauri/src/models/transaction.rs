use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnsignedTx {
    pub tx_hash_hex: String,
    pub tx_bytes_hex: String,
    pub from_address: String,
    pub to_address: String,
    pub amount: u64,
    pub fee: u64,
    pub nonce: u64,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedTx {
    pub unsigned: UnsignedTx,
    pub signature_hex: String,
    pub public_key_hex: String,
}
