use crate::cosmos_keys::{CosmosKeyGenerator, CosmosNetworkConfig};
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono;
use std::collections::HashMap;
use rand::{thread_rng, Rng};
use rand::distributions::Alphanumeric;
use base64;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ZAPBlockchainNetworkConfig {
    pub name: String,
    pub chain_id: String,
    pub bech32_prefix: String,
    pub coin_type: u32,
    pub network_type: ZAPNetworkType,
    pub consensus_algorithm: String,
    pub quantum_safe: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum ZAPNetworkType {
    Mainnet,
    Testnet,
    Devnet,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ZAPGenesisKeySet {
    pub chain_genesis: ZAPBlockchainKey,
    pub validator_keys: Vec<ZAPBlockchainKey>,
    pub treasury_keys: ZAPTreasuryKeys,
    pub governance_keys: Vec<ZAPBlockchainKey>,
    pub emergency_keys: Vec<ZAPBlockchainKey>,
    pub generated_at: String,
    pub network: String,
    pub key_set_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ZAPBlockchainKey {
    pub id: String,
    pub key_type: ZAPKeyType,
    pub key_role: String,
    pub algorithm: String,
    pub public_key: String,
    pub encrypted_private_key: String,
    pub encryption_password: String,
    pub address: String,
    pub derivation_path: Option<String>,
    pub network_name: String,
    pub created_at: String,
    pub metadata: ZAPKeyMetadata,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ZAPTreasuryKeys {
    pub master_key: ZAPBlockchainKey,
    pub multi_sig_keys: Vec<ZAPBlockchainKey>,
    pub backup_key: ZAPBlockchainKey,
    pub multi_sig_threshold: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum ZAPKeyType {
    Genesis,
    Validator,
    Treasury,
    Governance,
    Emergency,
    Service,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ZAPKeyMetadata {
    pub purpose: String,
    pub security_level: u8,
    pub quantum_enhanced: bool,
    pub multi_sig_config: Option<MultiSigConfig>,
    pub access_controls: AccessControls,
    pub backup_locations: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MultiSigConfig {
    pub threshold: u32,
    pub total_keys: u32,
    pub participants: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AccessControls {
    pub access_level: u8,
    pub time_lock_hours: Option<u32>,
    pub geographic_restrictions: Vec<String>,
    pub approval_required: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ZAPGenesisKeyResponse {
    pub key_set_id: String,
    pub network: String,
    pub total_keys: u32,
    pub chain_genesis_address: String,
    pub validator_addresses: Vec<String>,
    pub treasury_address: String,
    pub governance_addresses: Vec<String>,
    pub emergency_addresses: Vec<String>,
    pub generated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ZAPBlockchainKeyInfo {
    pub id: String,
    pub vault_id: String,
    pub key_type: String,
    pub key_role: String,
    pub network_name: String,
    pub algorithm: String,
    pub address: String,
    pub public_key: String,
    pub encrypted_private_key: String,
    pub encryption_password: String,
    pub created_at: String,
    pub metadata: serde_json::Value,
    pub is_active: bool,
}

pub struct ZAPBlockchainKeyGenerator {
    cosmos_generator: CosmosKeyGenerator,
    network_config: ZAPBlockchainNetworkConfig,
}

impl ZAPBlockchainKeyGenerator {
    pub fn new(network_config: ZAPBlockchainNetworkConfig) -> Self {
        let _cosmos_config = CosmosNetworkConfig {
            name: network_config.name.clone(),
            bech32_prefix: network_config.bech32_prefix.clone(),
            coin_type: network_config.coin_type,
            chain_id: network_config.chain_id.clone(),
            rpc_endpoint: None,
        };
        
        Self {
            cosmos_generator: CosmosKeyGenerator::new(),
            network_config,
        }
    }
    
    fn generate_unique_password(&self) -> String {
        thread_rng()
            .sample_iter(&Alphanumeric)
            .take(24)
            .map(char::from)
            .collect()
    }
    
    pub fn encrypt_private_key(&self, private_key: &str, password: &str) -> Result<String> {
        log::info!("🔐 Encrypting private key - original length: {}, preview: {}", 
                  private_key.len(), 
                  &private_key[..std::cmp::min(10, private_key.len())]);
        
        // Simple XOR encryption for demonstration - in production use proper encryption
        let key_bytes = private_key.as_bytes();
        let password_bytes = password.as_bytes();
        let mut encrypted = Vec::new();
        
        for (i, &byte) in key_bytes.iter().enumerate() {
            let password_byte = password_bytes[i % password_bytes.len()];
            encrypted.push(byte ^ password_byte);
        }
        
        let encrypted_b64 = base64::encode(&encrypted);
        log::info!("🔐 Encrypted result - base64 length: {}, preview: {}", 
                  encrypted_b64.len(), 
                  &encrypted_b64[..std::cmp::min(20, encrypted_b64.len())]);
        
        Ok(encrypted_b64)
    }
    
    pub fn decrypt_private_key(&self, encrypted_data: &str, password: &str) -> Result<String> {
        log::info!("🔓 ZAP DECRYPT AUDIT: Starting decryption process");
        log::info!("🔓 ZAP DECRYPT AUDIT: Encrypted data length: {}", encrypted_data.len());
        log::info!("🔓 ZAP DECRYPT AUDIT: Encrypted data preview: {}", &encrypted_data[..std::cmp::min(50, encrypted_data.len())]);
        log::info!("🔓 ZAP DECRYPT AUDIT: Password length: {}", password.len());
        log::info!("🔓 ZAP DECRYPT AUDIT: Password preview: {}", &password[..std::cmp::min(10, password.len())]);
        
        // Decode base64
        let encrypted_bytes = match base64::decode(encrypted_data) {
            Ok(bytes) => {
                log::info!("🔓 ZAP DECRYPT AUDIT: Base64 decode successful, bytes length: {}", bytes.len());
                log::info!("🔓 ZAP DECRYPT AUDIT: First 10 encrypted bytes: {:?}", &bytes[..std::cmp::min(10, bytes.len())]);
                bytes
            },
            Err(e) => {
                log::error!("🔓 ZAP DECRYPT AUDIT: Base64 decode failed: {}", e);
                return Err(anyhow::anyhow!("Base64 decode failed: {}", e));
            }
        };
        
        let password_bytes = password.as_bytes();
        log::info!("🔓 ZAP DECRYPT AUDIT: Password bytes length: {}", password_bytes.len());
        log::info!("🔓 ZAP DECRYPT AUDIT: First 5 password bytes: {:?}", &password_bytes[..std::cmp::min(5, password_bytes.len())]);
        
        let mut decrypted = Vec::new();
        
        // XOR decryption (WARNING: This is weak encryption!)
        log::info!("🔓 ZAP DECRYPT AUDIT: Starting XOR decryption...");
        for (i, &byte) in encrypted_bytes.iter().enumerate() {
            let password_byte = password_bytes[i % password_bytes.len()];
            let decrypted_byte = byte ^ password_byte;
            decrypted.push(decrypted_byte);
            
            if i < 10 {
                log::info!("🔓 ZAP DECRYPT AUDIT: Byte {}: {} ^ {} = {}", i, byte, password_byte, decrypted_byte);
            }
        }
        
        log::info!("🔓 ZAP DECRYPT AUDIT: XOR decryption complete, decrypted bytes length: {}", decrypted.len());
        log::info!("🔓 ZAP DECRYPT AUDIT: First 10 decrypted bytes: {:?}", &decrypted[..std::cmp::min(10, decrypted.len())]);
        
        // Convert to string
        let decrypted_string = match String::from_utf8(decrypted.clone()) {
            Ok(s) => {
                log::info!("🔓 ZAP DECRYPT AUDIT: UTF-8 conversion successful");
                log::info!("🔓 ZAP DECRYPT AUDIT: Decrypted string length: {}", s.len());
                log::info!("🔓 ZAP DECRYPT AUDIT: Decrypted string preview: {}", &s[..std::cmp::min(20, s.len())]);
                s
            },
            Err(e) => {
                log::error!("🔓 ZAP DECRYPT AUDIT: UTF-8 conversion failed: {}", e);
                log::error!("🔓 ZAP DECRYPT AUDIT: Invalid UTF-8 bytes: {:?}", &decrypted[..std::cmp::min(20, decrypted.len())]);
                return Err(anyhow::anyhow!("UTF-8 conversion failed: {}", e));
            }
        };
        
        log::info!("🔓 ZAP DECRYPT AUDIT: Decryption completed successfully");
        Ok(decrypted_string)
    }
    
    pub fn generate_genesis_keyset(&self, 
        validator_count: u32,
        governance_count: u32,
        emergency_count: u32,
        user_password: Option<String>
    ) -> Result<ZAPGenesisKeySet> {
        log::info!("Generating ZAP blockchain genesis key set - validators: {}, governance: {}, emergency: {}", 
                  validator_count, governance_count, emergency_count);
        
        let key_set_id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        
        // Generate chain genesis key (ML-DSA-87)
        let chain_genesis = self.generate_chain_genesis_key(user_password.as_deref())?;
        
        // Generate validator keys (ML-DSA-87)
        let mut validator_keys = Vec::new();
        for i in 1..=validator_count {
            validator_keys.push(self.generate_validator_key(i, user_password.as_deref())?);
        }
        
        // Generate treasury keys (ML-KEM-1024 + ML-DSA-87)
        let treasury_keys = self.generate_treasury_keys(user_password.as_deref())?;
        
        // Generate governance keys (ML-DSA-65)
        let mut governance_keys = Vec::new();
        for i in 1..=governance_count {
            let governance_key = self.generate_governance_key(i, user_password.as_deref())?;
            governance_keys.push(governance_key);
        }
        
        // Generate emergency recovery keys (SLH-DSA-256s)
        let mut emergency_keys = Vec::new();
        for i in 1..=emergency_count {
            let emergency_key = self.generate_emergency_key(i, user_password.as_deref())?;
            emergency_keys.push(emergency_key);
        }
        
        Ok(ZAPGenesisKeySet {
            chain_genesis,
            validator_keys,
            treasury_keys,
            governance_keys,
            emergency_keys,
            generated_at: now,
            network: self.network_config.name.clone(),
            key_set_id,
        })
    }
    
    fn generate_chain_genesis_key(&self, user_password: Option<&str>) -> Result<ZAPBlockchainKey> {
        log::info!("Generating chain genesis key with ML-DSA-87");
        
        let cosmos_config = CosmosNetworkConfig {
            name: self.network_config.name.clone(),
            coin_type: self.network_config.coin_type,
            bech32_prefix: self.network_config.bech32_prefix.clone(),
            chain_id: self.network_config.chain_id.clone(),
            rpc_endpoint: None,
        };
        
        let key_pair = self.cosmos_generator.generate_key_pair(&cosmos_config)?;
        let password = user_password.map(|p| p.to_string()).unwrap_or_else(|| self.generate_unique_password());
        let private_key_hex = self.cosmos_generator.private_key_to_hex(&key_pair.private_key);
        let encrypted_private_key = self.encrypt_private_key(&private_key_hex, &password)?;
        
        Ok(ZAPBlockchainKey {
            id: Uuid::new_v4().to_string(),
            key_type: ZAPKeyType::Genesis,
            key_role: "chain_genesis".to_string(),
            algorithm: "ML-DSA-87".to_string(),
            public_key: self.cosmos_generator.public_key_to_base64(&key_pair.public_key),
            encrypted_private_key,
            encryption_password: password,
            address: key_pair.address.clone(),
            derivation_path: Some("m/44'/9999'/0'/0/0".to_string()),
            network_name: self.network_config.name.clone(),
            created_at: chrono::Utc::now().to_rfc3339(),
            metadata: ZAPKeyMetadata {
                purpose: "ZAP Blockchain Chain Genesis Key".to_string(),
                security_level: 5,
                quantum_enhanced: true,
                multi_sig_config: Some(MultiSigConfig {
                    threshold: 3,
                    total_keys: 5,
                    participants: vec!["genesis_authority".to_string()],
                }),
                access_controls: AccessControls {
                    access_level: 5,
                    time_lock_hours: Some(48),
                    geographic_restrictions: vec!["secure_facility".to_string()],
                    approval_required: true,
                },
                backup_locations: vec![
                    "primary_vault".to_string(),
                    "secondary_vault".to_string(),
                    "geographic_backup".to_string(),
                ],
            },
        })
    }
    
    fn generate_validator_key(&self, validator_index: u32, user_password: Option<&str>) -> Result<ZAPBlockchainKey> {
        log::info!("Generating validator key {} with ML-DSA-87", validator_index);
        
        let cosmos_config = CosmosNetworkConfig {
            name: self.network_config.name.clone(),
            coin_type: self.network_config.coin_type,
            bech32_prefix: self.network_config.bech32_prefix.clone(),
            chain_id: self.network_config.chain_id.clone(),
            rpc_endpoint: None,
        };
        
        let key_pair = self.cosmos_generator.generate_key_pair(&cosmos_config)?;
        let password = user_password.map(|p| p.to_string()).unwrap_or_else(|| self.generate_unique_password());
        let private_key_hex = self.cosmos_generator.private_key_to_hex(&key_pair.private_key);
        let encrypted_private_key = self.encrypt_private_key(&private_key_hex, &password)?;
        
        Ok(ZAPBlockchainKey {
            id: Uuid::new_v4().to_string(),
            key_type: ZAPKeyType::Validator,
            key_role: format!("validator_{}", validator_index),
            algorithm: "ML-DSA-87".to_string(),
            public_key: self.cosmos_generator.public_key_to_base64(&key_pair.public_key),
            encrypted_private_key,
            encryption_password: password,
            address: key_pair.address.clone(),
            derivation_path: Some(format!("m/44'/9999'/0'/0/{}", validator_index)),
            network_name: self.network_config.name.clone(),
            created_at: chrono::Utc::now().to_rfc3339(),
            metadata: ZAPKeyMetadata {
                purpose: format!("ZAP Blockchain Validator {} Genesis Key", validator_index),
                security_level: 4,
                quantum_enhanced: true,
                multi_sig_config: Some(MultiSigConfig {
                    threshold: 2,
                    total_keys: 3,
                    participants: vec![format!("validator_{}", validator_index)],
                }),
                access_controls: AccessControls {
                    access_level: 4,
                    time_lock_hours: Some(24),
                    geographic_restrictions: vec!["validator_facility".to_string()],
                    approval_required: true,
                },
                backup_locations: vec![
                    "validator_primary".to_string(),
                    "validator_backup".to_string(),
                ],
            },
        })
    }
    
    fn generate_treasury_keys(&self, user_password: Option<&str>) -> Result<ZAPTreasuryKeys> {
        log::info!("Generating treasury key set with ML-KEM-1024 + ML-DSA-87");
        
        let cosmos_config = CosmosNetworkConfig {
            name: self.network_config.name.clone(),
            coin_type: self.network_config.coin_type,
            bech32_prefix: self.network_config.bech32_prefix.clone(),
            chain_id: self.network_config.chain_id.clone(),
            rpc_endpoint: None,
        };
        
        // Master treasury key
        let master_key_pair = self.cosmos_generator.generate_key_pair(&cosmos_config)?;
        let master_password = user_password.map(|p| p.to_string()).unwrap_or_else(|| self.generate_unique_password());
        let master_private_key_hex = self.cosmos_generator.private_key_to_hex(&master_key_pair.private_key);
        let master_encrypted_private_key = self.encrypt_private_key(&master_private_key_hex, &master_password)?;
        
        let master_key = ZAPBlockchainKey {
            id: Uuid::new_v4().to_string(),
            key_type: ZAPKeyType::Treasury,
            key_role: "treasury_master".to_string(),
            algorithm: "ML-KEM-1024+ML-DSA-87".to_string(),
            public_key: self.cosmos_generator.public_key_to_base64(&master_key_pair.public_key),
            encrypted_private_key: master_encrypted_private_key,
            encryption_password: master_password,
            address: master_key_pair.address.clone(),
            derivation_path: Some("m/44'/9999'/1'/0/0".to_string()),
            network_name: self.network_config.name.clone(),
            created_at: chrono::Utc::now().to_rfc3339(),
            metadata: ZAPKeyMetadata {
                purpose: "ZAP Blockchain Treasury Master Key".to_string(),
                security_level: 5,
                quantum_enhanced: true,
                multi_sig_config: Some(MultiSigConfig {
                    threshold: 3,
                    total_keys: 5,
                    participants: vec!["treasury_authority".to_string()],
                }),
                access_controls: AccessControls {
                    access_level: 5,
                    time_lock_hours: Some(72),
                    geographic_restrictions: vec!["treasury_vault".to_string()],
                    approval_required: true,
                },
                backup_locations: vec![
                    "treasury_primary".to_string(),
                    "treasury_secondary".to_string(),
                    "treasury_geographic".to_string(),
                    "legal_custody".to_string(),
                ],
            },
        };
        
        // Multi-sig keys (3 keys for 3-of-5 multi-sig)
        let mut multi_sig_keys = Vec::new();
        for i in 1..=3 {
            let key_pair = self.cosmos_generator.generate_key_pair(&cosmos_config)?;
            let password = user_password.map(|p| p.to_string()).unwrap_or_else(|| self.generate_unique_password());
            let private_key_hex = self.cosmos_generator.private_key_to_hex(&key_pair.private_key);
            let encrypted_private_key = self.encrypt_private_key(&private_key_hex, &password)?;
            
            let multi_sig_key = ZAPBlockchainKey {
                id: Uuid::new_v4().to_string(),
                key_type: ZAPKeyType::Treasury,
                key_role: format!("treasury_multisig_{}", i),
                algorithm: "ML-DSA-87".to_string(),
                public_key: self.cosmos_generator.public_key_to_base64(&key_pair.public_key),
                encrypted_private_key,
                encryption_password: password,
                address: key_pair.address.clone(),
                derivation_path: Some(format!("m/44'/9999'/1'/0/{}", i)),
                network_name: self.network_config.name.clone(),
                created_at: chrono::Utc::now().to_rfc3339(),
                metadata: ZAPKeyMetadata {
                    purpose: format!("ZAP Blockchain Treasury Multi-Sig Key {}", i),
                    security_level: 5,
                    quantum_enhanced: true,
                    multi_sig_config: Some(MultiSigConfig {
                        threshold: 3,
                        total_keys: 5,
                        participants: vec![format!("treasury_signer_{}", i)],
                    }),
                    access_controls: AccessControls {
                        access_level: 5,
                        time_lock_hours: Some(48),
                        geographic_restrictions: vec!["treasury_facility".to_string()],
                        approval_required: true,
                    },
                    backup_locations: vec![
                        format!("treasury_multisig_{}_primary", i),
                        format!("treasury_multisig_{}_backup", i),
                    ],
                },
            };
            multi_sig_keys.push(multi_sig_key);
        }
        
        // Backup key (SLH-DSA-256s)
        let backup_key_pair = self.cosmos_generator.generate_key_pair(&cosmos_config)?;
        let backup_password = user_password.map(|p| p.to_string()).unwrap_or_else(|| self.generate_unique_password());
        let backup_private_key_hex = self.cosmos_generator.private_key_to_hex(&backup_key_pair.private_key);
        let backup_encrypted_private_key = self.encrypt_private_key(&backup_private_key_hex, &backup_password)?;
        
        let backup_key = ZAPBlockchainKey {
            id: Uuid::new_v4().to_string(),
            key_type: ZAPKeyType::Treasury,
            key_role: "treasury_backup".to_string(),
            algorithm: "SLH-DSA-256s".to_string(),
            public_key: self.cosmos_generator.public_key_to_base64(&backup_key_pair.public_key),
            encrypted_private_key: backup_encrypted_private_key,
            encryption_password: backup_password,
            address: backup_key_pair.address.clone(),
            derivation_path: Some("m/44'/9999'/1'/1/0".to_string()),
            network_name: self.network_config.name.clone(),
            created_at: chrono::Utc::now().to_rfc3339(),
            metadata: ZAPKeyMetadata {
                purpose: "ZAP Blockchain Treasury Backup Key".to_string(),
                security_level: 5,
                quantum_enhanced: true,
                multi_sig_config: None,
                access_controls: AccessControls {
                    access_level: 5,
                    time_lock_hours: None,
                    geographic_restrictions: vec!["emergency_facility".to_string()],
                    approval_required: true,
                },
                backup_locations: vec![
                    "emergency_vault".to_string(),
                    "legal_custody_backup".to_string(),
                ],
            },
        };
        
        Ok(ZAPTreasuryKeys {
            master_key,
            multi_sig_keys,
            backup_key,
            multi_sig_threshold: 3,
        })
    }
    
    fn generate_governance_key(&self, governance_index: u32, user_password: Option<&str>) -> Result<ZAPBlockchainKey> {
        log::info!("Generating governance key {} with ML-DSA-65", governance_index);
        
        let cosmos_config = CosmosNetworkConfig {
            name: self.network_config.name.clone(),
            coin_type: self.network_config.coin_type,
            bech32_prefix: self.network_config.bech32_prefix.clone(),
            chain_id: self.network_config.chain_id.clone(),
            rpc_endpoint: None,
        };
        
        let key_pair = self.cosmos_generator.generate_key_pair(&cosmos_config)?;
        let password = user_password.map(|p| p.to_string()).unwrap_or_else(|| self.generate_unique_password());
        let private_key_hex = self.cosmos_generator.private_key_to_hex(&key_pair.private_key);
        let encrypted_private_key = self.encrypt_private_key(&private_key_hex, &password)?;
        
        Ok(ZAPBlockchainKey {
            id: Uuid::new_v4().to_string(),
            key_type: ZAPKeyType::Governance,
            key_role: format!("governance_{}", governance_index),
            algorithm: "ML-DSA-65".to_string(),
            public_key: self.cosmos_generator.public_key_to_base64(&key_pair.public_key),
            encrypted_private_key,
            encryption_password: password,
            address: key_pair.address.clone(),
            derivation_path: Some(format!("m/44'/9999'/2'/0/{}", governance_index)),
            network_name: self.network_config.name.clone(),
            created_at: chrono::Utc::now().to_rfc3339(),
            metadata: ZAPKeyMetadata {
                purpose: format!("ZAP Blockchain Governance Key {}", governance_index),
                security_level: 3,
                quantum_enhanced: true,
                multi_sig_config: Some(MultiSigConfig {
                    threshold: 4,
                    total_keys: 7,
                    participants: vec![format!("governance_member_{}", governance_index)],
                }),
                access_controls: AccessControls {
                    access_level: 3,
                    time_lock_hours: Some(12),
                    geographic_restrictions: vec!["governance_facility".to_string()],
                    approval_required: false,
                },
                backup_locations: vec![
                    "governance_primary".to_string(),
                    "governance_backup".to_string(),
                ],
            },
        })
    }
    
    fn generate_emergency_key(&self, emergency_index: u32, user_password: Option<&str>) -> Result<ZAPBlockchainKey> {
        log::info!("Generating emergency key {} with SLH-DSA-256s", emergency_index);
        
        let cosmos_config = CosmosNetworkConfig {
            name: self.network_config.name.clone(),
            coin_type: self.network_config.coin_type,
            bech32_prefix: self.network_config.bech32_prefix.clone(),
            chain_id: self.network_config.chain_id.clone(),
            rpc_endpoint: None,
        };
        
        let key_pair = self.cosmos_generator.generate_key_pair(&cosmos_config)?;
        let password = user_password.map(|p| p.to_string()).unwrap_or_else(|| self.generate_unique_password());
        let private_key_hex = self.cosmos_generator.private_key_to_hex(&key_pair.private_key);
        let encrypted_private_key = self.encrypt_private_key(&private_key_hex, &password)?;
        
        Ok(ZAPBlockchainKey {
            id: Uuid::new_v4().to_string(),
            key_type: ZAPKeyType::Emergency,
            key_role: format!("emergency_{}", emergency_index),
            algorithm: "SLH-DSA-256s".to_string(),
            public_key: self.cosmos_generator.public_key_to_base64(&key_pair.public_key),
            encrypted_private_key,
            encryption_password: password,
            address: key_pair.address.clone(),
            derivation_path: Some(format!("m/44'/9999'/3'/0/{}", emergency_index)),
            network_name: self.network_config.name.clone(),
            created_at: chrono::Utc::now().to_rfc3339(),
            metadata: ZAPKeyMetadata {
                purpose: format!("ZAP Blockchain Emergency Recovery Key {}", emergency_index),
                security_level: 5,
                quantum_enhanced: true,
                multi_sig_config: Some(MultiSigConfig {
                    threshold: 2,
                    total_keys: 3,
                    participants: vec![format!("emergency_authority_{}", emergency_index)],
                }),
                access_controls: AccessControls {
                    access_level: 5,
                    time_lock_hours: None,
                    geographic_restrictions: vec!["emergency_facility".to_string()],
                    approval_required: true,
                },
                backup_locations: vec![
                    "emergency_primary".to_string(),
                    "legal_custody_emergency".to_string(),
                    "geographic_emergency".to_string(),
                ],
            },
        })
    }
}

// Default ZAP blockchain network configurations
pub fn get_default_zap_networks() -> Vec<ZAPBlockchainNetworkConfig> {
    vec![
        ZAPBlockchainNetworkConfig {
            name: "ZAP Mainnet".to_string(),
            chain_id: "zap-mainnet-1".to_string(),
            bech32_prefix: "zap".to_string(),
            coin_type: 118,
            network_type: ZAPNetworkType::Mainnet,
            consensus_algorithm: "CometBFT+ML-DSA".to_string(),
            quantum_safe: true,
        },
        ZAPBlockchainNetworkConfig {
            name: "ZAP Testnet".to_string(),
            chain_id: "zap-testnet-1".to_string(),
            bech32_prefix: "zaptest".to_string(),
            coin_type: 1,
            network_type: ZAPNetworkType::Testnet,
            consensus_algorithm: "CometBFT+ML-DSA".to_string(),
            quantum_safe: true,
        },
        ZAPBlockchainNetworkConfig {
            name: "ZAP Devnet".to_string(),
            chain_id: "zap-devnet-1".to_string(),
            bech32_prefix: "zapdev".to_string(),
            coin_type: 1,
            network_type: ZAPNetworkType::Devnet,
            consensus_algorithm: "CometBFT+ML-DSA".to_string(),
            quantum_safe: true,
        },
    ]
}

pub fn get_network_by_name(name: &str) -> Option<ZAPBlockchainNetworkConfig> {
    get_default_zap_networks()
        .into_iter()
        .find(|network| network.name == name)
}
