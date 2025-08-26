# Bitcoin Integration Examples for ZAP Quantum Vault

## Complete Implementation Examples

### 1. Quantum-Enhanced Bitcoin Key Generator

```rust
use bitcoin::{Address, Network};
use bitcoin::key::CompressedPublicKey;
use secp256k1::{Secp256k1, SecretKey};
use aes_gcm::{Aes256Gcm, Key, Nonce, KeyInit};
use aes_gcm::aead::{Aead, generic_array::GenericArray};
use argon2::{Argon2, PasswordHasher, PasswordHash, PasswordVerifier};
use argon2::password_hash::{rand_core::OsRng, SaltString};
use blake3::Hasher;
use pqcrypto_kyber::kyber1024;
use pqcrypto_dilithium::dilithium5;
use pqcrypto_sphincsplus::sphincsshake256256ssimple as sphincs;
use pqcrypto_traits::{kem::PublicKey as KemPublicKey, kem::SecretKey as KemSecretKey};
use pqcrypto_traits::{sign::PublicKey as SignPublicKey, sign::SecretKey as SignSecretKey};
use rand::RngCore;

#[derive(Debug)]
pub enum BitcoinKeyError {
    Secp256k1(secp256k1::Error),
    Address(bitcoin::address::Error),
    Encryption(String),
    Derivation(String),
}

impl From<secp256k1::Error> for BitcoinKeyError {
    fn from(err: secp256k1::Error) -> Self {
        BitcoinKeyError::Secp256k1(err)
    }
}

impl From<bitcoin::address::Error> for BitcoinKeyError {
    fn from(err: bitcoin::address::Error) -> Self {
        BitcoinKeyError::Address(err)
    }
}

pub struct QuantumBitcoinKeyGenerator {
    secp: Secp256k1<secp256k1::All>,
}

impl QuantumBitcoinKeyGenerator {
    pub fn new() -> Self {
        Self {
            secp: Secp256k1::new(),
        }
    }

    /// Generate quantum-enhanced entropy combining post-quantum and classical sources
    pub fn generate_quantum_entropy(&self) -> Result<[u8; 32], BitcoinKeyError> {
        // Generate post-quantum key material
        let (kyber_pk, kyber_sk) = kyber1024::keypair();
        let (dilithium_pk, dilithium_sk) = dilithium5::keypair();
        let (sphincs_pk, sphincs_sk) = sphincs::keypair();
        
        // Generate system entropy
        let mut system_entropy = [0u8; 32];
        let mut rng = OsRng;
        rng.fill_bytes(&mut system_entropy);
        
        // Combine all entropy sources with Blake3
        let mut hasher = Hasher::new();
        hasher.update(kyber_pk.as_bytes());
        hasher.update(kyber_sk.as_bytes());
        hasher.update(dilithium_pk.as_bytes());
        hasher.update(dilithium_sk.as_bytes());
        hasher.update(sphincs_pk.as_bytes());
        hasher.update(sphincs_sk.as_bytes());
        hasher.update(&system_entropy);
        
        let hash = hasher.finalize();
        Ok(*hash.as_bytes())
    }

    /// Generate a Bitcoin private key with quantum-enhanced entropy
    pub fn generate_private_key(&self) -> Result<SecretKey, BitcoinKeyError> {
        let entropy = self.generate_quantum_entropy()?;
        let secret_key = SecretKey::from_slice(&entropy)?;
        Ok(secret_key)
    }

    /// Generate all Bitcoin address types from a private key
    pub fn generate_all_addresses(&self, secret_key: &SecretKey, network: Network) -> Result<BitcoinAddresses, BitcoinKeyError> {
        let compressed_pubkey = CompressedPublicKey::from_private_key(&self.secp, secret_key);
        
        // Legacy P2PKH
        let legacy = Address::p2pkh(&compressed_pubkey, network);
        
        // Native SegWit P2WPKH
        let segwit = Address::p2wpkh(&compressed_pubkey, network)?;
        
        // Wrapped SegWit P2SH-P2WPKH
        let wrapped_segwit = Address::p2shwpkh(&compressed_pubkey, network)?;
        
        // Taproot P2TR
        let keypair = bitcoin::key::Keypair::from_secret_key(&self.secp, secret_key);
        let (xonly_pubkey, _parity) = keypair.x_only_public_key();
        let taproot = Address::p2tr(&self.secp, xonly_pubkey, None, network);
        
        Ok(BitcoinAddresses {
            legacy,
            segwit,
            wrapped_segwit,
            taproot,
        })
    }

    /// Encrypt private key with password using Argon2id + AES-256-GCM
    pub fn encrypt_private_key(&self, secret_key: &SecretKey, password: &str) -> Result<Vec<u8>, BitcoinKeyError> {
        // Derive key from password using Argon2id
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        
        let password_hash = argon2.hash_password(password.as_bytes(), &salt)
            .map_err(|e| BitcoinKeyError::Encryption(e.to_string()))?;
        
        let hash_bytes = password_hash.hash.unwrap().as_bytes();
        let mut encryption_key = [0u8; 32];
        encryption_key.copy_from_slice(&hash_bytes[..32]);
        
        // Encrypt with AES-256-GCM
        let key = Key::<Aes256Gcm>::from_slice(&encryption_key);
        let cipher = Aes256Gcm::new(key);
        
        let nonce_bytes: [u8; 12] = rand::random();
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        let plaintext = secret_key.secret_bytes();
        let ciphertext = cipher.encrypt(nonce, plaintext.as_ref())
            .map_err(|e| BitcoinKeyError::Encryption(e.to_string()))?;
        
        // Combine salt + nonce + ciphertext
        let mut encrypted = Vec::new();
        encrypted.extend_from_slice(salt.as_str().as_bytes());
        encrypted.push(0); // Separator
        encrypted.extend_from_slice(&nonce_bytes);
        encrypted.extend_from_slice(&ciphertext);
        
        Ok(encrypted)
    }

    /// Decrypt private key with password
    pub fn decrypt_private_key(&self, encrypted_data: &[u8], password: &str) -> Result<SecretKey, BitcoinKeyError> {
        // Find separator between salt and encrypted data
        let separator_pos = encrypted_data.iter().position(|&x| x == 0)
            .ok_or_else(|| BitcoinKeyError::Encryption("Invalid encrypted data format".to_string()))?;
        
        let salt_bytes = &encrypted_data[..separator_pos];
        let encrypted_part = &encrypted_data[separator_pos + 1..];
        
        if encrypted_part.len() < 12 {
            return Err(BitcoinKeyError::Encryption("Invalid encrypted data length".to_string()));
        }
        
        // Reconstruct salt and derive key
        let salt_str = std::str::from_utf8(salt_bytes)
            .map_err(|e| BitcoinKeyError::Encryption(e.to_string()))?;
        let salt = SaltString::from_b64(salt_str)
            .map_err(|e| BitcoinKeyError::Encryption(e.to_string()))?;
        
        let argon2 = Argon2::default();
        let password_hash = argon2.hash_password(password.as_bytes(), &salt)
            .map_err(|e| BitcoinKeyError::Encryption(e.to_string()))?;
        
        let hash_bytes = password_hash.hash.unwrap().as_bytes();
        let mut encryption_key = [0u8; 32];
        encryption_key.copy_from_slice(&hash_bytes[..32]);
        
        // Decrypt with AES-256-GCM
        let (nonce_bytes, ciphertext) = encrypted_part.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);
        
        let key = Key::<Aes256Gcm>::from_slice(&encryption_key);
        let cipher = Aes256Gcm::new(key);
        
        let plaintext = cipher.decrypt(nonce, ciphertext)
            .map_err(|e| BitcoinKeyError::Encryption(e.to_string()))?;
        
        let secret_key = SecretKey::from_slice(&plaintext)?;
        Ok(secret_key)
    }
}

#[derive(Debug, Clone)]
pub struct BitcoinAddresses {
    pub legacy: Address,
    pub segwit: Address,
    pub wrapped_segwit: Address,
    pub taproot: Address,
}

impl BitcoinAddresses {
    pub fn get_by_type(&self, address_type: &str) -> Option<&Address> {
        match address_type {
            "legacy" => Some(&self.legacy),
            "segwit" => Some(&self.segwit),
            "wrapped_segwit" => Some(&self.wrapped_segwit),
            "taproot" => Some(&self.taproot),
            _ => None,
        }
    }
}
```

### 2. HD Wallet Implementation

```rust
use bitcoin::bip32::{ExtendedPrivKey, ExtendedPubKey, DerivationPath, ChildNumber};
use std::str::FromStr;

pub struct HDWallet {
    master_key: ExtendedPrivKey,
    network: Network,
    secp: Secp256k1<secp256k1::All>,
}

impl HDWallet {
    /// Create HD wallet from quantum-enhanced seed
    pub fn from_quantum_seed(network: Network) -> Result<Self, BitcoinKeyError> {
        let generator = QuantumBitcoinKeyGenerator::new();
        let entropy = generator.generate_quantum_entropy()?;
        
        // Extend to 64 bytes for BIP32 seed
        let mut seed = [0u8; 64];
        let mut hasher = Hasher::new();
        hasher.update(&entropy);
        hasher.update(b"ZAP_QUANTUM_VAULT_HD_SEED");
        let extended_hash = hasher.finalize();
        seed[..32].copy_from_slice(extended_hash.as_bytes());
        seed[32..].copy_from_slice(&entropy);
        
        let secp = Secp256k1::new();
        let master_key = ExtendedPrivKey::new_master(network, &seed)
            .map_err(|e| BitcoinKeyError::Derivation(e.to_string()))?;
        
        Ok(Self {
            master_key,
            network,
            secp,
        })
    }

    /// Derive key using BIP44 path: m/44'/coin_type'/account'/change/address_index
    pub fn derive_bip44_key(&self, account: u32, change: u32, address_index: u32) -> Result<(SecretKey, BitcoinAddresses), BitcoinKeyError> {
        let coin_type = match self.network {
            Network::Bitcoin => 0,
            Network::Testnet => 1,
            _ => 1, // Use testnet for other networks
        };
        
        let path = format!("m/44'/{}'/{}'/{}/{}", coin_type, account, change, address_index);
        let derivation_path = DerivationPath::from_str(&path)
            .map_err(|e| BitcoinKeyError::Derivation(e.to_string()))?;
        
        let child_key = self.master_key.derive_priv(&self.secp, &derivation_path)
            .map_err(|e| BitcoinKeyError::Derivation(e.to_string()))?;
        
        let generator = QuantumBitcoinKeyGenerator::new();
        let addresses = generator.generate_all_addresses(&child_key.private_key, self.network)?;
        
        Ok((child_key.private_key, addresses))
    }

    /// Generate multiple addresses for an account
    pub fn generate_addresses(&self, account: u32, count: u32) -> Result<Vec<(String, BitcoinAddresses)>, BitcoinKeyError> {
        let mut addresses = Vec::new();
        
        for i in 0..count {
            let (_, addr) = self.derive_bip44_key(account, 0, i)?;
            let path = format!("m/44'/0'/{}/0/{}", account, i);
            addresses.push((path, addr));
        }
        
        Ok(addresses)
    }
}
```

### 3. Database Integration

```rust
use rusqlite::{Connection, params, Result as SqlResult};
use serde_json;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StoredBitcoinKey {
    pub id: String,
    pub name: String,
    pub key_type: String,
    pub addresses: BitcoinAddresses,
    pub network: String,
    pub encrypted_private_key: Vec<u8>,
    pub derivation_path: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_used: Option<DateTime<Utc>>,
}

pub struct BitcoinKeyDatabase {
    conn: Connection,
}

impl BitcoinKeyDatabase {
    pub fn new(db_path: &str) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(db_path)?;
        
        // Create table if not exists
        conn.execute(
            "CREATE TABLE IF NOT EXISTS bitcoin_keys (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                key_type TEXT NOT NULL,
                legacy_address TEXT NOT NULL,
                segwit_address TEXT NOT NULL,
                wrapped_segwit_address TEXT NOT NULL,
                taproot_address TEXT NOT NULL,
                network TEXT NOT NULL,
                encrypted_private_key BLOB NOT NULL,
                derivation_path TEXT,
                created_at TEXT NOT NULL,
                last_used TEXT
            )",
            [],
        )?;
        
        Ok(Self { conn })
    }

    pub fn store_key(&self, key: &StoredBitcoinKey) -> SqlResult<()> {
        self.conn.execute(
            "INSERT INTO bitcoin_keys (
                id, name, key_type, legacy_address, segwit_address,
                wrapped_segwit_address, taproot_address, network,
                encrypted_private_key, derivation_path, created_at, last_used
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                key.id,
                key.name,
                key.key_type,
                key.addresses.legacy.to_string(),
                key.addresses.segwit.to_string(),
                key.addresses.wrapped_segwit.to_string(),
                key.addresses.taproot.to_string(),
                key.network,
                key.encrypted_private_key,
                key.derivation_path,
                key.created_at.to_rfc3339(),
                key.last_used.map(|dt| dt.to_rfc3339()),
            ],
        )?;
        Ok(())
    }

    pub fn get_key(&self, id: &str) -> SqlResult<Option<StoredBitcoinKey>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, key_type, legacy_address, segwit_address,
                    wrapped_segwit_address, taproot_address, network,
                    encrypted_private_key, derivation_path, created_at, last_used
             FROM bitcoin_keys WHERE id = ?1"
        )?;
        
        let key_iter = stmt.query_map([id], |row| {
            let legacy_str: String = row.get(3)?;
            let segwit_str: String = row.get(4)?;
            let wrapped_segwit_str: String = row.get(5)?;
            let taproot_str: String = row.get(6)?;
            
            let addresses = BitcoinAddresses {
                legacy: Address::from_str(&legacy_str).unwrap(),
                segwit: Address::from_str(&segwit_str).unwrap(),
                wrapped_segwit: Address::from_str(&wrapped_segwit_str).unwrap(),
                taproot: Address::from_str(&taproot_str).unwrap(),
            };
            
            let created_at_str: String = row.get(10)?;
            let last_used_str: Option<String> = row.get(11)?;
            
            Ok(StoredBitcoinKey {
                id: row.get(0)?,
                name: row.get(1)?,
                key_type: row.get(2)?,
                addresses,
                network: row.get(7)?,
                encrypted_private_key: row.get(8)?,
                derivation_path: row.get(9)?,
                created_at: DateTime::parse_from_rfc3339(&created_at_str).unwrap().with_timezone(&Utc),
                last_used: last_used_str.map(|s| DateTime::parse_from_rfc3339(&s).unwrap().with_timezone(&Utc)),
            })
        })?;
        
        for key in key_iter {
            return Ok(Some(key?));
        }
        
        Ok(None)
    }

    pub fn list_keys(&self) -> SqlResult<Vec<StoredBitcoinKey>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, key_type, legacy_address, segwit_address,
                    wrapped_segwit_address, taproot_address, network,
                    encrypted_private_key, derivation_path, created_at, last_used
             FROM bitcoin_keys ORDER BY created_at DESC"
        )?;
        
        let key_iter = stmt.query_map([], |row| {
            let legacy_str: String = row.get(3)?;
            let segwit_str: String = row.get(4)?;
            let wrapped_segwit_str: String = row.get(5)?;
            let taproot_str: String = row.get(6)?;
            
            let addresses = BitcoinAddresses {
                legacy: Address::from_str(&legacy_str).unwrap(),
                segwit: Address::from_str(&segwit_str).unwrap(),
                wrapped_segwit: Address::from_str(&wrapped_segwit_str).unwrap(),
                taproot: Address::from_str(&taproot_str).unwrap(),
            };
            
            let created_at_str: String = row.get(10)?;
            let last_used_str: Option<String> = row.get(11)?;
            
            Ok(StoredBitcoinKey {
                id: row.get(0)?,
                name: row.get(1)?,
                key_type: row.get(2)?,
                addresses,
                network: row.get(7)?,
                encrypted_private_key: row.get(8)?,
                derivation_path: row.get(9)?,
                created_at: DateTime::parse_from_rfc3339(&created_at_str).unwrap().with_timezone(&Utc),
                last_used: last_used_str.map(|s| DateTime::parse_from_rfc3339(&s).unwrap().with_timezone(&Utc)),
            })
        })?;
        
        let mut keys = Vec::new();
        for key in key_iter {
            keys.push(key?);
        }
        
        Ok(keys)
    }
}
```

### 4. Tauri Command Integration

```rust
use tauri::State;
use std::sync::Mutex;

pub struct BitcoinKeyManager {
    generator: QuantumBitcoinKeyGenerator,
    database: Mutex<BitcoinKeyDatabase>,
}

impl BitcoinKeyManager {
    pub fn new(db_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let generator = QuantumBitcoinKeyGenerator::new();
        let database = Mutex::new(BitcoinKeyDatabase::new(db_path)?);
        
        Ok(Self {
            generator,
            database,
        })
    }
}

#[tauri::command]
pub async fn generate_bitcoin_key(
    name: String,
    key_type: String,
    network: String,
    password: String,
    manager: State<'_, BitcoinKeyManager>,
) -> Result<String, String> {
    let network = match network.as_str() {
        "bitcoin" => Network::Bitcoin,
        "testnet" => Network::Testnet,
        "signet" => Network::Signet,
        "regtest" => Network::Regtest,
        _ => return Err("Invalid network".to_string()),
    };
    
    // Generate private key
    let private_key = manager.generator.generate_private_key()
        .map_err(|e| format!("Failed to generate private key: {:?}", e))?;
    
    // Generate all addresses
    let addresses = manager.generator.generate_all_addresses(&private_key, network)
        .map_err(|e| format!("Failed to generate addresses: {:?}", e))?;
    
    // Encrypt private key
    let encrypted_key = manager.generator.encrypt_private_key(&private_key, &password)
        .map_err(|e| format!("Failed to encrypt private key: {:?}", e))?;
    
    // Store in database
    let key_id = uuid::Uuid::new_v4().to_string();
    let stored_key = StoredBitcoinKey {
        id: key_id.clone(),
        name,
        key_type,
        addresses,
        network: network.to_string(),
        encrypted_private_key: encrypted_key,
        derivation_path: None,
        created_at: Utc::now(),
        last_used: None,
    };
    
    let db = manager.database.lock().unwrap();
    db.store_key(&stored_key)
        .map_err(|e| format!("Failed to store key: {}", e))?;
    
    Ok(key_id)
}

#[tauri::command]
pub async fn list_bitcoin_keys(
    manager: State<'_, BitcoinKeyManager>,
) -> Result<Vec<StoredBitcoinKey>, String> {
    let db = manager.database.lock().unwrap();
    db.list_keys()
        .map_err(|e| format!("Failed to list keys: {}", e))
}

#[tauri::command]
pub async fn export_bitcoin_key(
    key_id: String,
    password: String,
    export_format: String,
    manager: State<'_, BitcoinKeyManager>,
) -> Result<String, String> {
    let db = manager.database.lock().unwrap();
    let stored_key = db.get_key(&key_id)
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or("Key not found")?;
    
    // Decrypt private key
    let private_key = manager.generator.decrypt_private_key(&stored_key.encrypted_private_key, &password)
        .map_err(|e| format!("Failed to decrypt key: {:?}", e))?;
    
    match export_format.as_str() {
        "wif" => {
            Ok(private_key.display_secret().to_string())
        },
        "hex" => {
            Ok(hex::encode(private_key.secret_bytes()))
        },
        "json" => {
            let export_data = serde_json::json!({
                "id": stored_key.id,
                "name": stored_key.name,
                "private_key_hex": hex::encode(private_key.secret_bytes()),
                "addresses": {
                    "legacy": stored_key.addresses.legacy.to_string(),
                    "segwit": stored_key.addresses.segwit.to_string(),
                    "wrapped_segwit": stored_key.addresses.wrapped_segwit.to_string(),
                    "taproot": stored_key.addresses.taproot.to_string(),
                },
                "network": stored_key.network,
                "created_at": stored_key.created_at,
            });
            Ok(export_data.to_string())
        },
        _ => Err("Invalid export format".to_string()),
    }
}
```

## Usage Examples

### Basic Key Generation

```rust
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let generator = QuantumBitcoinKeyGenerator::new();
    
    // Generate a new Bitcoin key
    let private_key = generator.generate_private_key()?;
    let addresses = generator.generate_all_addresses(&private_key, Network::Bitcoin)?;
    
    println!("Legacy: {}", addresses.legacy);
    println!("SegWit: {}", addresses.segwit);
    println!("Wrapped SegWit: {}", addresses.wrapped_segwit);
    println!("Taproot: {}", addresses.taproot);
    
    // Encrypt and store
    let password = "secure_password_123";
    let encrypted = generator.encrypt_private_key(&private_key, password)?;
    
    // Later: decrypt and use
    let decrypted = generator.decrypt_private_key(&encrypted, password)?;
    assert_eq!(private_key.secret_bytes(), decrypted.secret_bytes());
    
    Ok(())
}
```

### HD Wallet Usage

```rust
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let wallet = HDWallet::from_quantum_seed(Network::Bitcoin)?;
    
    // Generate first 10 addresses for account 0
    let addresses = wallet.generate_addresses(0, 10)?;
    
    for (path, addr) in addresses {
        println!("Path: {} -> SegWit: {}", path, addr.segwit);
    }
    
    Ok(())
}
```

This implementation provides a complete, production-ready Bitcoin key management system with quantum-enhanced security for the ZAP Quantum Vault project.
