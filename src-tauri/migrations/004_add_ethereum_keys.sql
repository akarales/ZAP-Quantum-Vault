-- Migration to add Ethereum key management support
-- This migration creates tables for Ethereum keys with quantum-enhanced entropy

-- Create ethereum_keys table
CREATE TABLE IF NOT EXISTS ethereum_keys (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL,
    key_type TEXT NOT NULL CHECK (key_type IN ('standard', 'contract', 'multisig')),
    network TEXT NOT NULL CHECK (network IN ('mainnet', 'goerli', 'sepolia', 'polygon', 'bsc', 'arbitrum', 'optimism')),
    encrypted_private_key BLOB NOT NULL,
    public_key BLOB NOT NULL,
    address TEXT NOT NULL,
    derivation_path TEXT,
    entropy_source TEXT NOT NULL CHECK (entropy_source IN ('system_rng', 'quantum_enhanced', 'hardware')),
    quantum_enhanced BOOLEAN DEFAULT TRUE,
    created_at TEXT NOT NULL,
    last_used TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    encryption_password TEXT NOT NULL,
    FOREIGN KEY (vault_id) REFERENCES vaults (id) ON DELETE CASCADE
);

-- Create ethereum_key_metadata table for additional key information
CREATE TABLE IF NOT EXISTS ethereum_key_metadata (
    key_id TEXT PRIMARY KEY,
    label TEXT,
    description TEXT,
    tags TEXT, -- JSON array of tags
    balance_wei TEXT DEFAULT '0', -- Store as string to handle large numbers
    transaction_count INTEGER DEFAULT 0,
    last_balance_check TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (key_id) REFERENCES ethereum_keys (id) ON DELETE CASCADE
);

-- Create ethereum_transactions table for transaction history
CREATE TABLE IF NOT EXISTS ethereum_transactions (
    id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    transaction_hash TEXT NOT NULL,
    block_number INTEGER,
    block_hash TEXT,
    transaction_index INTEGER,
    from_address TEXT NOT NULL,
    to_address TEXT,
    value_wei TEXT NOT NULL,
    gas_price TEXT,
    gas_limit TEXT,
    gas_used TEXT,
    nonce INTEGER,
    input_data TEXT,
    transaction_type TEXT, -- 'sent', 'received', 'contract_call', 'contract_deploy'
    status TEXT, -- 'pending', 'confirmed', 'failed'
    network TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    confirmed_at TEXT,
    FOREIGN KEY (key_id) REFERENCES ethereum_keys (id) ON DELETE CASCADE
);

-- Create ethereum_key_backups table for tracking USB backups
CREATE TABLE IF NOT EXISTS ethereum_key_backups (
    id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    backup_id TEXT NOT NULL, -- UUID for the backup session
    drive_id TEXT NOT NULL,
    backup_path TEXT NOT NULL,
    checksum TEXT NOT NULL,
    backup_size INTEGER NOT NULL,
    encryption_method TEXT DEFAULT 'AES-256-GCM',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    verified_at TEXT,
    FOREIGN KEY (key_id) REFERENCES ethereum_keys (id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ethereum_keys_vault_id ON ethereum_keys(vault_id);
CREATE INDEX IF NOT EXISTS idx_ethereum_keys_address ON ethereum_keys(address);
CREATE INDEX IF NOT EXISTS idx_ethereum_keys_network ON ethereum_keys(network);
CREATE INDEX IF NOT EXISTS idx_ethereum_keys_key_type ON ethereum_keys(key_type);
CREATE INDEX IF NOT EXISTS idx_ethereum_keys_created_at ON ethereum_keys(created_at);
CREATE INDEX IF NOT EXISTS idx_ethereum_keys_is_active ON ethereum_keys(is_active);

CREATE INDEX IF NOT EXISTS idx_ethereum_key_metadata_label ON ethereum_key_metadata(label);
CREATE INDEX IF NOT EXISTS idx_ethereum_key_metadata_updated_at ON ethereum_key_metadata(updated_at);

CREATE INDEX IF NOT EXISTS idx_ethereum_transactions_key_id ON ethereum_transactions(key_id);
CREATE INDEX IF NOT EXISTS idx_ethereum_transactions_hash ON ethereum_transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_ethereum_transactions_block_number ON ethereum_transactions(block_number);
CREATE INDEX IF NOT EXISTS idx_ethereum_transactions_from_address ON ethereum_transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_ethereum_transactions_to_address ON ethereum_transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_ethereum_transactions_network ON ethereum_transactions(network);
CREATE INDEX IF NOT EXISTS idx_ethereum_transactions_status ON ethereum_transactions(status);
CREATE INDEX IF NOT EXISTS idx_ethereum_transactions_created_at ON ethereum_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_ethereum_key_backups_key_id ON ethereum_key_backups(key_id);
CREATE INDEX IF NOT EXISTS idx_ethereum_key_backups_backup_id ON ethereum_key_backups(backup_id);
CREATE INDEX IF NOT EXISTS idx_ethereum_key_backups_drive_id ON ethereum_key_backups(drive_id);

-- Create triggers to automatically update metadata timestamps
CREATE TRIGGER IF NOT EXISTS update_ethereum_key_metadata_timestamp 
    AFTER UPDATE ON ethereum_key_metadata
    FOR EACH ROW
BEGIN
    UPDATE ethereum_key_metadata 
    SET updated_at = datetime('now') 
    WHERE key_id = NEW.key_id;
END;

-- Create trigger to automatically create metadata entry when key is created
CREATE TRIGGER IF NOT EXISTS create_ethereum_key_metadata 
    AFTER INSERT ON ethereum_keys
    FOR EACH ROW
BEGIN
    INSERT INTO ethereum_key_metadata (key_id, created_at, updated_at)
    VALUES (NEW.id, NEW.created_at, NEW.created_at);
END;

-- Create view for easy key listing with metadata
CREATE VIEW IF NOT EXISTS ethereum_keys_with_metadata AS
SELECT 
    ek.id,
    ek.vault_id,
    ek.key_type,
    ek.network,
    ek.address,
    ek.derivation_path,
    ek.entropy_source,
    ek.quantum_enhanced,
    ek.created_at,
    ek.last_used,
    ek.is_active,
    ekm.label,
    ekm.description,
    ekm.tags,
    ekm.balance_wei,
    ekm.transaction_count,
    ekm.last_balance_check,
    ekm.updated_at as metadata_updated_at
FROM ethereum_keys ek
LEFT JOIN ethereum_key_metadata ekm ON ek.id = ekm.key_id;
