-- Migration: Add Cosmos blockchain key management support
-- Date: 2025-09-03
-- Description: Creates tables for Cosmos keys and network configurations

-- Cosmos keys table
CREATE TABLE cosmos_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_id TEXT NOT NULL,
    network_name TEXT NOT NULL,
    bech32_prefix TEXT NOT NULL,
    address TEXT NOT NULL UNIQUE,
    encrypted_private_key TEXT NOT NULL,
    public_key TEXT NOT NULL,
    derivation_path TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    quantum_enhanced BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
);

-- Cosmos networks configuration table
CREATE TABLE cosmos_networks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    coin_type INTEGER NOT NULL,
    bech32_prefix TEXT NOT NULL,
    chain_id TEXT NOT NULL,
    rpc_endpoint TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default Cosmos networks
INSERT INTO cosmos_networks (name, coin_type, bech32_prefix, chain_id, rpc_endpoint) VALUES
('Cosmos Hub', 118, 'cosmos', 'cosmoshub-4', 'https://cosmos-rpc.polkachu.com'),
('Osmosis', 118, 'osmo', 'osmosis-1', 'https://osmosis-rpc.polkachu.com'),
('Juno', 118, 'juno', 'juno-1', 'https://juno-rpc.polkachu.com'),
('Stargaze', 118, 'stars', 'stargaze-1', 'https://stargaze-rpc.polkachu.com'),
('Akash', 118, 'akash', 'akashnet-2', 'https://akash-rpc.polkachu.com');

-- Create indexes for better performance
CREATE INDEX idx_cosmos_keys_vault_id ON cosmos_keys(vault_id);
CREATE INDEX idx_cosmos_keys_network ON cosmos_keys(network_name);
CREATE INDEX idx_cosmos_keys_address ON cosmos_keys(address);
CREATE INDEX idx_cosmos_keys_active ON cosmos_keys(is_active);
CREATE INDEX idx_cosmos_networks_prefix ON cosmos_networks(bech32_prefix);
CREATE INDEX idx_cosmos_networks_enabled ON cosmos_networks(enabled);
