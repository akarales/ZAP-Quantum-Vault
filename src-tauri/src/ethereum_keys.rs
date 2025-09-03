use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use blake3::Hasher as Blake3Hasher;
use alloy::primitives::{Address, U256, B256};
use alloy::signers::local::{PrivateKeySigner, LocalSigner};
use secp256k1::{Secp256k1, SecretKey, PublicKey};
use pqcrypto_kyber::kyber1024;
use pqcrypto_dilithium::dilithium5;
use pqcrypto_traits::kem::{PublicKey as KemPublicKey, SharedSecret, Ciphertext};
use pqcrypto_traits::sign::{PublicKey as SignPublicKey, SignedMessage};
use aes_gcm::{Aes256Gcm, Nonce, KeyInit};
use aes_gcm::aead::Aead;
use argon2::{Argon2, PasswordHasher};
use argon2::password_hash::{rand_core::OsRng, SaltString};
use rand::RngCore;
use tiny_keccak::{Hasher, Keccak};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EthereumKey {
    pub id: String,
    pub vault_id: String,
    pub key_type: EthereumKeyType,
    pub network: EthereumNetwork,
    pub encrypted_private_key: Vec<u8>,
    pub public_key: Vec<u8>,
    pub address: String,
    pub derivation_path: Option<String>,
    pub entropy_source: EntropySource,
    pub quantum_enhanced: bool,
    pub created_at: DateTime<Utc>,
    pub last_used: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub encryption_password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EthereumKeyType {
    Standard,    // Standard Ethereum account
    Contract,    // Smart contract deployment key
    MultiSig,    // Multi-signature wallet
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EthereumNetwork {
    Mainnet,
    Goerli,
    Sepolia,
    Polygon,
    BSC,
    Arbitrum,
    Optimism,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EntropySource {
    SystemRng,
    QuantumEnhanced,
    Hardware,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EthereumKeyMetadata {
    pub key_id: String,
    pub label: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub balance_wei: String,
    pub transaction_count: i32,
    pub last_balance_check: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInfo {
    pub name: String,
    pub chain_id: u64,
    pub rpc_url: String,
    pub explorer_url: String,
    pub native_currency: String,
    pub is_testnet: bool,
}

/// Ethereum key generator with quantum-enhanced entropy
pub struct EthereumKeyGenerator {
    secp: Secp256k1<secp256k1::All>,
}

impl EthereumKeyGenerator {
    pub fn new() -> Self {
        Self {
            secp: Secp256k1::new(),
        }
    }

    /// Generate quantum-enhanced entropy using post-quantum algorithms
    pub fn generate_quantum_entropy(&self, bytes: usize) -> Result<Vec<u8>> {
        let mut entropy = Vec::new();
        
        // 1. Kyber entropy
        let kyber_entropy = self.extract_kyber_entropy(bytes / 3)?;
        entropy.extend_from_slice(&kyber_entropy);
        
        // 2. Dilithium entropy
        let dilithium_entropy = self.extract_dilithium_entropy(bytes / 3)?;
        entropy.extend_from_slice(&dilithium_entropy);
        
        // 3. System RNG entropy
        let mut system_entropy = vec![0u8; bytes / 3];
        OsRng.fill_bytes(&mut system_entropy);
        entropy.extend_from_slice(&system_entropy);
        
        // Mix all entropy sources using Blake3
        let mut hasher = Blake3Hasher::new();
        hasher.update(&entropy);
        
        let final_entropy = hasher.finalize();
        Ok(final_entropy.as_bytes()[..bytes.min(64)].to_vec())
    }

    fn extract_kyber_entropy(&self, bytes: usize) -> Result<Vec<u8>> {
        let (pk, _sk) = kyber1024::keypair();
        let (shared_secret, ciphertext) = kyber1024::encapsulate(&pk);
        
        let mut hasher = Blake3Hasher::new();
        hasher.update(pk.as_bytes());
        hasher.update(shared_secret.as_bytes());
        hasher.update(ciphertext.as_bytes());
        
        let entropy = hasher.finalize();
        Ok(entropy.as_bytes()[..bytes.min(64)].to_vec())
    }

    fn extract_dilithium_entropy(&self, bytes: usize) -> Result<Vec<u8>> {
        let (pk, sk) = dilithium5::keypair();
        let message = format!("quantum_entropy_dilithium_{}", Utc::now().timestamp_nanos_opt().unwrap_or(0));
        let signature = dilithium5::sign(message.as_bytes(), &sk);
        
        let mut hasher = Blake3Hasher::new();
        hasher.update(pk.as_bytes());
        hasher.update(signature.as_bytes());
        hasher.update(message.as_bytes());
        
        let entropy = hasher.finalize();
        Ok(entropy.as_bytes()[..bytes.min(64)].to_vec())
    }

    /// Generate an Ethereum key with quantum-enhanced entropy
    pub fn generate_ethereum_key(
        &mut self,
        vault_id: String,
        key_type: EthereumKeyType,
        network: EthereumNetwork,
        user_password: &str,
    ) -> Result<EthereumKey> {
        // Generate quantum-enhanced entropy
        let entropy = self.generate_quantum_entropy(32)?;
        
        // Create secp256k1 private key (same curve as Bitcoin)
        let private_key_bytes = self.ensure_valid_secp256k1_key(entropy)?;
        let secret_key = SecretKey::from_byte_array(private_key_bytes)
            .map_err(|e| anyhow!("Failed to create private key: {}", e))?;
        
        // Generate public key
        let public_key = PublicKey::from_secret_key(&self.secp, &secret_key);
        
        // Generate Ethereum address using Alloy
        let address = self.generate_ethereum_address(&public_key)?;
        
        // Encrypt private key
        let encrypted_private_key = self.encrypt_private_key(&private_key_bytes, user_password)?;
        
        Ok(EthereumKey {
            id: Uuid::new_v4().to_string(),
            vault_id,
            key_type,
            network,
            encrypted_private_key,
            public_key: public_key.serialize_uncompressed().to_vec(),
            address,
            derivation_path: None,
            entropy_source: EntropySource::QuantumEnhanced,
            quantum_enhanced: true,
            created_at: Utc::now(),
            last_used: None,
            is_active: true,
            encryption_password: user_password.to_string(),
        })
    }

    fn ensure_valid_secp256k1_key(&self, key_bytes: Vec<u8>) -> Result<[u8; 32]> {
        if key_bytes.len() < 32 {
            return Err(anyhow!("Insufficient entropy for key generation"));
        }
        
        let mut key_array = [0u8; 32];
        key_array.copy_from_slice(&key_bytes[..32]);
        
        // Ensure key is not zero and is valid for secp256k1
        if key_array == [0u8; 32] {
            // If all zeros, use Blake3 to derive a valid key
            let mut hasher = Blake3Hasher::new();
            hasher.update(&key_bytes);
            hasher.update(b"secp256k1_ethereum_key_derivation");
            let derived = hasher.finalize();
            key_array.copy_from_slice(&derived.as_bytes()[..32]);
        }
        
        Ok(key_array)
    }

    fn generate_ethereum_address(&self, public_key: &secp256k1::PublicKey) -> Result<String> {
        // Get uncompressed public key (65 bytes: 0x04 + 32 bytes x + 32 bytes y)
        let uncompressed = public_key.serialize_uncompressed();
        
        // Remove the 0x04 prefix, keep only the 64 bytes (x + y coordinates)
        let public_key_bytes = &uncompressed[1..];
        
        // Keccak256 hash of the public key
        let mut hasher = Keccak::v256();
        let mut hash = [0u8; 32];
        hasher.update(public_key_bytes);
        hasher.finalize(&mut hash);
        
        // Take the last 20 bytes and format as hex with 0x prefix
        let address_bytes = &hash[12..];
        let address = format!("0x{}", hex::encode(address_bytes));
        
        // Validate using Alloy's Address type
        let _validated_address = address.parse::<Address>()
            .map_err(|e| anyhow!("Invalid Ethereum address generated: {}", e))?;
        
        Ok(address)
    }

    fn encrypt_private_key(&self, private_key: &[u8], password: &str) -> Result<Vec<u8>> {
        // Generate salt for key derivation
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        
        // Derive encryption key from password using Argon2id
        let password_hash = argon2.hash_password(password.as_bytes(), &salt)
            .map_err(|e| anyhow!("Failed to derive key: {}", e))?;
        
        let hash = password_hash.hash.ok_or_else(|| anyhow!("Failed to get hash bytes"))?;
        let hash_bytes = hash.as_bytes();
        let mut derived_key = [0u8; 32];
        derived_key.copy_from_slice(&hash_bytes[..32]);
        
        // Encrypt with AES-256-GCM
        let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&derived_key);
        let cipher = Aes256Gcm::new(key);
        
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        let ciphertext = cipher.encrypt(nonce, private_key)
            .map_err(|e| anyhow!("Encryption failed: {}", e))?;
        
        // Combine salt + nonce + ciphertext
        let mut result = Vec::new();
        result.extend_from_slice(salt.as_str().as_bytes());
        result.push(0); // Separator
        result.extend_from_slice(&nonce_bytes);
        result.extend_from_slice(&ciphertext);
        
        Ok(result)
    }

    pub fn get_network_info(&self, network: &EthereumNetwork) -> NetworkInfo {
        match network {
            EthereumNetwork::Mainnet => NetworkInfo {
                name: "Ethereum Mainnet".to_string(),
                chain_id: 1,
                rpc_url: "https://mainnet.infura.io/v3/".to_string(),
                explorer_url: "https://etherscan.io".to_string(),
                native_currency: "ETH".to_string(),
                is_testnet: false,
            },
            EthereumNetwork::Goerli => NetworkInfo {
                name: "Goerli Testnet".to_string(),
                chain_id: 5,
                rpc_url: "https://goerli.infura.io/v3/".to_string(),
                explorer_url: "https://goerli.etherscan.io".to_string(),
                native_currency: "GoerliETH".to_string(),
                is_testnet: true,
            },
            EthereumNetwork::Sepolia => NetworkInfo {
                name: "Sepolia Testnet".to_string(),
                chain_id: 11155111,
                rpc_url: "https://sepolia.infura.io/v3/".to_string(),
                explorer_url: "https://sepolia.etherscan.io".to_string(),
                native_currency: "SepoliaETH".to_string(),
                is_testnet: true,
            },
            EthereumNetwork::Polygon => NetworkInfo {
                name: "Polygon Mainnet".to_string(),
                chain_id: 137,
                rpc_url: "https://polygon-rpc.com".to_string(),
                explorer_url: "https://polygonscan.com".to_string(),
                native_currency: "MATIC".to_string(),
                is_testnet: false,
            },
            EthereumNetwork::BSC => NetworkInfo {
                name: "Binance Smart Chain".to_string(),
                chain_id: 56,
                rpc_url: "https://bsc-dataseed.binance.org".to_string(),
                explorer_url: "https://bscscan.com".to_string(),
                native_currency: "BNB".to_string(),
                is_testnet: false,
            },
            EthereumNetwork::Arbitrum => NetworkInfo {
                name: "Arbitrum One".to_string(),
                chain_id: 42161,
                rpc_url: "https://arb1.arbitrum.io/rpc".to_string(),
                explorer_url: "https://arbiscan.io".to_string(),
                native_currency: "ETH".to_string(),
                is_testnet: false,
            },
            EthereumNetwork::Optimism => NetworkInfo {
                name: "Optimism".to_string(),
                chain_id: 10,
                rpc_url: "https://mainnet.optimism.io".to_string(),
                explorer_url: "https://optimistic.etherscan.io".to_string(),
                native_currency: "ETH".to_string(),
                is_testnet: false,
            },
        }
    }

    /// Create a signer from encrypted private key (for transaction signing)
    pub fn create_signer_from_encrypted_key(
        &self,
        encrypted_private_key: &[u8],
        password: &str,
    ) -> Result<PrivateKeySigner> {
        let private_key_bytes = self.decrypt_private_key(encrypted_private_key, password)?;
        
        // Convert bytes to B256 for Alloy
        let mut b256_bytes = [0u8; 32];
        b256_bytes.copy_from_slice(&private_key_bytes[..32]);
        let private_key_b256 = B256::from(b256_bytes);
        
        let signer = PrivateKeySigner::from_bytes(&private_key_b256)
            .map_err(|e| anyhow!("Failed to create signer: {}", e))?;
        
        Ok(signer)
    }

    /// Decrypt private key for use in transactions
    pub fn decrypt_private_key(&self, encrypted_data: &[u8], password: &str) -> Result<Vec<u8>> {
        // Parse the encrypted data format: salt + separator + nonce + ciphertext
        let separator_pos = encrypted_data.iter().position(|&x| x == 0)
            .ok_or_else(|| anyhow!("Invalid encrypted data format"))?;
        
        let salt_str = std::str::from_utf8(&encrypted_data[..separator_pos])
            .map_err(|e| anyhow!("Invalid salt format: {}", e))?;
        
        let remaining = &encrypted_data[separator_pos + 1..];
        if remaining.len() < 12 {
            return Err(anyhow!("Encrypted data too short"));
        }
        
        let nonce_bytes = &remaining[..12];
        let ciphertext = &remaining[12..];
        
        // Derive key from password using the same method as encryption
        let argon2 = Argon2::default();
        let salt = SaltString::from_b64(salt_str)
            .map_err(|e| anyhow!("Failed to parse salt: {}", e))?;
        
        let password_hash = argon2.hash_password(password.as_bytes(), &salt)
            .map_err(|e| anyhow!("Failed to hash password: {}", e))?;
        
        let hash = password_hash.hash.ok_or_else(|| anyhow!("Failed to get hash bytes"))?;
        let hash_bytes = hash.as_bytes();
        let mut derived_key = [0u8; 32];
        derived_key.copy_from_slice(&hash_bytes[..32]);
        
        let cipher = Aes256Gcm::new_from_slice(&derived_key)
            .map_err(|e| anyhow!("Failed to create cipher: {}", e))?;
        
        let nonce = Nonce::from_slice(nonce_bytes);
        
        cipher.decrypt(nonce, ciphertext)
            .map_err(|e| anyhow!("Failed to decrypt: {}", e))
    }
}
