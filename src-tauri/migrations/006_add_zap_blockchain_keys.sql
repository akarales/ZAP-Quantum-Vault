-- ZAP Blockchain Keys Migration
-- Add tables for ZAP blockchain genesis key management

-- ZAP blockchain keys table
CREATE TABLE zap_blockchain_keys (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL,
    key_type TEXT NOT NULL, -- 'genesis', 'validator', 'treasury', 'governance', 'emergency'
    key_role TEXT NOT NULL, -- 'chain_genesis', 'validator_1', 'treasury_master', etc.
    network_name TEXT NOT NULL DEFAULT 'zap-mainnet-1',
    algorithm TEXT NOT NULL, -- 'ML-DSA-87', 'ML-KEM-1024', 'SLH-DSA-256s'
    public_key TEXT NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    key_metadata TEXT, -- JSON metadata
    genesis_config TEXT, -- Genesis configuration data
    multi_sig_config TEXT, -- Multi-signature configuration if applicable
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    quantum_enhanced BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (vault_id) REFERENCES vaults(id)
);

-- ZAP genesis configuration table
CREATE TABLE zap_genesis_config (
    id TEXT PRIMARY KEY,
    chain_id TEXT NOT NULL DEFAULT 'zap-mainnet-1',
    genesis_time DATETIME NOT NULL,
    initial_validators TEXT NOT NULL, -- JSON array of validator info
    treasury_config TEXT NOT NULL, -- JSON treasury configuration
    governance_config TEXT NOT NULL, -- JSON governance parameters
    token_config TEXT NOT NULL, -- JSON token economics
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_finalized BOOLEAN DEFAULT FALSE
);

-- ZAP network configurations table
CREATE TABLE zap_network_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    chain_id TEXT NOT NULL,
    bech32_prefix TEXT NOT NULL,
    coin_type INTEGER NOT NULL,
    network_type TEXT NOT NULL, -- 'mainnet', 'testnet', 'devnet'
    consensus_algorithm TEXT NOT NULL,
    quantum_safe BOOLEAN DEFAULT TRUE,
    enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default ZAP network configurations
INSERT INTO zap_network_configs (id, name, chain_id, bech32_prefix, coin_type, network_type, consensus_algorithm, quantum_safe, enabled) VALUES
('zap-mainnet', 'ZAP Mainnet', 'zap-mainnet-1', 'zap', 118, 'mainnet', 'CometBFT+ML-DSA', TRUE, TRUE),
('zap-testnet', 'ZAP Testnet', 'zap-testnet-1', 'zaptest', 1, 'testnet', 'CometBFT+ML-DSA', TRUE, TRUE),
('zap-devnet', 'ZAP Devnet', 'zap-devnet-1', 'zapdev', 1, 'devnet', 'CometBFT+ML-DSA', TRUE, TRUE);

-- Create indexes for performance
CREATE INDEX idx_zap_blockchain_keys_vault_id ON zap_blockchain_keys(vault_id);
CREATE INDEX idx_zap_blockchain_keys_key_type ON zap_blockchain_keys(key_type);
CREATE INDEX idx_zap_blockchain_keys_network ON zap_blockchain_keys(network_name);
CREATE INDEX idx_zap_blockchain_keys_active ON zap_blockchain_keys(is_active);
CREATE INDEX idx_zap_genesis_config_chain_id ON zap_genesis_config(chain_id);
CREATE INDEX idx_zap_network_configs_name ON zap_network_configs(name);
