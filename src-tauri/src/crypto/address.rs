pub fn derive_address(public_key: &[u8]) -> String {
    let mut hasher = blake3::Hasher::new();
    hasher.update(b"ZAP_address");
    hasher.update(public_key);
    let hash = hasher.finalize();
    let mut addr = [0u8; 20];
    addr.copy_from_slice(&hash.as_bytes()[..20]);
    bech32_encode("zap1", &addr)
}

fn bech32_encode(hrp: &str, data: &[u8]) -> String {
    const CHARSET: &[u8] = b"qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    let mut result = String::new();
    result.push_str(hrp);
    for byte in data {
        let hi = (byte >> 4) as usize;
        let lo = (byte & 0x0f) as usize;
        result.push(CHARSET[hi] as char);
        result.push(CHARSET[lo] as char);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::mldsa87;

    #[test]
    fn test_address_starts_with_zap1() {
        let (pk, _) = mldsa87::generate();
        let addr = derive_address(pk.as_bytes());
        assert!(addr.starts_with("zap1"));
        assert!(addr.len() > 10);
    }

    #[test]
    fn test_address_deterministic() {
        let (pk, _) = mldsa87::generate();
        let addr1 = derive_address(pk.as_bytes());
        let addr2 = derive_address(pk.as_bytes());
        assert_eq!(addr1, addr2);
    }

    #[test]
    fn test_different_keys_different_addresses() {
        let (pk1, _) = mldsa87::generate();
        let (pk2, _) = mldsa87::generate();
        assert_ne!(derive_address(pk1.as_bytes()), derive_address(pk2.as_bytes()));
    }
}
