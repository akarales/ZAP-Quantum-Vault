use anyhow::{Result, anyhow};
use sqlx::SqlitePool;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vault {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub description: Option<String>,
    pub vault_type: VaultType,
    pub is_shared: bool,
    pub is_default: bool,
    pub is_system_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VaultType {
    Personal,
    Shared,
    ColdStorage,
    Hardware,
}

impl Default for VaultType {
    fn default() -> Self {
        VaultType::Personal
    }
}

#[derive(Debug, Clone)]
pub struct VaultConfig {
    pub name: String,
    pub description: Option<String>,
    pub vault_type: VaultType,
    pub user_id: String,
}

pub struct VaultService {
    pool: Arc<SqlitePool>,
}

impl VaultService {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }

    /// Ensures a default vault exists and returns its ID
    pub async fn ensure_default_vault(&self) -> Result<String> {
        // First check for system default vault
        if let Some(vault) = self.find_system_default().await? {
            return Ok(vault.id);
        }

        // Check for user default vault
        if let Some(vault) = self.find_user_default("default_user").await? {
            return Ok(vault.id);
        }

        // Create system default vault
        self.create_system_default().await
    }

    /// Find system default vault (for offline mode)
    async fn find_system_default(&self) -> Result<Option<Vault>> {
        let row = sqlx::query!(
            "SELECT id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at 
             FROM vaults WHERE is_system_default = true LIMIT 1"
        )
        .fetch_optional(&*self.pool)
        .await?;

        match row {
            Some(r) => {
                let created_at = DateTime::parse_from_rfc3339(&r.created_at)
                    .map_err(|e| anyhow!("Invalid date format: {}", e))?
                    .with_timezone(&Utc);
                let updated_at = DateTime::parse_from_rfc3339(&r.updated_at)
                    .map_err(|e| anyhow!("Invalid date format: {}", e))?
                    .with_timezone(&Utc);
                
                Ok(Some(Vault {
                    id: r.id,
                    user_id: r.user_id,
                    name: r.name,
                    description: r.description,
                    vault_type: match r.vault_type.as_str() {
                        "shared" => VaultType::Shared,
                        "cold_storage" => VaultType::ColdStorage,
                        "hardware" => VaultType::Hardware,
                        _ => VaultType::Personal,
                    },
                    is_shared: r.is_shared != 0,
                    is_default: r.is_default != 0,
                    is_system_default: r.is_system_default != 0,
                    created_at,
                    updated_at,
                }))
            },
            None => Ok(None),
        }
    }

    /// Find user's default vault
    async fn find_user_default(&self, user_id: &str) -> Result<Option<Vault>> {
        let row = sqlx::query!(
            "SELECT id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at 
             FROM vaults WHERE user_id = ? AND is_default = true LIMIT 1",
            user_id
        )
        .fetch_optional(&*self.pool)
        .await?;

        match row {
            Some(r) => {
                let created_at = DateTime::parse_from_rfc3339(&r.created_at)
                    .map_err(|e| anyhow!("Invalid date format: {}", e))?
                    .with_timezone(&Utc);
                let updated_at = DateTime::parse_from_rfc3339(&r.updated_at)
                    .map_err(|e| anyhow!("Invalid date format: {}", e))?
                    .with_timezone(&Utc);
                
                Ok(Some(Vault {
                    id: r.id,
                    user_id: r.user_id,
                    name: r.name,
                    description: r.description,
                    vault_type: match r.vault_type.as_str() {
                        "shared" => VaultType::Shared,
                        "cold_storage" => VaultType::ColdStorage,
                        "hardware" => VaultType::Hardware,
                        _ => VaultType::Personal,
                    },
                    is_default: r.is_default != 0,
                    is_system_default: r.is_system_default != 0,
                    created_at,
                    updated_at,
                }))
            },
            None => Ok(None),
        }
    }

    /// Create system default vault for offline mode
    async fn create_system_default(&self) -> Result<String> {
        let vault_id = "default_vault";
        let user_id = "default_user";
        let now = Utc::now().to_rfc3339();

        // Ensure default user exists
        sqlx::query!(
            "INSERT OR IGNORE INTO users (id, username, email, password_hash, salt, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            user_id,
            "offline_user",
            "offline@vault.local",
            "offline_mode",
            "offline_salt",
            now,
            now
        )
        .execute(&*self.pool)
        .await?;

        // Create system default vault
        sqlx::query!(
            "INSERT OR REPLACE INTO vaults (id, user_id, name, description, vault_type, is_default, is_system_default, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            vault_id,
            user_id,
            "Default Vault",
            "System default vault for offline Bitcoin key storage",
            "personal",
            true,
            true,
            now,
            now
        )
        .execute(&*self.pool)
        .await?;

        Ok(vault_id.to_string())
    }

    /// Get vault by ID
    pub async fn get_vault_by_id(&self, vault_id: &str) -> Result<Option<Vault>> {
        let row = sqlx::query!(
            "SELECT id, user_id, name, description, vault_type, is_default, is_system_default, created_at, updated_at 
             FROM vaults WHERE id = ?",
            vault_id
        )
        .fetch_optional(&*self.pool)
        .await?;

        match row {
            Some(r) => {
                let created_at = DateTime::parse_from_rfc3339(&r.created_at)
                    .map_err(|e| anyhow!("Invalid date format: {}", e))?
                    .with_timezone(&Utc);
                let updated_at = DateTime::parse_from_rfc3339(&r.updated_at)
                    .map_err(|e| anyhow!("Invalid date format: {}", e))?
                    .with_timezone(&Utc);
                
                Ok(Some(Vault {
                    id: r.id,
                    user_id: r.user_id,
                    name: r.name,
                    description: r.description,
                    vault_type: match r.vault_type.as_str() {
                        "shared" => VaultType::Shared,
                        "cold_storage" => VaultType::ColdStorage,
                        "hardware" => VaultType::Hardware,
                        _ => VaultType::Personal,
                    },
                    is_default: r.is_default != 0,
                    is_system_default: r.is_system_default != 0,
                    created_at,
                    updated_at,
                }))
            },
            None => Ok(None),
        }
    }

    /// List all vaults for a user
    pub async fn list_vaults(&self, user_id: &str) -> Result<Vec<Vault>> {
        let rows = sqlx::query!(
            "SELECT id, user_id, name, description, vault_type, is_default, is_system_default, created_at, updated_at 
             FROM vaults WHERE user_id = ? OR is_system_default = true ORDER BY is_default DESC, created_at ASC",
            user_id
        )
        .fetch_all(&*self.pool)
        .await?;

        let mut vaults = Vec::new();
        for r in rows {
            let created_at = DateTime::parse_from_rfc3339(&r.created_at)
                .map_err(|e| anyhow!("Invalid date format: {}", e))?
                .with_timezone(&Utc);
            let updated_at = DateTime::parse_from_rfc3339(&r.updated_at)
                .map_err(|e| anyhow!("Invalid date format: {}", e))?
                .with_timezone(&Utc);
            
            vaults.push(Vault {
                id: r.id,
                user_id: r.user_id,
                name: r.name,
                description: r.description,
                vault_type: match r.vault_type.as_str() {
                    "shared" => VaultType::Shared,
                    "cold_storage" => VaultType::ColdStorage,
                    "hardware" => VaultType::Hardware,
                    _ => VaultType::Personal,
                },
                is_default: r.is_default != 0,
                is_system_default: r.is_system_default != 0,
                created_at,
                updated_at,
            });
        }

        Ok(vaults)
    }

    /// Create a new vault
    pub async fn create_vault(&self, config: VaultConfig) -> Result<Vault> {
        let vault_id = Uuid::new_v4().to_string();
        let now = Utc::now();
        let now_str = now.to_rfc3339();

        let vault_type_str = match config.vault_type {
            VaultType::Personal => "personal",
            VaultType::Shared => "shared",
            VaultType::ColdStorage => "cold_storage",
            VaultType::Hardware => "hardware",
        };

        sqlx::query!(
            "INSERT INTO vaults (id, user_id, name, description, vault_type, is_default, is_system_default, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            vault_id,
            config.user_id,
            config.name,
            config.description,
            vault_type_str,
            false,
            false,
            now_str,
            now_str
        )
        .execute(&*self.pool)
        .await?;

        Ok(Vault {
            id: vault_id,
            user_id: config.user_id,
            name: config.name,
            description: config.description,
            vault_type: config.vault_type,
            is_default: false,
            is_system_default: false,
            created_at: now,
            updated_at: now,
        })
    }

    /// Set a vault as the default for a user
    pub async fn set_default_vault(&self, vault_id: &str, user_id: &str) -> Result<()> {
        // First, unset any existing default for this user
        sqlx::query!(
            "UPDATE vaults SET is_default = false WHERE user_id = ? AND is_default = true",
            user_id
        )
        .execute(&*self.pool)
        .await?;

        // Set the new default
        sqlx::query!(
            "UPDATE vaults SET is_default = true, updated_at = ? WHERE id = ? AND user_id = ?",
            Utc::now().to_rfc3339(),
            vault_id,
            user_id
        )
        .execute(&*self.pool)
        .await?;

        Ok(())
    }
}
