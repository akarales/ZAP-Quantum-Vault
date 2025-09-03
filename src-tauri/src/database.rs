use anyhow::Result;
use sqlx::{SqlitePool, migrate::MigrateDatabase, Sqlite};
use crate::crypto::{hash_password};
use uuid::Uuid;
use tauri::Manager;

pub async fn initialize_database_with_app_handle(app_handle: &tauri::AppHandle) -> Result<SqlitePool> {
    // Use Tauri's app data directory - the proper way for production apps
    let mut db_path = app_handle.path().app_data_dir()
        .map_err(|e| anyhow::anyhow!("Failed to get app data dir: {}", e))?;
    
    // Create the app data directory if it doesn't exist
    std::fs::create_dir_all(&db_path)?;
    
    // Add the database filename
    db_path.push("vault.db");
    
    let database_url = format!("sqlite:{}", db_path.display());
    println!("Connecting to database: {}", database_url);
    
    // Create database if it doesn't exist
    if !Sqlite::database_exists(&database_url).await.unwrap_or(false) {
        println!("Creating database {}", database_url);
        Sqlite::create_database(&database_url).await?;
    }
    
    let pool = SqlitePool::connect(&database_url).await?;
    
    // Create tables
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            is_active BOOLEAN NOT NULL DEFAULT 1,
            mfa_enabled BOOLEAN NOT NULL DEFAULT 0,
            last_login TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )"
    )
    .execute(&pool)
    .await?;
    
    
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS vaults (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            vault_type TEXT NOT NULL DEFAULT 'personal',
            is_shared BOOLEAN NOT NULL DEFAULT 0,
            is_default BOOLEAN NOT NULL DEFAULT 0,
            is_system_default BOOLEAN NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )"
    )
    .execute(&pool)
    .await?;
    
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS vault_items (
            id TEXT PRIMARY KEY,
            vault_id TEXT NOT NULL,
            item_type TEXT NOT NULL,
            title TEXT NOT NULL,
            encrypted_data TEXT NOT NULL,
            metadata TEXT,
            tags TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (vault_id) REFERENCES vaults (id) ON DELETE CASCADE
        )"
    )
    .execute(&pool)
    .await?;
    
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS vault_permissions (
            id TEXT PRIMARY KEY,
            vault_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            permission_level TEXT NOT NULL DEFAULT 'read',
            granted_by TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (vault_id) REFERENCES vaults (id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (granted_by) REFERENCES users (id),
            UNIQUE(vault_id, user_id)
        )"
    )
    .execute(&pool)
    .await?;
    
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS usb_drive_passwords (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            drive_id TEXT NOT NULL,
            device_path TEXT NOT NULL,
            drive_label TEXT,
            encrypted_password TEXT NOT NULL,
            password_hint TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_used TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE(user_id, drive_id)
        )"
    )
    .execute(&pool)
    .await?;
    
    // Bitcoin keys table (address removed - now stored in receiving_addresses)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS bitcoin_keys (
            id TEXT PRIMARY KEY,
            vault_id TEXT NOT NULL,
            key_type TEXT NOT NULL, -- 'legacy', 'segwit', 'native', 'multisig', 'taproot'
            network TEXT NOT NULL, -- 'mainnet', 'testnet', 'regtest'
            encrypted_private_key BLOB NOT NULL,
            public_key BLOB NOT NULL,
            derivation_path TEXT,
            entropy_source TEXT NOT NULL, -- 'system', 'quantum', 'quantum_enhanced', 'hardware'
            quantum_enhanced BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_used DATETIME,
            is_active BOOLEAN DEFAULT TRUE,
            FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
        )"
    )
    .execute(&pool)
    .await?;
    
    // Migration: Remove address column from bitcoin_keys if it exists
    let _ = sqlx::query("ALTER TABLE bitcoin_keys DROP COLUMN address")
        .execute(&pool)
        .await; // Ignore errors if column doesn't exist
    
    // Migration: Add password field to bitcoin_keys for password manager functionality
    let _ = sqlx::query("ALTER TABLE bitcoin_keys ADD COLUMN encryption_password TEXT")
        .execute(&pool)
        .await; // Ignore errors if column already exists
    
    // HD wallets table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS hd_wallets (
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
        )"
    )
    .execute(&pool)
    .await?;
    
    // Bitcoin key metadata
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS bitcoin_key_metadata (
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
        )"
    )
    .execute(&pool)
    .await?;
    
    // Receiving addresses for Bitcoin keys
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS receiving_addresses (
            id TEXT PRIMARY KEY,
            key_id TEXT NOT NULL,
            address TEXT NOT NULL UNIQUE,
            derivation_index INTEGER NOT NULL,
            label TEXT,
            is_used BOOLEAN DEFAULT FALSE,
            is_primary BOOLEAN DEFAULT FALSE,
            balance_satoshis INTEGER DEFAULT 0,
            transaction_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_used DATETIME,
            FOREIGN KEY (key_id) REFERENCES bitcoin_keys(id) ON DELETE CASCADE
        )"
    )
    .execute(&pool)
    .await?;
    
    // Migration: Add is_primary column to receiving_addresses if it doesn't exist
    let _ = sqlx::query("ALTER TABLE receiving_addresses ADD COLUMN is_primary BOOLEAN DEFAULT FALSE")
        .execute(&pool)
        .await; // Ignore errors if column already exists
    
    // Key backup logs for cold storage
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS key_backup_logs (
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
        )"
    )
    .execute(&pool)
    .await?;
    
    // USB drive trust levels table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS usb_drive_trust (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            drive_id TEXT NOT NULL,
            device_path TEXT NOT NULL,
            drive_label TEXT,
            trust_level TEXT NOT NULL DEFAULT 'untrusted',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE(user_id, drive_id)
        )"
    )
    .execute(&pool)
    .await?;
    
    // Ethereum keys table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS ethereum_keys (
            id TEXT PRIMARY KEY,
            vault_id TEXT NOT NULL,
            key_type TEXT NOT NULL, -- 'standard', 'hd_wallet'
            network TEXT NOT NULL, -- 'mainnet', 'sepolia', 'goerli'
            address TEXT NOT NULL UNIQUE,
            encrypted_private_key BLOB NOT NULL,
            public_key BLOB NOT NULL,
            derivation_path TEXT,
            entropy_source TEXT NOT NULL, -- 'system', 'quantum', 'quantum_enhanced', 'hardware'
            quantum_enhanced BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_used DATETIME,
            is_active BOOLEAN DEFAULT TRUE,
            encryption_password TEXT,
            FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
        )"
    )
    .execute(&pool)
    .await?;
    
    // Ethereum key metadata
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS ethereum_key_metadata (
            key_id TEXT PRIMARY KEY,
            label TEXT,
            description TEXT,
            tags TEXT, -- JSON array
            balance_wei TEXT DEFAULT '0', -- Store as string to handle large numbers
            transaction_count INTEGER DEFAULT 0,
            last_transaction DATETIME,
            backup_count INTEGER DEFAULT 0,
            last_backup DATETIME,
            FOREIGN KEY (key_id) REFERENCES ethereum_keys(id) ON DELETE CASCADE
        )"
    )
    .execute(&pool)
    .await?;
    
    // Ethereum transactions table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS ethereum_transactions (
            id TEXT PRIMARY KEY,
            key_id TEXT NOT NULL,
            transaction_hash TEXT NOT NULL UNIQUE,
            block_number INTEGER,
            transaction_index INTEGER,
            from_address TEXT NOT NULL,
            to_address TEXT,
            value_wei TEXT NOT NULL, -- Store as string to handle large numbers
            gas_price TEXT,
            gas_limit INTEGER,
            gas_used INTEGER,
            transaction_fee_wei TEXT,
            status TEXT NOT NULL, -- 'pending', 'confirmed', 'failed'
            transaction_type TEXT NOT NULL, -- 'send', 'receive', 'contract_call'
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            confirmed_at DATETIME,
            FOREIGN KEY (key_id) REFERENCES ethereum_keys(id) ON DELETE CASCADE
        )"
    )
    .execute(&pool)
    .await?;
    
    // Ethereum key backups table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS ethereum_key_backups (
            id TEXT PRIMARY KEY,
            key_id TEXT NOT NULL,
            backup_type TEXT NOT NULL, -- 'cold_storage', 'usb_drive', 'paper_wallet'
            backup_location TEXT NOT NULL,
            backup_data BLOB NOT NULL,
            encryption_method TEXT NOT NULL,
            checksum TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            verified_at DATETIME,
            is_verified BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (key_id) REFERENCES ethereum_keys(id) ON DELETE CASCADE
        )"
    )
    .execute(&pool)
    .await?;
    
    // Seed database with admin user and test data
    seed_database(&pool).await?;
    
    println!("Database initialized successfully!");
    Ok(pool)
}

async fn seed_database(pool: &SqlitePool) -> Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    
    // Check if admin user already exists
    let existing_admin = sqlx::query("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
        .fetch_optional(pool)
        .await?;
    
    if existing_admin.is_some() {
        println!("Admin user already exists, skipping seed");
        return Ok(());
    }
    
    // Create the single admin user - this is the only admin account allowed
    let admin_id = Uuid::new_v4().to_string();
    let (password_hash, salt) = hash_password("admin123")?;
    
    sqlx::query(
        "INSERT INTO users (id, username, email, password_hash, salt, role, is_active, mfa_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&admin_id)
    .bind("admin")
    .bind("admin@vault.local")
    .bind(&password_hash)
    .bind(&salt)
    .bind("admin")
    .bind(true)
    .bind(false)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await?;
    
    // Create default vault for admin (only admin gets a vault initially)
    let admin_vault_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO vaults (id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&admin_vault_id)
    .bind(&admin_id)
    .bind("default_vault")
    .bind("Default vault for secure storage")
    .bind("personal")
    .bind(false)
    .bind(true)
    .bind(false)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await?;
    
    println!("✅ Created default admin user:");
    println!("   Username: admin");
    println!("   Password: admin123");
    println!("   Email: admin@vault.local");
    println!("   Role: admin");
    println!("   Vault: default_vault (default)");
    println!("");
    println!("🔐 This is the ONLY admin account. Use these credentials to sign in.");
    
    Ok(())
}
