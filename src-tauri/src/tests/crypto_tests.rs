#[cfg(test)]
mod tests {
    use crate::crypto::{hash_password, verify_password, encrypt_data, decrypt_data, serialize_tags, deserialize_tags};

    #[test]
    fn test_password_hashing() {
        let password = "test_password_123";
        let (hash, salt) = hash_password(password).unwrap();
        
        assert!(!hash.is_empty());
        assert!(!salt.is_empty());
        assert_ne!(hash, password);
        assert!(hash.len() > 32); // Should be a proper hash length
    }

    #[test]
    fn test_password_verification() {
        let password = "test_password_123";
        let (hash, salt) = hash_password(password).unwrap();
        
        // Correct password should verify
        assert!(verify_password(password, &hash, &salt).unwrap());
        
        // Wrong password should not verify
        assert!(!verify_password("wrong_password", &hash, &salt).unwrap());
    }

    #[test]
    fn test_password_salt_uniqueness() {
        let password = "same_password";
        let (hash1, salt1) = hash_password(password).unwrap();
        let (hash2, salt2) = hash_password(password).unwrap();
        
        // Same password should produce different hashes due to unique salts
        assert_ne!(hash1, hash2);
        assert_ne!(salt1, salt2);
        
        // Both should verify correctly
        assert!(verify_password(password, &hash1, &salt1).unwrap());
        assert!(verify_password(password, &hash2, &salt2).unwrap());
    }

    #[test]
    fn test_data_encryption_decryption() {
        let data = "sensitive test data";
        
        let encrypted = encrypt_data(data).unwrap();
        assert_ne!(encrypted, data);
        assert!(!encrypted.is_empty());
        
        let decrypted = decrypt_data(&encrypted).unwrap();
        assert_eq!(decrypted, data);
    }

    #[test]
    fn test_empty_data_encryption() {
        let data = "";
        
        let encrypted = encrypt_data(data).unwrap();
        let decrypted = decrypt_data(&encrypted).unwrap();
        
        assert_eq!(decrypted, data);
    }

    #[test]
    fn test_large_data_encryption() {
        let data = "a".repeat(10000); // 10KB of data
        
        let encrypted = encrypt_data(&data).unwrap();
        let decrypted = decrypt_data(&encrypted).unwrap();
        
        assert_eq!(decrypted, data);
    }

    #[test]
    fn test_tag_serialization() {
        let tags = Some(vec!["tag1".to_string(), "tag2".to_string(), "tag3".to_string()]);
        
        let serialized = serialize_tags(&tags);
        assert!(!serialized.is_empty());
        
        let deserialized = deserialize_tags(&serialized);
        assert_eq!(deserialized, tags);
    }

    #[test]
    fn test_empty_tags_serialization() {
        let tags: Option<Vec<String>> = Some(vec![]);
        
        let serialized = serialize_tags(&tags);
        let deserialized = deserialize_tags(&serialized);
        
        assert_eq!(deserialized, tags);
    }

    #[test]
    fn test_tags_with_special_characters() {
        let tags = Some(vec![
            "tag with spaces".to_string(),
            "tag,with,commas".to_string(),
            "tag\"with\"quotes".to_string(),
        ]);
        
        let serialized = serialize_tags(&tags);
        let deserialized = deserialize_tags(&serialized);
        
        assert_eq!(deserialized, tags);
    }

    #[test]
    fn test_encryption_determinism() {
        let data = "test data";
        
        let encrypted1 = encrypt_data(data).unwrap();
        let encrypted2 = encrypt_data(data).unwrap();
        
        // Encryption should be non-deterministic (different each time due to random nonce)
        assert_ne!(encrypted1, encrypted2);
        
        // But both should decrypt to the same data
        assert_eq!(decrypt_data(&encrypted1).unwrap(), data);
        assert_eq!(decrypt_data(&encrypted2).unwrap(), data);
    }
}
