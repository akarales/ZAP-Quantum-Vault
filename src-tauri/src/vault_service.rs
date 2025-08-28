use anyhow::Result;
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
        // Check for any existing vault (admin vault should exist)
        if let Some(vault) = self.find_any_vault().await? {
            return Ok(vault.id);
        }

        // This should not happen in normal operation since admin vault is created during seed
        Err(anyhow::anyhow!("No vault found - database may not be properly initialized"))
    }

    /// Find system default vault (for offline mode)
    async fn find_system_default(&self) -> Result<Option<Vault>> {
        let row = sqlx::query(
            "SELECT id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at 
             FROM vaults WHERE is_system_default = true LIMIT 1"
        )
        .fetch_optional(&*self.pool)
        .await?;

        match row {
            Some(r) => {
                use sqlx::Row;
                let created_at = r.get::<chrono::NaiveDateTime, _>("created_at").and_utc();
                let updated_at = r.get::<chrono::NaiveDateTime, _>("updated_at").and_utc();
                
                Ok(Some(Vault {
                    id: r.get::<String, _>("id"),
                    user_id: r.get::<String, _>("user_id"),
                    name: r.get::<String, _>("name"),
                    description: r.get::<Option<String>, _>("description"),
                    vault_type: match r.get::<String, _>("vault_type").as_str() {
                        "shared" => VaultType::Shared,
                        "cold_storage" => VaultType::ColdStorage,
                        "hardware" => VaultType::Hardware,
                        _ => VaultType::Personal,
                    },
                    is_shared: r.get::<bool, _>("is_shared"),
                    is_default: r.get::<bool, _>("is_default"),
                    is_system_default: r.get::<bool, _>("is_system_default"),
                    created_at,
                    updated_at,
                }))
            },
            None => Ok(None),
        }
    }

    /// Find any existing vault
    async fn find_any_vault(&self) -> Result<Option<Vault>> {
        let row = sqlx::query(
            "SELECT id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at 
             FROM vaults ORDER BY is_default DESC, created_at ASC LIMIT 1"
        )
        .fetch_optional(&*self.pool)
        .await?;

        match row {
            Some(r) => {
                use sqlx::Row;
                let created_at = r.get::<chrono::NaiveDateTime, _>("created_at").and_utc();
                let updated_at = r.get::<chrono::NaiveDateTime, _>("updated_at").and_utc();
                
                Ok(Some(Vault {
                    id: r.get::<String, _>("id"),
                    user_id: r.get::<String, _>("user_id"),
                    name: r.get::<String, _>("name"),
                    description: r.get::<Option<String>, _>("description"),
                    vault_type: match r.get::<String, _>("vault_type").as_str() {
                        "shared" => VaultType::Shared,
                        "cold_storage" => VaultType::ColdStorage,
                        "hardware" => VaultType::Hardware,
                        _ => VaultType::Personal,
                    },
                    is_shared: r.get::<bool, _>("is_shared"),
                    is_default: r.get::<bool, _>("is_default"),
                    is_system_default: r.get::<bool, _>("is_system_default"),
                    created_at,
                    updated_at,
                }))
            },
            None => Ok(None),
        }
    }

    /// Find user's default vault
    async fn find_user_default(&self, user_id: &str) -> Result<Option<Vault>> {
        let row = sqlx::query(
            "SELECT id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at 
             FROM vaults WHERE user_id = ? AND is_default = true LIMIT 1"
        )
        .bind(user_id)
        .fetch_optional(&*self.pool)
        .await?;

        match row {
            Some(r) => {
                use sqlx::Row;
                let created_at = r.get::<chrono::NaiveDateTime, _>("created_at").and_utc();
                let updated_at = r.get::<chrono::NaiveDateTime, _>("updated_at").and_utc();
                
                Ok(Some(Vault {
                    id: r.get::<String, _>("id"),
                    user_id: r.get::<String, _>("user_id"),
                    name: r.get::<String, _>("name"),
                    description: r.get::<Option<String>, _>("description"),
                    vault_type: match r.get::<String, _>("vault_type").as_str() {
                        "shared" => VaultType::Shared,
                        "cold_storage" => VaultType::ColdStorage,
                        "hardware" => VaultType::Hardware,
                        _ => VaultType::Personal,
                    },
                    is_shared: r.get::<bool, _>("is_shared"),
                    is_default: r.get::<bool, _>("is_default"),
                    is_system_default: r.get::<bool, _>("is_system_default"),
                    created_at,
                    updated_at,
                }))
            },
            None => Ok(None),
        }
    }

    /// Create system default vault for offline mode
    async fn create_system_default(&self) -> Result<String> {
        let vault_id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().naive_utc();
        
        sqlx::query(
            "INSERT OR REPLACE INTO vaults (id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&vault_id)
        .bind("system")
        .bind("system_default")
        .bind("System default vault for offline mode")
        .bind("system")
        .bind(false)
        .bind(false)
        .bind(true)
        .bind(now)
        .bind(now)
        .execute(&*self.pool)
        .await?;

        Ok(vault_id)
    }

    /// Get vault by ID
    async fn get_vault(&self, vault_id: &str) -> Result<Option<Vault>> {
        let row = sqlx::query(
            "SELECT id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at 
             FROM vaults WHERE id = ?"
        )
        .bind(vault_id)
        .fetch_optional(&*self.pool)
        .await?;

        match row {
            Some(r) => {
                use sqlx::Row;
                let created_at = r.get::<chrono::NaiveDateTime, _>("created_at").and_utc();
                let updated_at = r.get::<chrono::NaiveDateTime, _>("updated_at").and_utc();
                
                Ok(Some(Vault {
                    id: r.get::<String, _>("id"),
                    user_id: r.get::<String, _>("user_id"),
                    name: r.get::<String, _>("name"),
                    description: r.get::<Option<String>, _>("description"),
                    vault_type: match r.get::<String, _>("vault_type").as_str() {
                        "shared" => VaultType::Shared,
                        "cold_storage" => VaultType::ColdStorage,
                        "hardware" => VaultType::Hardware,
                        _ => VaultType::Personal,
                    },
                    is_shared: r.get::<bool, _>("is_shared"),
                    is_default: r.get::<bool, _>("is_default"),
                    is_system_default: r.get::<bool, _>("is_system_default"),
                    created_at,
                    updated_at,
                }))
            },
            None => Ok(None),
        }
    }

    /// List all vaults for a user
    pub async fn list_vaults(&self, user_id: &str) -> Result<Vec<Vault>> {
        let rows = sqlx::query(
            "SELECT id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at 
             FROM vaults WHERE user_id = ? OR is_system_default = true ORDER BY is_default DESC, created_at ASC"
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await?;

        let mut vaults = Vec::new();
        for r in rows {
            use sqlx::Row;
            let created_at = r.get::<chrono::NaiveDateTime, _>("created_at").and_utc();
            let updated_at = r.get::<chrono::NaiveDateTime, _>("updated_at").and_utc();
            
            vaults.push(Vault {
                id: r.get::<String, _>("id"),
                user_id: r.get::<String, _>("user_id"),
                name: r.get::<String, _>("name"),
                description: r.get::<Option<String>, _>("description"),
                vault_type: match r.get::<String, _>("vault_type").as_str() {
                    "shared" => VaultType::Shared,
                    "cold_storage" => VaultType::ColdStorage,
                    "hardware" => VaultType::Hardware,
                    _ => VaultType::Personal,
                },
                is_shared: r.get::<bool, _>("is_shared"),
                is_default: r.get::<bool, _>("is_default"),
                is_system_default: r.get::<bool, _>("is_system_default"),
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
        let now_naive = now.naive_utc();

        let vault_type_str = match config.vault_type {
            VaultType::Personal => "personal",
            VaultType::Shared => "shared",
            VaultType::ColdStorage => "cold_storage",
            VaultType::Hardware => "hardware",
        };

        sqlx::query(
            "INSERT INTO vaults (id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&vault_id)
        .bind(&config.user_id)
        .bind(&config.name)
        .bind(&config.description)
        .bind(&vault_type_str)
        .bind(false)
        .bind(false)
        .bind(false)
        .bind(now_naive)
        .bind(now_naive)
        .execute(&*self.pool)
        .await?;

        Ok(Vault {
            id: vault_id,
            user_id: config.user_id,
            name: config.name,
            description: config.description,
            vault_type: config.vault_type,
            is_shared: false,
            is_default: false,
            is_system_default: false,
            created_at: now,
            updated_at: now,
        })
    }

    /// Set a vault as the default for a user
    pub async fn set_default_vault(&self, vault_id: &str, user_id: &str) -> Result<()> {
        // First, unset any existing default for this user
        sqlx::query(
            "UPDATE vaults SET is_default = false WHERE user_id = ? AND is_default = true"
        )
        .bind(user_id)
        .execute(&*self.pool)
        .await?;

        // Set the new default
        let now = Utc::now().naive_utc();
        sqlx::query(
            "UPDATE vaults SET is_default = true, updated_at = ? WHERE id = ? AND user_id = ?"
        )
        .bind(now)
        .bind(vault_id)
        .bind(user_id)
        .execute(&*self.pool)
        .await?;

        Ok(())
    }

    /// Get vault by ID (public wrapper)
    pub async fn get_vault_by_id(&self, vault_id: &str) -> Result<Option<Vault>> {
        self.get_vault(vault_id).await
    }

    /// Get vault by name or ID
    pub async fn get_vault_by_name_or_id(&self, identifier: &str) -> Result<Option<Vault>> {
        // First try by ID
        if let Some(vault) = self.get_vault(identifier).await? {
            return Ok(Some(vault));
        }

        // Then try by name
        let row = sqlx::query(
            "SELECT id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at 
             FROM vaults WHERE name = ?"
        )
        .bind(identifier)
        .fetch_optional(&*self.pool)
        .await?;

        match row {
            Some(r) => {
                use sqlx::Row;
                let created_at = r.get::<chrono::NaiveDateTime, _>("created_at").and_utc();
                let updated_at = r.get::<chrono::NaiveDateTime, _>("updated_at").and_utc();
                
                Ok(Some(Vault {
                    id: r.get::<String, _>("id"),
                    user_id: r.get::<String, _>("user_id"),
                    name: r.get::<String, _>("name"),
                    description: r.get::<Option<String>, _>("description"),
                    vault_type: match r.get::<String, _>("vault_type").as_str() {
                        "shared" => VaultType::Shared,
                        "cold_storage" => VaultType::ColdStorage,
                        "hardware" => VaultType::Hardware,
                        _ => VaultType::Personal,
                    },
                    is_shared: r.get::<bool, _>("is_shared"),
                    is_default: r.get::<bool, _>("is_default"),
                    is_system_default: r.get::<bool, _>("is_system_default"),
                    created_at,
                    updated_at,
                }))
            },
            None => Ok(None),
        }
    }
}
