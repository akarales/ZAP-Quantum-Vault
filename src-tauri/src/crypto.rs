use anyhow::Result;
use argon2::{Argon2, PasswordHasher, PasswordVerifier};
use argon2::password_hash::{SaltString, PasswordHash};

pub fn hash_password(password: &str) -> Result<(String, String)> {
    // Use a simple approach: generate 16 random bytes for salt
    let mut salt_bytes = [0u8; 16];
    for i in 0..16 {
        salt_bytes[i] = (uuid::Uuid::new_v4().as_bytes()[i % 16]) ^ (i as u8);
    }
    
    // Create salt string from bytes
    let salt = SaltString::encode_b64(&salt_bytes)
        .map_err(|e| anyhow::anyhow!("Salt encoding failed: {}", e))?;
    
    let argon2 = Argon2::default();
    
    // Hash password to PHC string ($argon2id$v=19$...)
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow::anyhow!("Password hashing failed: {}", e))?
        .to_string();
    
    Ok((password_hash, salt.to_string()))
}

pub fn verify_password(password: &str, hash: &str, _salt: &str) -> Result<bool> {
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| anyhow::anyhow!("Invalid password hash: {}", e))?;
    let argon2 = Argon2::default();
    
    Ok(argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok())
}
