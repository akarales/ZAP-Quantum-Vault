# Bitcoin Rust Development Guide for ZAP Quantum Vault

## Overview

This guide provides comprehensive documentation for Bitcoin development in Rust using the `bitcoin` crate v0.32.7 and `secp256k1` crate v0.31.1. It covers key generation, address creation, transaction handling, and integration with post-quantum cryptography for the ZAP Quantum Vault project.

## Dependencies

```toml
[dependencies]
bitcoin = "0.32.7"
secp256k1 = { version = "0.31.1", features = ["rand-std", "recovery"] }
rand = "0.8"
hex = "0.4"
```

## Core Concepts

### 1. Secp256k1 Context

The secp256k1 context is required for all cryptographic operations:

```rust
use secp256k1::{Secp256k1, SecretKey, PublicKey};

// For signing and verification
let secp = Secp256k1::new();

// For signing only (more efficient)
let secp = Secp256k1::signing_only();

// For verification only (more efficient)
let secp = Secp256k1::verification_only();
```

### 2. Network Types

Bitcoin supports multiple networks:

```rust
use bitcoin::Network;

let network = Network::Bitcoin;     // Mainnet
let network = Network::Testnet;     // Testnet
let network = Network::Signet;      // Signet
let network = Network::Regtest;     // Regtest (local development)
```

## Key Generation

### 1. Private Key Generation

```rust
use secp256k1::{Secp256k1, SecretKey};
use rand::rngs::OsRng;

let secp = Secp256k1::new();
let mut rng = OsRng;

// Generate random private key
let secret_key = SecretKey::new(&mut rng);

// From bytes (32 bytes)
let key_bytes: [u8; 32] = [/* your 32 bytes */];
let secret_key = SecretKey::from_slice(&key_bytes)?;

// From hex string
let hex_key = "your_hex_private_key";
let key_bytes = hex::decode(hex_key)?;
let secret_key = SecretKey::from_slice(&key_bytes)?;
```

### 2. Public Key Generation

```rust
use bitcoin::key::{CompressedPublicKey, PublicKey as BitcoinPublicKey};

// Generate secp256k1 public key
let secp_pubkey = secret_key.public_key(&secp);

// Compressed public key (33 bytes) - RECOMMENDED
let compressed_pubkey = CompressedPublicKey::from_private_key(&secp, &secret_key);

// Uncompressed public key (65 bytes) - Legacy only
let uncompressed_pubkey = BitcoinPublicKey::new_uncompressed(secp_pubkey);
```

### 3. Quantum-Enhanced Key Generation

For ZAP Quantum Vault's post-quantum security:

```rust
use blake3::Hasher;
use pqcrypto_kyber::kyber1024;
use pqcrypto_dilithium::dilithium5;

pub fn generate_quantum_enhanced_entropy() -> Result<[u8; 32], Box<dyn std::error::Error>> {
    // Generate post-quantum key material
    let (kyber_pk, kyber_sk) = kyber1024::keypair();
    let (dilithium_pk, dilithium_sk) = dilithium5::keypair();
    
    // Combine with system entropy
    let mut system_entropy = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut system_entropy);
    
    // Hash all entropy sources with Blake3
    let mut hasher = Hasher::new();
    hasher.update(&kyber_pk.as_bytes());
    hasher.update(&kyber_sk.as_bytes());
    hasher.update(&dilithium_pk.as_bytes());
    hasher.update(&system_entropy);
    
    let hash = hasher.finalize();
    Ok(*hash.as_bytes())
}

// Use quantum-enhanced entropy for Bitcoin key generation
let quantum_entropy = generate_quantum_enhanced_entropy()?;
let secret_key = SecretKey::from_slice(&quantum_entropy)?;
```

## Address Generation

### 1. Legacy P2PKH Addresses

```rust
use bitcoin::Address;

// Legacy Pay-to-Public-Key-Hash
let address = Address::p2pkh(&compressed_pubkey, Network::Bitcoin);
println!("Legacy address: {}", address);
```

### 2. SegWit P2WPKH Addresses (Native Bech32)

```rust
// Native SegWit - Returns Result in v0.32.7
let address = Address::p2wpkh(&compressed_pubkey, Network::Bitcoin)
    .map_err(|e| format!("Failed to create P2WPKH address: {}", e))?;
println!("Native SegWit address: {}", address);
```

### 3. SegWit P2SH-P2WPKH Addresses (Wrapped SegWit)

```rust
// Wrapped SegWit - Returns Result in v0.32.7
let address = Address::p2shwpkh(&compressed_pubkey, Network::Bitcoin)
    .map_err(|e| format!("Failed to create P2SH-P2WPKH address: {}", e))?;
println!("Wrapped SegWit address: {}", address);
```

### 4. Taproot P2TR Addresses

```rust
use bitcoin::key::Keypair;

// Generate Taproot keypair
let keypair = Keypair::from_secret_key(&secp, &secret_key);
let (xonly_pubkey, _parity) = keypair.x_only_public_key();

// Create Taproot address
let address = Address::p2tr(&secp, xonly_pubkey, None, Network::Bitcoin);
println!("Taproot address: {}", address);
```

### 5. Multi-Signature Addresses

```rust
use bitcoin::script::Builder;
use bitcoin::opcodes::all::*;

// 2-of-3 multisig
let pubkeys = vec![pubkey1, pubkey2, pubkey3];
let script = Builder::new()
    .push_opcode(OP_PUSHNUM_2)  // Require 2 signatures
    .push_key(&pubkeys[0])
    .push_key(&pubkeys[1])
    .push_key(&pubkeys[2])
    .push_opcode(OP_PUSHNUM_3)  // Out of 3 keys
    .push_opcode(OP_CHECKMULTISIG)
    .into_script();

let address = Address::p2sh(&script, Network::Bitcoin)?;
```

## Key Serialization and Storage

### 1. Private Key Formats

```rust
// WIF (Wallet Import Format)
let wif = secret_key.display_secret();
println!("WIF: {}", wif);

// Raw bytes
let key_bytes = secret_key.secret_bytes();

// Hex string
let hex_key = hex::encode(key_bytes);
```

### 2. Public Key Formats

```rust
// Compressed (33 bytes)
let compressed_bytes = compressed_pubkey.to_bytes();

// Hex string
let hex_pubkey = hex::encode(compressed_bytes);

// Address string
let address_string = address.to_string();
```

## Secure Key Storage with Encryption

### 1. Password-Based Key Derivation

```rust
use argon2::{Argon2, PasswordHasher, PasswordHash, PasswordVerifier};
use argon2::password_hash::{rand_core::OsRng, SaltString};

pub fn derive_key_from_password(password: &str) -> Result<[u8; 32], Box<dyn std::error::Error>> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    
    let password_hash = argon2.hash_password(password.as_bytes(), &salt)?;
    let hash_bytes = password_hash.hash.unwrap().as_bytes();
    
    let mut key = [0u8; 32];
    key.copy_from_slice(&hash_bytes[..32]);
    Ok(key)
}
```

### 2. AES-GCM Encryption

```rust
use aes_gcm::{Aes256Gcm, Key, Nonce, KeyInit};
use aes_gcm::aead::{Aead, generic_array::GenericArray};

pub fn encrypt_private_key(
    private_key: &SecretKey,
    password: &str,
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    // Derive encryption key from password
    let key_bytes = derive_key_from_password(password)?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    
    // Generate random nonce
    let nonce_bytes: [u8; 12] = rand::random();
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Encrypt private key
    let plaintext = private_key.secret_bytes();
    let ciphertext = cipher.encrypt(nonce, plaintext.as_ref())?;
    
    // Combine nonce + ciphertext
    let mut encrypted = Vec::new();
    encrypted.extend_from_slice(&nonce_bytes);
    encrypted.extend_from_slice(&ciphertext);
    
    Ok(encrypted)
}

pub fn decrypt_private_key(
    encrypted_data: &[u8],
    password: &str,
) -> Result<SecretKey, Box<dyn std::error::Error>> {
    if encrypted_data.len() < 12 {
        return Err("Invalid encrypted data".into());
    }
    
    // Extract nonce and ciphertext
    let (nonce_bytes, ciphertext) = encrypted_data.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    
    // Derive decryption key
    let key_bytes = derive_key_from_password(password)?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    
    // Decrypt
    let plaintext = cipher.decrypt(nonce, ciphertext)?;
    let secret_key = SecretKey::from_slice(&plaintext)?;
    
    Ok(secret_key)
}
```

## HD Wallets (BIP32/BIP44)

### 1. Extended Keys

```rust
use bitcoin::bip32::{ExtendedPrivKey, ExtendedPubKey, DerivationPath};

// Generate master key from seed
let seed: [u8; 64] = [/* your seed */];
let master_key = ExtendedPrivKey::new_master(Network::Bitcoin, &seed)?;

// Derive child keys
let derivation_path = DerivationPath::from_str("m/44'/0'/0'/0/0")?;
let child_key = master_key.derive_priv(&secp, &derivation_path)?;

// Get corresponding public key
let child_pubkey = ExtendedPubKey::from_priv(&secp, &child_key);
```

### 2. BIP44 Standard Paths

```rust
// Bitcoin mainnet: m/44'/0'/account'/change/address_index
// Bitcoin testnet: m/44'/1'/account'/change/address_index

fn derive_bip44_address(
    master_key: &ExtendedPrivKey,
    account: u32,
    change: u32,
    address_index: u32,
) -> Result<Address, Box<dyn std::error::Error>> {
    let secp = Secp256k1::new();
    
    let path = format!("m/44'/0'/{}'/{}/{}", account, change, address_index);
    let derivation_path = DerivationPath::from_str(&path)?;
    
    let child_key = master_key.derive_priv(&secp, &derivation_path)?;
    let compressed_pubkey = CompressedPublicKey::from_private_key(&secp, &child_key.private_key);
    
    let address = Address::p2wpkh(&compressed_pubkey, Network::Bitcoin)?;
    Ok(address)
}
```

## Error Handling

### 1. Common Error Types

```rust
use bitcoin::address::Error as AddressError;
use secp256k1::Error as Secp256k1Error;

#[derive(Debug)]
pub enum BitcoinKeyError {
    Secp256k1(Secp256k1Error),
    Address(AddressError),
    InvalidKeyLength,
    EncryptionError(String),
    DerivationError(String),
}

impl From<Secp256k1Error> for BitcoinKeyError {
    fn from(err: Secp256k1Error) -> Self {
        BitcoinKeyError::Secp256k1(err)
    }
}

impl From<AddressError> for BitcoinKeyError {
    fn from(err: AddressError) -> Self {
        BitcoinKeyError::Address(err)
    }
}
```

### 2. Safe Key Generation

```rust
pub fn generate_bitcoin_key_safe() -> Result<(SecretKey, Address), BitcoinKeyError> {
    let secp = Secp256k1::new();
    
    // Generate quantum-enhanced entropy
    let entropy = generate_quantum_enhanced_entropy()
        .map_err(|e| BitcoinKeyError::EncryptionError(e.to_string()))?;
    
    // Create private key
    let secret_key = SecretKey::from_slice(&entropy)?;
    
    // Generate compressed public key
    let compressed_pubkey = CompressedPublicKey::from_private_key(&secp, &secret_key);
    
    // Create native SegWit address
    let address = Address::p2wpkh(&compressed_pubkey, Network::Bitcoin)?;
    
    Ok((secret_key, address))
}
```

## Testing and Validation

### 1. Key Validation

```rust
pub fn validate_private_key(key_hex: &str) -> Result<SecretKey, BitcoinKeyError> {
    let key_bytes = hex::decode(key_hex)
        .map_err(|_| BitcoinKeyError::InvalidKeyLength)?;
    
    if key_bytes.len() != 32 {
        return Err(BitcoinKeyError::InvalidKeyLength);
    }
    
    let secret_key = SecretKey::from_slice(&key_bytes)?;
    Ok(secret_key)
}
```

### 2. Address Validation

```rust
use bitcoin::Address;
use std::str::FromStr;

pub fn validate_bitcoin_address(address_str: &str, network: Network) -> Result<Address, BitcoinKeyError> {
    let address = Address::from_str(address_str)
        .map_err(|e| BitcoinKeyError::Address(e))?;
    
    // Verify network matches
    if address.network != network {
        return Err(BitcoinKeyError::DerivationError("Network mismatch".to_string()));
    }
    
    Ok(address)
}
```

## Integration with ZAP Quantum Vault

### 1. Key Storage Structure

```rust
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BitcoinKey {
    pub id: String,
    pub name: String,
    pub key_type: BitcoinKeyType,
    pub address: String,
    pub network: String,
    pub encrypted_private_key: Vec<u8>,
    pub derivation_path: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub last_used: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum BitcoinKeyType {
    Legacy,      // P2PKH
    SegWit,      // P2WPKH
    WrappedSegWit, // P2SH-P2WPKH
    Taproot,     // P2TR
    MultiSig,    // Multi-signature
}
```

### 2. Database Integration

```rust
use rusqlite::{Connection, params};

pub fn store_bitcoin_key(
    conn: &Connection,
    key: &BitcoinKey,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO bitcoin_keys (
            id, name, key_type, address, network, 
            encrypted_private_key, derivation_path, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            key.id,
            key.name,
            serde_json::to_string(&key.key_type).unwrap(),
            key.address,
            key.network,
            key.encrypted_private_key,
            key.derivation_path,
            key.created_at.to_rfc3339(),
        ],
    )?;
    Ok(())
}
```

## Security Best Practices

### 1. Memory Security

```rust
use zeroize::Zeroize;

// Always zeroize sensitive data
let mut private_key_bytes = secret_key.secret_bytes();
// ... use the key ...
private_key_bytes.zeroize();
```

### 2. Secure Random Generation

```rust
// Use cryptographically secure random number generator
use rand::rngs::OsRng;

let mut rng = OsRng;
let secret_key = SecretKey::new(&mut rng);
```

### 3. Key Backup and Recovery

```rust
pub fn backup_key_to_cold_storage(
    key: &BitcoinKey,
    backup_path: &str,
    password: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // Create backup package with metadata
    let backup_data = serde_json::to_vec_pretty(key)?;
    
    // Encrypt backup
    let encrypted_backup = encrypt_data(&backup_data, password)?;
    
    // Write to cold storage
    std::fs::write(backup_path, encrypted_backup)?;
    
    Ok(())
}
```

## Performance Considerations

### 1. Context Reuse

```rust
// Reuse secp256k1 context for better performance
lazy_static! {
    static ref SECP: Secp256k1<secp256k1::All> = Secp256k1::new();
}

pub fn generate_key_optimized() -> Result<SecretKey, secp256k1::Error> {
    let mut rng = OsRng;
    SecretKey::new(&mut rng)
}
```

### 2. Batch Operations

```rust
pub fn generate_multiple_keys(count: usize) -> Result<Vec<(SecretKey, Address)>, BitcoinKeyError> {
    let secp = &*SECP;
    let mut keys = Vec::with_capacity(count);
    
    for _ in 0..count {
        let (secret_key, address) = generate_bitcoin_key_safe()?;
        keys.push((secret_key, address));
    }
    
    Ok(keys)
}
```

## Conclusion

This guide provides a comprehensive foundation for Bitcoin development in Rust with the latest crate versions. The integration with post-quantum cryptography makes ZAP Quantum Vault future-proof against quantum computing threats while maintaining compatibility with existing Bitcoin infrastructure.

For production use, always:
- Use secure random number generation
- Encrypt private keys at rest
- Implement proper error handling
- Validate all inputs
- Follow security best practices
- Test thoroughly on testnet before mainnet deployment

## References

- [Bitcoin Crate Documentation](https://docs.rs/bitcoin/)
- [Secp256k1 Crate Documentation](https://docs.rs/secp256k1/)
- [BIP32 - Hierarchical Deterministic Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP44 - Multi-Account Hierarchy](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [Post-Quantum Cryptography Standards](https://csrc.nist.gov/projects/post-quantum-cryptography)
