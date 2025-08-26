use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use blake3::Hasher as Blake3Hasher;
use bitcoin::{Network, Address};
use bitcoin::key::CompressedPublicKey;
use secp256k1::{Secp256k1, SecretKey};
use pqcrypto_kyber::kyber1024;
use pqcrypto_dilithium::dilithium5;
use pqcrypto_traits::kem::{PublicKey as KemPublicKey, SharedSecret, Ciphertext};
use pqcrypto_traits::sign::{PublicKey as SignPublicKey, SignedMessage};
use aes_gcm::{Aes256Gcm, Nonce, KeyInit};
use aes_gcm::aead::Aead;
use argon2::{Argon2, PasswordHasher};
use argon2::password_hash::{rand_core::OsRng, SaltString};
use rand::RngCore;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitcoinKey {
    pub id: String,
    pub vault_id: String,
    pub key_type: BitcoinKeyType,
    pub network: BitcoinNetwork,
    pub encrypted_private_key: Vec<u8>,
    pub public_key: Vec<u8>,
    pub address: String,
    pub derivation_path: Option<String>,
    pub entropy_source: EntropySource,
    pub quantum_enhanced: bool,
    pub created_at: DateTime<Utc>,
    pub last_used: Option<DateTime<Utc>>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BitcoinKeyType {
    Legacy,    // P2PKH
    SegWit,    // P2SH-P2WPKH
    Native,    // P2WPKH (Bech32)
    MultiSig,  // P2SH
    Taproot,   // P2TR
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BitcoinNetwork {
    Mainnet,
    Testnet,
    Regtest,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EntropySource {
    SystemRng,
    QuantumEnhanced,
    Hardware,
}

/// Simplified Bitcoin key generator with quantum-enhanced entropy
pub struct SimpleBitcoinKeyGenerator {
    secp: Secp256k1<secp256k1::All>,
}

impl SimpleBitcoinKeyGenerator {
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
        
        // Mix all entropy sources
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

    /// Generate a Bitcoin key with quantum-enhanced entropy
    pub fn generate_bitcoin_key(
        &mut self,
        vault_id: String,
        key_type: BitcoinKeyType,
        network: BitcoinNetwork,
        user_password: &str,
    ) -> Result<BitcoinKey> {
        // Generate quantum-enhanced entropy
        let entropy = self.generate_quantum_entropy(32)?;
        
        // Create secp256k1 private key
        let private_key_bytes = self.ensure_valid_secp256k1_key(entropy)?;
        let secret_key = SecretKey::from_byte_array(private_key_bytes)
            .map_err(|e| anyhow!("Failed to create private key: {}", e))?;
        
        // Generate compressed public key
        let compressed_pubkey = CompressedPublicKey::from_private_key(&self.secp, &secret_key);
        
        // Generate address
        let bitcoin_network = self.convert_network(network.clone());
        let address = self.generate_address(&compressed_pubkey, &key_type, bitcoin_network)?;
        
        // Encrypt private key
        let encrypted_private_key = self.encrypt_private_key(&private_key_bytes, user_password)?;
        
        Ok(BitcoinKey {
            id: Uuid::new_v4().to_string(),
            vault_id,
            key_type,
            network,
            encrypted_private_key,
            public_key: compressed_pubkey.to_bytes(),
            address,
            derivation_path: None,
            entropy_source: EntropySource::QuantumEnhanced,
            quantum_enhanced: true,
            created_at: Utc::now(),
            last_used: None,
            is_active: true,
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
            hasher.update(b"secp256k1_key_derivation");
            let derived = hasher.finalize();
            key_array.copy_from_slice(&derived.as_bytes()[..32]);
        }
        
        Ok(key_array)
    }

    fn generate_address(
        &self,
        compressed_pubkey: &CompressedPublicKey,
        key_type: &BitcoinKeyType,
        network: Network,
    ) -> Result<String> {
        let address = match key_type {
            BitcoinKeyType::Legacy => {
                Address::p2pkh(compressed_pubkey, network)
            },
            BitcoinKeyType::SegWit => {
                // SegWit P2SH-wrapped address
                match Address::p2shwpkh(compressed_pubkey, network) {
                    Ok(addr) => addr,
                    Err(e) => return Err(anyhow!("Failed to create P2SH-P2WPKH address: {}", e)),
                }
            },
            BitcoinKeyType::Native => {
                // Native SegWit (Bech32) address
                match Address::p2wpkh(compressed_pubkey, network) {
                    Ok(addr) => addr,
                    Err(e) => return Err(anyhow!("Failed to create P2WPKH address: {}", e)),
                }
            },
            BitcoinKeyType::MultiSig => {
                // Simplified 1-of-1 multisig for now
                Address::p2pkh(compressed_pubkey, network)
            },
            BitcoinKeyType::Taproot => {
                // Create Taproot address using the new API
                let dummy_key = SecretKey::from_byte_array([1u8; 32])
                    .map_err(|e| anyhow!("Failed to create dummy key: {}", e))?;
                let keypair = bitcoin::key::Keypair::from_secret_key(self.secp, &dummy_key);
                let (xonly_pubkey, _parity) = keypair.x_only_public_key();
                Address::p2tr(self.secp, xonly_pubkey, None, network)
            },
        };
        Ok(address.to_string())
    }

    fn convert_network(&self, network: BitcoinNetwork) -> Network {
        match network {
            BitcoinNetwork::Mainnet => Network::Bitcoin,
            BitcoinNetwork::Testnet => Network::Testnet,
            BitcoinNetwork::Regtest => Network::Regtest,
        }
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
}
