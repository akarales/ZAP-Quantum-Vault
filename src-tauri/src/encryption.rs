use aes_gcm::{Aes256Gcm, Nonce, KeyInit, AeadInPlace};
use argon2::Argon2;
use rand::RngCore;
use rand::rngs::OsRng;
use secrecy::{Secret, ExposeSecret, Zeroize};
use serde::{Serialize, Deserialize};
use thiserror::Error;
use base64::{Engine as _, engine::general_purpose};

#[derive(Error, Debug)]
pub enum EncryptionError {
    #[error("Argon2 key derivation failed: {0}")]
    KeyDerivation(String),
    #[error("AES-GCM encryption failed: {0}")]
    EncryptionFailed(String),
    #[error("AES-GCM decryption failed: {0}")]
    DecryptionFailed(String),
    #[error("Invalid data format: {0}")]
    InvalidFormat(String),
    #[error("Base64 encoding/decoding failed: {0}")]
    Base64Error(String),
    #[error("Weak password: {0}")]
    WeakPassword(String),
}

/// Secure password wrapper that zeros memory on drop
#[derive(Clone)]
pub struct SecurePassword(Secret<String>);

impl SecurePassword {
    pub fn new(password: String) -> Result<Self, EncryptionError> {
        if password.len() < 8 {
            return Err(EncryptionError::WeakPassword("Password must be at least 8 characters".to_string()));
        }
        
        // Check for complexity requirements
        let has_uppercase = password.chars().any(|c| c.is_uppercase());
        let has_lowercase = password.chars().any(|c| c.is_lowercase());
        let has_digit = password.chars().any(|c| c.is_numeric());
        let has_special = password.chars().any(|c| "!@#$%^&*()_+-=[]{}|;:,.<>?".contains(c));
        
        if !(has_uppercase && has_lowercase && has_digit && has_special) {
            return Err(EncryptionError::WeakPassword(
                "Password must contain uppercase, lowercase, digit, and special character".to_string()
            ));
        }
        
        Ok(Self(Secret::new(password)))
    }
    
    /// Create SecurePassword from stored password without validation
    /// Used for previously stored passwords that may not meet current complexity requirements
    pub fn from_stored(password: String) -> Self {
        Self(Secret::new(password))
    }
    
    pub fn expose_secret(&self) -> &str {
        self.0.expose_secret()
    }
    
    /// Generate a cryptographically secure random password
    pub fn generate_secure() -> Self {
        use rand::Rng;
        let charset: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        let mut rng = rand::thread_rng();
        let password: String = (0..16)
            .map(|_| {
                let idx = rng.gen_range(0..charset.len());
                charset[idx] as char
            })
            .collect();
        Self(Secret::new(password))
    }
}

/// Encrypted data container with metadata
#[derive(Serialize, Deserialize, Clone)]
pub struct EncryptedData {
    pub data: String,           // Base64 encoded encrypted data
    pub salt: String,           // Base64 encoded salt
    pub version: u8,            // Encryption version for future upgrades
    pub algorithm: String,      // "AES-256-GCM"
}

/// Main encryption service for vault data
pub struct VaultEncryption {
    cipher: Aes256Gcm,
    salt: [u8; 32],
    version: u8,
}

impl VaultEncryption {
    const CURRENT_VERSION: u8 = 2;
    const SALT_SIZE: usize = 32;
    const NONCE_SIZE: usize = 12;
    
    /// Create new encryption instance with password and optional salt
    pub fn new(password: &SecurePassword, salt: Option<[u8; 32]>) -> Result<Self, EncryptionError> {
        let salt = salt.unwrap_or_else(|| {
            let mut s = [0u8; Self::SALT_SIZE];
            OsRng.fill_bytes(&mut s);
            s
        });
        
        // Derive key using Argon2id (secure against GPU attacks)
        let mut key = [0u8; 32];
        let argon2 = Argon2::default();
        
        argon2
            .hash_password_into(password.expose_secret().as_bytes(), &salt, &mut key)
            .map_err(|e| EncryptionError::KeyDerivation(e.to_string()))?;
        
        let cipher = Aes256Gcm::new(aes_gcm::Key::<Aes256Gcm>::from_slice(&key));
        
        // Zero the key from memory
        key.zeroize();
        
        Ok(Self {
            cipher,
            salt,
            version: Self::CURRENT_VERSION,
        })
    }
    
    /// Create from existing salt (for decryption)
    pub fn from_salt(password: &SecurePassword, salt: [u8; 32]) -> Result<Self, EncryptionError> {
        Self::new(password, Some(salt))
    }
    
    /// Encrypt plaintext data
    pub fn encrypt(&self, plaintext: &str) -> Result<EncryptedData, EncryptionError> {
        // Generate random nonce
        let mut nonce_bytes = [0u8; Self::NONCE_SIZE];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        // Encrypt the data
        let mut buffer = plaintext.as_bytes().to_vec();
        let tag = self.cipher
            .encrypt_in_place_detached(nonce, b"", &mut buffer)
            .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;
        
        // Combine nonce + ciphertext + tag
        let mut encrypted_bytes = Vec::new();
        encrypted_bytes.extend_from_slice(&nonce_bytes);
        encrypted_bytes.extend_from_slice(&buffer);
        encrypted_bytes.extend_from_slice(&tag);
        
        Ok(EncryptedData {
            data: general_purpose::STANDARD.encode(&encrypted_bytes),
            salt: general_purpose::STANDARD.encode(&self.salt),
            version: self.version,
            algorithm: "AES-256-GCM".to_string(),
        })
    }
    
    /// Decrypt encrypted data
    pub fn decrypt(&self, encrypted_data: &EncryptedData) -> Result<String, EncryptionError> {
        // Verify algorithm compatibility
        if encrypted_data.algorithm != "AES-256-GCM" {
            return Err(EncryptionError::InvalidFormat(
                format!("Unsupported algorithm: {}", encrypted_data.algorithm)
            ));
        }
        
        // Decode the encrypted data
        let encrypted_bytes = general_purpose::STANDARD.decode(&encrypted_data.data)
            .map_err(|e| EncryptionError::Base64Error(e.to_string()))?;
        
        if encrypted_bytes.len() < Self::NONCE_SIZE + 16 { // nonce + minimum tag size
            return Err(EncryptionError::InvalidFormat(
                "Encrypted data too short".to_string()
            ));
        }
        
        // Extract components
        let nonce = Nonce::from_slice(&encrypted_bytes[..Self::NONCE_SIZE]);
        let ciphertext_and_tag = &encrypted_bytes[Self::NONCE_SIZE..];
        
        if ciphertext_and_tag.len() < 16 {
            return Err(EncryptionError::InvalidFormat(
                "Invalid ciphertext length".to_string()
            ));
        }
        
        let (ciphertext, tag) = ciphertext_and_tag.split_at(ciphertext_and_tag.len() - 16);
        let mut buffer = ciphertext.to_vec();
        
        // Decrypt
        self.cipher
            .decrypt_in_place_detached(nonce, b"", &mut buffer, tag.into())
            .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;
        
        // Convert to string
        String::from_utf8(buffer)
            .map_err(|e| EncryptionError::DecryptionFailed(format!("Invalid UTF-8: {}", e)))
    }
    
    /// Get the salt used for this encryption instance
    pub fn get_salt(&self) -> [u8; 32] {
        self.salt
    }
}

/// Legacy Base64 decryption for migration purposes
pub fn decrypt_legacy_base64(encoded_data: &str) -> Result<String, EncryptionError> {
    let decoded_bytes = general_purpose::STANDARD.decode(encoded_data)
        .map_err(|e| EncryptionError::Base64Error(e.to_string()))?;
    
    String::from_utf8(decoded_bytes)
        .map_err(|e| EncryptionError::DecryptionFailed(format!("Invalid UTF-8 in legacy data: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_password_validation() {
        // Test weak passwords
        assert!(SecurePassword::new("weak".to_string()).is_err());
        assert!(SecurePassword::new("password123".to_string()).is_err());
        assert!(SecurePassword::new("PASSWORD123".to_string()).is_err());
        assert!(SecurePassword::new("Password123".to_string()).is_err()); // No special char
        
        // Test strong password
        assert!(SecurePassword::new("StrongP@ssw0rd123!".to_string()).is_ok());
        assert!(SecurePassword::new("MySecure#Pass2024".to_string()).is_ok());
    }
    
    #[test]
    fn test_encryption_roundtrip() {
        let password = SecurePassword::new("TestPassword123!".to_string()).unwrap();
        let plaintext = "This is sensitive vault data that must be protected";
        
        let encryption = VaultEncryption::new(&password, None).unwrap();
        let encrypted = encryption.encrypt(plaintext).unwrap();
        let decrypted = encryption.decrypt(&encrypted).unwrap();
        
        assert_eq!(plaintext, decrypted);
        
        // Ensure encrypted data doesn't contain plaintext
        let decoded = base64::decode(&encrypted.data).unwrap();
        assert!(!String::from_utf8_lossy(&decoded).contains(plaintext));
    }
    
    #[test]
    fn test_different_encryptions_are_different() {
        let password = SecurePassword::new("TestPassword123!".to_string()).unwrap();
        let plaintext = "Same data";
        
        let encryption = VaultEncryption::new(&password, None).unwrap();
        let encrypted1 = encryption.encrypt(plaintext).unwrap();
        let encrypted2 = encryption.encrypt(plaintext).unwrap();
        
        // Different nonces should produce different ciphertexts
        assert_ne!(encrypted1.data, encrypted2.data);
        
        // But both should decrypt to same plaintext
        assert_eq!(encryption.decrypt(&encrypted1).unwrap(), plaintext);
        assert_eq!(encryption.decrypt(&encrypted2).unwrap(), plaintext);
    }
    
    #[test]
    fn test_wrong_password_fails() {
        let password1 = SecurePassword::new("TestPassword123!".to_string()).unwrap();
        let password2 = SecurePassword::new("WrongPassword456!".to_string()).unwrap();
        let plaintext = "Secret data";
        
        let encryption1 = VaultEncryption::new(&password1, None).unwrap();
        let encrypted = encryption1.encrypt(plaintext).unwrap();
        
        // Try to decrypt with wrong password
        let encryption2 = VaultEncryption::from_salt(&password2, encryption1.get_salt()).unwrap();
        assert!(encryption2.decrypt(&encrypted).is_err());
    }
    
    #[test]
    fn test_legacy_base64_decryption() {
        let plaintext = "Legacy data";
        let encoded = base64::encode(plaintext.as_bytes());
        let decoded = decrypt_legacy_base64(&encoded).unwrap();
        assert_eq!(plaintext, decoded);
    }
}
