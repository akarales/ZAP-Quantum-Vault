-- Migration to add real encryption support
-- This migration adds columns for proper AES-256-GCM encryption

-- Add new columns for real encryption
ALTER TABLE vault_items ADD COLUMN encrypted_data_v2 TEXT;
ALTER TABLE vault_items ADD COLUMN encryption_version INTEGER DEFAULT 2;
ALTER TABLE vault_items ADD COLUMN encryption_salt TEXT; -- Base64 encoded salt
ALTER TABLE vault_items ADD COLUMN encryption_algorithm TEXT DEFAULT 'AES-256-GCM';
ALTER TABLE vault_items ADD COLUMN migration_status TEXT DEFAULT 'pending'; -- 'pending', 'migrated', 'failed'

-- Add index for migration status to track progress
CREATE INDEX IF NOT EXISTS idx_vault_items_migration_status ON vault_items(migration_status);

-- Add index for encryption version for future compatibility
CREATE INDEX IF NOT EXISTS idx_vault_items_encryption_version ON vault_items(encryption_version);

-- Add audit table for tracking encryption migration
CREATE TABLE IF NOT EXISTS encryption_migration_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_item_id TEXT NOT NULL,
    migration_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    old_encryption TEXT, -- 'base64' for legacy
    new_encryption TEXT, -- 'AES-256-GCM'
    status TEXT NOT NULL, -- 'success', 'failed'
    error_message TEXT,
    FOREIGN KEY (vault_item_id) REFERENCES vault_items(id)
);

-- Create backup table for original data before migration
CREATE TABLE IF NOT EXISTS vault_items_backup_pre_encryption (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL,
    title TEXT NOT NULL,
    encrypted_data TEXT NOT NULL, -- Original base64 data
    item_type TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    backup_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add metadata table for encryption keys (salts are stored per-item, but we track key derivation info)
CREATE TABLE IF NOT EXISTS encryption_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    key_derivation_method TEXT DEFAULT 'Argon2id',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);
