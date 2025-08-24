use argon2::{
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier
};
use argon2::password_hash::{rand_core::OsRng, SaltString};
use base64::{Engine as _, engine::general_purpose};
use aes_gcm::{Aes256Gcm, Key, Nonce, KeyInit};
use aes_gcm::aead::{Aead, AeadCore, OsRng as AeadOsRng};
use anyhow::{Result, anyhow};

pub fn hash_password(password: &str) -> Result<(String, String)> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)?
        .to_string();
    
    Ok((password_hash, salt.to_string()))
}

pub fn verify_password(password: &str, hash: &str, _salt: &str) -> Result<bool> {
    let parsed_hash = PasswordHash::new(hash)?;
    let argon2 = Argon2::default();
    
    match argon2.verify_password(password.as_bytes(), &parsed_hash) {
        Ok(()) => Ok(true),
        Err(_) => Ok(false),
    }
}

pub fn encrypt_data(data: &str) -> Result<String> {
    // Generate a random 256-bit key
    let key = Aes256Gcm::generate_key(AeadOsRng);
    let cipher = Aes256Gcm::new(&key);
    
    // Generate a random nonce
    let nonce = Aes256Gcm::generate_nonce(&mut AeadOsRng);
    
    // Encrypt the data
    let ciphertext = cipher.encrypt(&nonce, data.as_bytes())
        .map_err(|e| anyhow!("Encryption failed: {}", e))?;
    
    // Combine key + nonce + ciphertext and encode as base64
    let mut combined = Vec::new();
    combined.extend_from_slice(key.as_slice());
    combined.extend_from_slice(nonce.as_slice());
    combined.extend_from_slice(&ciphertext);
    
    Ok(general_purpose::STANDARD.encode(combined))
}

pub fn decrypt_data(encrypted_data: &str) -> Result<String> {
    // Decode from base64
    let combined = general_purpose::STANDARD.decode(encrypted_data)?;
    
    if combined.len() < 32 + 12 {
        return Err(anyhow!("Invalid encrypted data format"));
    }
    
    // Extract key (32 bytes), nonce (12 bytes), and ciphertext
    let key = Key::<Aes256Gcm>::from_slice(&combined[0..32]);
    let nonce = Nonce::from_slice(&combined[32..44]);
    let ciphertext = &combined[44..];
    
    // Decrypt the data
    let cipher = Aes256Gcm::new(key);
    let plaintext = cipher.decrypt(nonce, ciphertext)
        .map_err(|e| anyhow!("Decryption failed: {}", e))?;
    
    String::from_utf8(plaintext)
        .map_err(|e| anyhow!("Invalid UTF-8 in decrypted data: {}", e))
}

pub fn serialize_tags(tags: &Option<Vec<String>>) -> String {
    match tags {
        Some(tag_vec) => serde_json::to_string(tag_vec).unwrap_or_default(),
        None => String::new(),
    }
}

pub fn deserialize_tags(tags_str: &str) -> Option<Vec<String>> {
    if tags_str.is_empty() {
        None
    } else {
        serde_json::from_str(tags_str).ok()
    }
}
