-- Initial schema migration for Zap Vault
-- This creates all the core tables with proper structure and relationships

-- Users table - core authentication and user management
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT 1,
    mfa_enabled BOOLEAN NOT NULL DEFAULT 0,
    last_login DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Vaults table - secure containers for storing keys and items
CREATE TABLE vaults (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    vault_type TEXT NOT NULL DEFAULT 'personal',
    is_shared BOOLEAN NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT 0,
    is_system_default BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Vault items - generic encrypted storage within vaults
CREATE TABLE vault_items (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    title TEXT NOT NULL,
    encrypted_data TEXT NOT NULL,
    metadata TEXT,
    tags TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vault_id) REFERENCES vaults (id) ON DELETE CASCADE
);

-- Vault permissions - sharing and access control
CREATE TABLE vault_permissions (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    permission_level TEXT NOT NULL DEFAULT 'read',
    granted_by TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vault_id) REFERENCES vaults (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users (id),
    UNIQUE(vault_id, user_id)
);

-- USB drive passwords - cold storage device management
CREATE TABLE usb_drive_passwords (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    drive_id TEXT NOT NULL,
    device_path TEXT NOT NULL,
    drive_label TEXT,
    encrypted_password TEXT NOT NULL,
    password_hint TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id, drive_id)
);

-- Bitcoin keys - individual Bitcoin private/public key pairs
CREATE TABLE bitcoin_keys (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL,
    key_type TEXT NOT NULL, -- 'legacy', 'segwit', 'native', 'multisig', 'taproot'
    network TEXT NOT NULL, -- 'mainnet', 'testnet', 'regtest'
    encrypted_private_key BLOB NOT NULL,
    public_key BLOB NOT NULL,
    address TEXT NOT NULL,
    derivation_path TEXT,
    entropy_source TEXT NOT NULL, -- 'system', 'quantum', 'quantum_enhanced', 'hardware'
    quantum_enhanced BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
);

-- HD wallets - hierarchical deterministic wallet storage
CREATE TABLE hd_wallets (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL,
    name TEXT NOT NULL,
    network TEXT NOT NULL,
    encrypted_master_seed BLOB NOT NULL,
    encrypted_mnemonic BLOB NOT NULL,
    encrypted_master_xprv BLOB NOT NULL,
    master_xpub TEXT NOT NULL,
    derivation_count INTEGER DEFAULT 0,
    quantum_enhanced BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_derived DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
);

-- Bitcoin key metadata - additional information and tracking
CREATE TABLE bitcoin_key_metadata (
    key_id TEXT PRIMARY KEY,
    label TEXT,
    description TEXT,
    tags TEXT, -- JSON array
    balance_satoshis INTEGER DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    last_transaction DATETIME,
    backup_count INTEGER DEFAULT 0,
    last_backup DATETIME,
    FOREIGN KEY (key_id) REFERENCES bitcoin_keys(id) ON DELETE CASCADE
);

-- Key backup logs - cold storage backup tracking
CREATE TABLE key_backup_logs (
    id TEXT PRIMARY KEY,
    drive_id TEXT NOT NULL,
    key_ids TEXT NOT NULL, -- JSON array of key IDs
    backup_path TEXT NOT NULL,
    backup_type TEXT NOT NULL, -- 'bitcoin_keys', 'hd_wallets', 'mixed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    size_bytes INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    encryption_method TEXT NOT NULL,
    status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'failed'
    verification_status TEXT DEFAULT 'pending' -- 'pending', 'verified', 'failed'
);

-- Create indexes for performance
CREATE INDEX idx_vaults_user_id ON vaults(user_id);
CREATE INDEX idx_vaults_is_default ON vaults(is_default);
CREATE INDEX idx_vaults_is_system_default ON vaults(is_system_default);
CREATE INDEX idx_vault_items_vault_id ON vault_items(vault_id);
CREATE INDEX idx_bitcoin_keys_vault_id ON bitcoin_keys(vault_id);
CREATE INDEX idx_bitcoin_keys_address ON bitcoin_keys(address);
CREATE INDEX idx_hd_wallets_vault_id ON hd_wallets(vault_id);

-- Insert default system user and vault for offline mode
INSERT INTO users (id, username, email, password_hash, salt, created_at, updated_at) 
VALUES ('default_user', 'offline_user', 'offline@vault.local', 'offline_mode', 'offline_salt', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO vaults (id, user_id, name, description, vault_type, is_default, is_system_default, created_at, updated_at) 
VALUES ('default_vault', 'default_user', 'Default Vault', 'System default vault for offline Bitcoin key storage', 'personal', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
