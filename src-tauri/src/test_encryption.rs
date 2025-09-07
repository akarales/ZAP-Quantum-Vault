use crate::zap_blockchain_keys::ZAPBlockchainKeyGenerator;
use crate::zap_blockchain_network::ZAPBlockchainNetworkConfig;
use anyhow::Result;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_decryption_roundtrip() -> Result<()> {
        // Create test components
        let network_config = ZAPBlockchainNetworkConfig {
            name: "testnet".to_string(),
            chain_id: "zap-testnet-1".to_string(),
            coin_type: 9999,
            bech32_prefix: "zap".to_string(),
        };
        
        let key_generator = ZAPBlockchainKeyGenerator::new(network_config);
        
        // Test data
        let test_password = "test_password_123";
        let test_private_key_hex = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
        
        // Test encryption
        let encrypted = key_generator.encrypt_private_key(test_private_key_hex, test_password)?;
        println!("Original private key hex: {}", test_private_key_hex);
        println!("Encrypted (base64): {}", encrypted);
        
        // Test decryption
        let decrypted = key_generator.decrypt_private_key(&encrypted, test_password)?;
        println!("Decrypted private key hex: {}", decrypted);
        
        // Verify roundtrip
        assert_eq!(test_private_key_hex, decrypted, "Encryption/decryption roundtrip failed");
        
        // Test with wrong password
        let wrong_password = "wrong_password";
        let wrong_decryption = key_generator.decrypt_private_key(&encrypted, wrong_password)?;
        assert_ne!(test_private_key_hex, wrong_decryption, "Decryption should fail with wrong password");
        
        println!("✅ Encryption/decryption roundtrip test passed!");
        Ok(())
    }
    
    #[test]
    fn test_base64_encoding_levels() -> Result<()> {
        let test_data = "test_private_key_hex_string";
        
        // Single base64 encoding
        let single_encoded = base64::encode(test_data);
        println!("Single base64: {}", single_encoded);
        
        // Double base64 encoding (what we want to avoid)
        let double_encoded = base64::encode(&single_encoded);
        println!("Double base64: {}", double_encoded);
        
        // Check if our encryption function produces single or double encoding
        let network_config = ZAPBlockchainNetworkConfig {
            name: "testnet".to_string(),
            chain_id: "zap-testnet-1".to_string(),
            coin_type: 9999,
            bech32_prefix: "zap".to_string(),
        };
        
        let key_generator = ZAPBlockchainKeyGenerator::new(network_config);
        let encrypted = key_generator.encrypt_private_key(test_data, "password")?;
        
        // Try to decode once
        let decoded_once = base64::decode(&encrypted)?;
        println!("Decoded once length: {}", decoded_once.len());
        
        // Try to decode twice (this should fail if single encoded)
        let decoded_once_str = String::from_utf8_lossy(&decoded_once).to_string();
        match base64::decode(&decoded_once_str) {
            Ok(decoded_twice) => {
                println!("⚠️  Double base64 encoding detected! Decoded twice length: {}", decoded_twice.len());
            },
            Err(_) => {
                println!("✅ Single base64 encoding confirmed - cannot decode twice");
            }
        }
        
        Ok(())
    }
}
