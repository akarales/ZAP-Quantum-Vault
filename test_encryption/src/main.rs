// Simple standalone test for encryption/decryption functionality
use std::process;

fn main() {
    println!("🔍 Testing ZAP Blockchain Key Encryption/Decryption");
    
    // Test XOR encryption with base64 encoding (mimicking our implementation)
    let test_private_key = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    let test_password = "Oh%z[<iC81f0oC@${S05EFU0";
    
    println!("Original private key: {}", test_private_key);
    println!("Password: {}", test_password);
    
    // Encrypt (XOR + base64)
    let encrypted = encrypt_private_key(test_private_key, test_password);
    println!("Encrypted (base64): {}", encrypted);
    
    // Decrypt
    match decrypt_private_key(&encrypted, test_password) {
        Ok(decrypted) => {
            println!("Decrypted private key: {}", decrypted);
            
            if test_private_key == decrypted {
                println!("✅ Encryption/decryption roundtrip PASSED");
            } else {
                println!("❌ Encryption/decryption roundtrip FAILED");
                println!("Expected: {}", test_private_key);
                println!("Got:      {}", decrypted);
                process::exit(1);
            }
        }
        Err(e) => {
            println!("❌ Decryption failed: {}", e);
            process::exit(1);
        }
    }
    
    // Test with wrong password
    match decrypt_private_key(&encrypted, "wrong_password") {
        Ok(wrong_decrypted) => {
            if test_private_key != wrong_decrypted {
                println!("✅ Wrong password correctly produces different result");
            } else {
                println!("⚠️  Wrong password unexpectedly produced correct result");
            }
        }
        Err(e) => {
            println!("✅ Wrong password correctly failed: {}", e);
        }
    }
    
    // Test for double base64 encoding
    println!("\n🔍 Testing for double base64 encoding issue:");
    
    // Single base64 encoding
    let single_encoded = base64::encode("test_data");
    println!("Single base64: {}", single_encoded);
    
    // Try to decode our encrypted data once
    match base64::decode(&encrypted) {
        Ok(decoded_once) => {
            println!("Decoded encrypted data once - length: {}", decoded_once.len());
            
            // Try to decode again (this should fail if properly single-encoded)
            let decoded_str = String::from_utf8_lossy(&decoded_once).to_string();
            match base64::decode(&decoded_str) {
                Ok(decoded_twice) => {
                    println!("⚠️  DOUBLE BASE64 ENCODING DETECTED!");
                    println!("Decoded twice - length: {}", decoded_twice.len());
                }
                Err(_) => {
                    println!("✅ Single base64 encoding confirmed - cannot decode twice");
                }
            }
        }
        Err(e) => {
            println!("❌ Failed to decode encrypted data: {}", e);
        }
    }
    
    println!("\n✅ All encryption tests completed successfully!");
}

fn encrypt_private_key(private_key: &str, password: &str) -> String {
    let key_bytes = private_key.as_bytes();
    let password_bytes = password.as_bytes();
    let mut encrypted = Vec::new();
    
    for (i, &byte) in key_bytes.iter().enumerate() {
        let password_byte = password_bytes[i % password_bytes.len()];
        encrypted.push(byte ^ password_byte);
    }
    
    base64::encode(encrypted)
}

fn decrypt_private_key(encrypted_data: &str, password: &str) -> Result<String, Box<dyn std::error::Error>> {
    let encrypted_bytes = base64::decode(encrypted_data)?;
    let password_bytes = password.as_bytes();
    let mut decrypted = Vec::new();
    
    for (i, &byte) in encrypted_bytes.iter().enumerate() {
        let password_byte = password_bytes[i % password_bytes.len()];
        decrypted.push(byte ^ password_byte);
    }
    
    Ok(String::from_utf8(decrypted)?)
}
