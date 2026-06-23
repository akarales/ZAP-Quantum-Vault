pub fn hash_tx(tx_bytes: &[u8]) -> [u8; 32] {
    let mut hasher = blake3::Hasher::new();
    hasher.update(b"ZAP_tx_hash");
    hasher.update(tx_bytes);
    let hash = hasher.finalize();
    let mut result = [0u8; 32];
    result.copy_from_slice(&hash.as_bytes()[..32]);
    result
}

pub fn hash_tx_hex(tx_bytes: &[u8]) -> String {
    hex::encode(hash_tx(tx_bytes))
}

pub fn hash_block(block_bytes: &[u8]) -> [u8; 32] {
    let mut hasher = blake3::Hasher::new();
    hasher.update(b"ZAP_block_hash");
    hasher.update(block_bytes);
    let hash = hasher.finalize();
    let mut result = [0u8; 32];
    result.copy_from_slice(&hash.as_bytes()[..32]);
    result
}

pub fn hash_block_hex(block_bytes: &[u8]) -> String {
    hex::encode(hash_block(block_bytes))
}

pub fn hash_to_hex(hash: &[u8; 32]) -> String {
    hex::encode(hash)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tx_hash_deterministic() {
        let data = b"test transaction data";
        let h1 = hash_tx(data);
        let h2 = hash_tx(data);
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_tx_hash_different_data() {
        let h1 = hash_tx(b"data1");
        let h2 = hash_tx(b"data2");
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_tx_hash_hex_length() {
        let hex = hash_tx_hex(b"test");
        assert_eq!(hex.len(), 64);
    }

    #[test]
    fn test_block_hash_deterministic() {
        let data = b"test block data";
        let h1 = hash_block(data);
        let h2 = hash_block(data);
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_tx_and_block_hashes_differ() {
        let data = b"same data";
        assert_ne!(hash_tx(data), hash_block(data));
    }
}
