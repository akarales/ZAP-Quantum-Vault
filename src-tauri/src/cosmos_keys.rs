use anyhow::{Result, anyhow};
use bech32;
use secp256k1::{Secp256k1, SecretKey, PublicKey};
use ripemd::{Ripemd160, Digest};
use sha2::Sha256;
use bip32::{ExtendedPrivateKey, DerivationPath, Mnemonic, Language, XPrv};
use rand::{RngCore, rngs::OsRng};
use serde::{Deserialize, Serialize};
use std::str::FromStr;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CosmosNetworkConfig {
    pub name: String,
    pub coin_type: u32,
    pub bech32_prefix: String,
    pub chain_id: String,
    pub rpc_endpoint: Option<String>,
}

#[derive(Debug, Clone)]
pub struct CosmosKeyPair {
    pub private_key: SecretKey,
    pub public_key: PublicKey,
    pub address: String,
    pub network_config: CosmosNetworkConfig,
    pub mnemonic: Option<String>,
    pub derivation_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CosmosKeyInfo {
    pub id: String,
    pub vault_id: String,
    pub network_name: String,
    pub bech32_prefix: String,
    pub address: String,
    pub public_key: String,
    pub derivation_path: Option<String>,
    pub description: Option<String>,
    pub quantum_enhanced: bool,
    pub created_at: String,
    pub updated_at: String,
    pub is_active: bool,
}

pub struct CosmosKeyGenerator {
    secp: Secp256k1<secp256k1::All>,
}

impl CosmosKeyGenerator {
    pub fn new() -> Self {
        Self {
            secp: Secp256k1::new(),
        }
    }

    /// Generate a new key pair for the specified network
    pub fn generate_key_pair(&self, network_config: &CosmosNetworkConfig) -> Result<CosmosKeyPair> {
        log::info!("cosmos_keys: Starting key pair generation for network: {}", network_config.name);
        let mut rng = rand::thread_rng();
        log::info!("cosmos_keys: Generating random private key...");
        let mut key_bytes = [0u8; 32];
        rng.fill_bytes(&mut key_bytes);
        let private_key = SecretKey::from_byte_array(key_bytes)
            .map_err(|e| anyhow!("Failed to create private key: {}", e))?;
        log::info!("cosmos_keys: Private key generated successfully");

        // Derive public key
        let public_key = PublicKey::from_secret_key(&self.secp, &private_key);

        // Generate address
        let address = self.generate_address(&public_key, &network_config.bech32_prefix)?;

        let key_pair = CosmosKeyPair {
            private_key,
            public_key,
            address: address.clone(),
            network_config: network_config.clone(),
            mnemonic: None,
            derivation_path: None,
        };
        
        log::info!("cosmos_keys: Key pair generation completed successfully for address: {}", address);
        Ok(key_pair)
    }

    /// Generate a Cosmos address from a public key
    pub fn generate_address(&self, public_key: &PublicKey, bech32_prefix: &str) -> Result<String> {
        log::info!("cosmos_keys: Starting address generation with prefix: {}", bech32_prefix);
        // Get the compressed public key bytes
        let public_key_bytes = public_key.serialize();
        log::info!("cosmos_keys: Public key serialized, length: {} bytes", public_key_bytes.len());

        // Hash the public key with SHA256
        log::info!("cosmos_keys: Hashing public key with SHA256...");
        let mut hasher = Sha256::new();
        hasher.update(&public_key_bytes);
        let hash = hasher.finalize();
        log::info!("cosmos_keys: SHA256 hash computed");
        
        // Take the first 20 bytes for the address
        let address_bytes = &hash[..20];
        log::info!("cosmos_keys: Using first 20 bytes of hash for address");

        // Encode with bech32
        log::info!("cosmos_keys: Encoding address with bech32...");
        let hrp = bech32::Hrp::parse(bech32_prefix)
            .map_err(|e| {
                log::error!("cosmos_keys: Invalid bech32 prefix '{}': {}", bech32_prefix, e);
                anyhow::anyhow!("Invalid bech32 prefix: {}", e)
            })?;
        let address = bech32::encode::<bech32::Bech32>(hrp, &address_bytes)
            .map_err(|e| {
                log::error!("cosmos_keys: Bech32 encoding failed: {}", e);
                anyhow::anyhow!("Bech32 encoding failed: {}", e)
            })?;
        
        log::info!("cosmos_keys: Address encoded successfully: {}", address);
        Ok(address)
    }

    /// Validate a Cosmos address
    pub fn validate_address(&self, address: &str, expected_prefix: &str) -> Result<bool> {
        match bech32::decode(address) {
            Ok((hrp, _data)) => {
                Ok(hrp.as_str() == expected_prefix)
            }
            Err(_) => Ok(false),
        }
    }

    /// Generate HD wallet from mnemonic
    pub fn generate_hd_wallet(&self, network_config: &CosmosNetworkConfig, account_index: u32) -> Result<CosmosKeyPair> {
        // Generate mnemonic using random entropy
        let mnemonic = Mnemonic::random(&mut OsRng, Language::English);

        // Create seed from mnemonic
        let seed = mnemonic.to_seed("");

        // Create extended private key from seed using XPrv (BIP32 compatible)
        let xprv = XPrv::new(&seed)
            .map_err(|e| anyhow!("Failed to create extended private key: {}", e))?;

        // Derive key using BIP44 path: m/44'/118'/0'/0/{account_index}
        let path = format!("m/44'/118'/0'/0/{}", account_index);
        let derivation_path = DerivationPath::from_str(&path)
            .map_err(|e| anyhow!("Invalid derivation path: {}", e))?;

        // Derive the key step by step
        let mut current_key = xprv;
        for child_number in derivation_path.iter() {
            current_key = current_key.derive_child(child_number)
                .map_err(|e| anyhow!("Failed to derive child key: {}", e))?;
        }

        // Create secp256k1 private key from derived key bytes
        let key_bytes = current_key.private_key().to_bytes();
        let mut key_array = [0u8; 32];
        key_array.copy_from_slice(&key_bytes);
        let private_key = SecretKey::from_byte_array(key_array)
            .map_err(|e| anyhow!("Failed to create private key: {}", e))?;

        // Generate public key
        let _secp = Secp256k1::new();
        let public_key = private_key.public_key(&Secp256k1::new());
        log::info!("cosmos_keys: Public key derived from private key");
        
        // Generate address from public key
        log::info!("cosmos_keys: Generating address with prefix: {}", network_config.bech32_prefix);
        let address = self.generate_address(&public_key, &network_config.bech32_prefix)?;
        log::info!("cosmos_keys: Address generated: {}", address);

        Ok(CosmosKeyPair {
            private_key,
            public_key,
            address,
            network_config: network_config.clone(),
            mnemonic: Some(mnemonic.phrase().to_string()),
            derivation_path: Some(path),
        })
    }

    /// Convert private key to hex string
    pub fn private_key_to_hex(&self, private_key: &SecretKey) -> String {
        let hex_key = hex::encode(private_key.secret_bytes());
        log::info!("cosmos_keys: Private key converted to hex, length: {} chars", hex_key.len());
        hex_key
    }

    /// Convert public key to hex string
    pub fn public_key_to_hex(&self, public_key: &PublicKey) -> String {
        let hex_key = hex::encode(public_key.serialize());
        log::info!("cosmos_keys: Public key converted to hex, length: {} chars", hex_key.len());
        hex_key
    }

    /// Convert hex string to private key
    pub fn private_key_from_hex(&self, hex_str: &str) -> Result<SecretKey> {
        let bytes = hex::decode(hex_str)
            .map_err(|e| anyhow!("Failed to decode hex: {}", e))?;
        let byte_array: [u8; 32] = bytes.try_into()
            .map_err(|_| anyhow!("Invalid key length"))?;
        SecretKey::from_byte_array(byte_array)
            .map_err(|e| anyhow!("Failed to create private key: {}", e))
    }

    /// Create public key from hex string
    pub fn public_key_from_hex(&self, hex_str: &str) -> Result<PublicKey> {
        let bytes = hex::decode(hex_str)
            .map_err(|e| anyhow!("Failed to decode hex: {}", e))?;
        
        PublicKey::from_slice(&bytes)
            .map_err(|e| anyhow!("Invalid public key: {}", e))
    }
}

/// Default Cosmos network configurations
pub fn get_default_networks() -> Vec<CosmosNetworkConfig> {
    vec![
        CosmosNetworkConfig {
            name: "Cosmos Hub".to_string(),
            coin_type: 118,
            bech32_prefix: "cosmos".to_string(),
            chain_id: "cosmoshub-4".to_string(),
            rpc_endpoint: Some("https://cosmos-rpc.polkachu.com".to_string()),
        },
        CosmosNetworkConfig {
            name: "Osmosis".to_string(),
            coin_type: 118,
            bech32_prefix: "osmo".to_string(),
            chain_id: "osmosis-1".to_string(),
            rpc_endpoint: Some("https://osmosis-rpc.polkachu.com".to_string()),
        },
        CosmosNetworkConfig {
            name: "Juno".to_string(),
            coin_type: 118,
            bech32_prefix: "juno".to_string(),
            chain_id: "juno-1".to_string(),
            rpc_endpoint: Some("https://juno-rpc.polkachu.com".to_string()),
        },
        CosmosNetworkConfig {
            name: "Stargaze".to_string(),
            coin_type: 118,
            bech32_prefix: "stars".to_string(),
            chain_id: "stargaze-1".to_string(),
            rpc_endpoint: Some("https://stargaze-rpc.polkachu.com".to_string()),
        },
        CosmosNetworkConfig {
            name: "Akash".to_string(),
            coin_type: 118,
            bech32_prefix: "akash".to_string(),
            chain_id: "akashnet-2".to_string(),
            rpc_endpoint: Some("https://akash-rpc.polkachu.com".to_string()),
        },
    ]
}

/// Get network configuration by name or bech32 prefix
pub fn get_network_by_name(name: &str) -> Option<CosmosNetworkConfig> {
    get_default_networks().into_iter().find(|n| 
        n.name == name || 
        n.name.to_lowercase() == name.to_lowercase() ||
        n.bech32_prefix == name
    )
}

/// Get network configuration by bech32 prefix
pub fn get_network_by_prefix(prefix: &str) -> Option<CosmosNetworkConfig> {
    get_default_networks().into_iter().find(|n| n.bech32_prefix == prefix)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_generation() {
        let generator = CosmosKeyGenerator::new();
        let network = get_network_by_name("Cosmos Hub").unwrap();
        
        let key_pair = generator.generate_key_pair(&network).unwrap();
        
        // Verify address starts with correct prefix
        assert!(key_pair.address.starts_with("cosmos"));
        
        // Verify address validation
        assert!(generator.validate_address(&key_pair.address, "cosmos").unwrap());
        assert!(!generator.validate_address(&key_pair.address, "osmo").unwrap());
    }

    #[test]
    fn test_address_generation() {
        let generator = CosmosKeyGenerator::new();
        let network = get_network_by_name("Osmosis").unwrap();
        
        let key_pair = generator.generate_key_pair(&network).unwrap();
        
        // Verify address starts with correct prefix
        assert!(key_pair.address.starts_with("osmo"));
        
        // Verify we can regenerate the same address from the public key
        let regenerated_address = generator.generate_address(&key_pair.public_key, &network.bech32_prefix).unwrap();
        assert_eq!(key_pair.address, regenerated_address);
    }

    #[test]
    fn test_hex_conversion() {
        let generator = CosmosKeyGenerator::new();
        let network = get_network_by_name("Cosmos Hub").unwrap();
        
        let key_pair = generator.generate_key_pair(&network).unwrap();
        
        // Test private key conversion
        let private_hex = generator.private_key_to_hex(&key_pair.private_key);
        let recovered_private = generator.private_key_from_hex(&private_hex).unwrap();
        assert_eq!(key_pair.private_key.secret_bytes(), recovered_private.secret_bytes());
        
        // Test public key conversion
        let public_hex = generator.public_key_to_hex(&key_pair.public_key);
        let recovered_public = generator.public_key_from_hex(&public_hex).unwrap();
        assert_eq!(key_pair.public_key.serialize(), recovered_public.serialize());
    }

    #[test]
    fn test_all_networks() {
        let generator = CosmosKeyGenerator::new();
        let networks = get_default_networks();
        
        for network in networks {
            let key_pair = generator.generate_key_pair(&network).unwrap();
            assert!(key_pair.address.starts_with(&network.bech32_prefix));
            assert!(generator.validate_address(&key_pair.address, &network.bech32_prefix).unwrap());
        }
    }
}
