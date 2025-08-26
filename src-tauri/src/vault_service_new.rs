use anyhow::Result;
use async_trait::async_trait;
use std::sync::Arc;
use sqlx::SqlitePool;
use crate::models::{User, Vault, CreateVaultRequest};
use crate::vault_access_control::{VaultAccessPolicy, VaultQueryPolicy, VaultRepository, CompositeAccessPolicy};
use log::{info, error};

/// Single Responsibility: Vault data access
pub struct SqliteVaultRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteVaultRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl VaultRepository for SqliteVaultRepository {
    async fn get_all_vaults(&self) -> Result<Vec<Vault>> {
        let rows = sqlx::query(
            "SELECT id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at 
             FROM vaults ORDER BY created_at DESC"
        )
        .fetch_all(&*self.pool)
        .await?;

        let mut vaults = Vec::new();
        for row in rows {
            vaults.push(Vault {
                id: row.get("id"),
                user_id: row.get("user_id"),
                name: row.get("name"),
                description: row.get("description"),
                vault_type: row.get("vault_type"),
                is_shared: row.get("is_shared"),
                is_default: row.get("is_default"),
                is_system_default: row.get("is_system_default"),
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("created_at"))?
                    .with_timezone(&chrono::Utc),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("updated_at"))?
                    .with_timezone(&chrono::Utc),
            });
        }
        Ok(vaults)
    }

    async fn get_vaults_by_user(&self, user_id: &str) -> Result<Vec<Vault>> {
        let rows = sqlx::query(
            "SELECT id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at 
             FROM vaults WHERE user_id = ? ORDER BY created_at DESC"
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await?;

        let mut vaults = Vec::new();
        for row in rows {
            vaults.push(Vault {
                id: row.get("id"),
                user_id: row.get("user_id"),
                name: row.get("name"),
                description: row.get("description"),
                vault_type: row.get("vault_type"),
                is_shared: row.get("is_shared"),
                is_default: row.get("is_default"),
                is_system_default: row.get("is_system_default"),
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("created_at"))?
                    .with_timezone(&chrono::Utc),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("updated_at"))?
                    .with_timezone(&chrono::Utc),
            });
        }
        Ok(vaults)
    }

    async fn get_vault_by_id(&self, vault_id: &str) -> Result<Option<Vault>> {
        let row = sqlx::query(
            "SELECT id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at 
             FROM vaults WHERE id = ?"
        )
        .bind(vault_id)
        .fetch_optional(&*self.pool)
        .await?;

        if let Some(row) = row {
            Ok(Some(Vault {
                id: row.get("id"),
                user_id: row.get("user_id"),
                name: row.get("name"),
                description: row.get("description"),
                vault_type: row.get("vault_type"),
                is_shared: row.get("is_shared"),
                is_default: row.get("is_default"),
                is_system_default: row.get("is_system_default"),
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("created_at"))?
                    .with_timezone(&chrono::Utc),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<String, _>("updated_at"))?
                    .with_timezone(&chrono::Utc),
            }))
        } else {
            Ok(None)
        }
    }

    async fn get_user_vault_permissions(&self, user_id: &str, vault_id: &str) -> Result<Vec<crate::vault_access_control::VaultPermission>> {
        // This would query a vault_permissions table in a full implementation
        // For now, return empty vec as permissions are handled by policies
        Ok(vec![])
    }
}

/// Single Responsibility: Vault business logic
pub struct VaultService {
    repository: Arc<dyn VaultRepository + Send + Sync>,
    access_policy: Arc<dyn VaultAccessPolicy + Send + Sync>,
    query_policy: Arc<dyn VaultQueryPolicy + Send + Sync>,
}

impl VaultService {
    pub fn new(
        repository: Arc<dyn VaultRepository + Send + Sync>,
        access_policy: Arc<dyn VaultAccessPolicy + Send + Sync>,
        query_policy: Arc<dyn VaultQueryPolicy + Send + Sync>,
    ) -> Self {
        Self {
            repository,
            access_policy,
            query_policy,
        }
    }

    pub fn new_with_defaults(pool: Arc<SqlitePool>) -> Self {
        let repository = Arc::new(SqliteVaultRepository::new(pool));
        let policy = Arc::new(CompositeAccessPolicy::new());
        
        Self {
            repository,
            access_policy: policy.clone(),
            query_policy: policy,
        }
    }

    /// Get vaults accessible to a user based on their role and permissions
    pub async fn get_user_accessible_vaults(&self, user: &User) -> Result<Vec<Vault>> {
        info!("🔍 Getting accessible vaults for user: {} (role: {})", user.username, user.role);

        // Admin/root users see all vaults
        if user.role == "admin" || user.role == "root" {
            info!("👑 Admin user - returning all vaults");
            return self.repository.get_all_vaults().await;
        }

        // Regular users see their own vaults + shared vaults they have access to
        let all_vaults = self.repository.get_all_vaults().await?;
        let mut accessible_vaults = Vec::new();

        for vault in all_vaults {
            if self.access_policy.can_access_vault(user, &vault).await? {
                accessible_vaults.push(vault);
            }
        }

        info!("📦 Found {} accessible vaults for user {}", accessible_vaults.len(), user.username);
        Ok(accessible_vaults)
    }

    /// Check if user can perform specific action on vault
    pub async fn can_user_perform_action(
        &self,
        user: &User,
        vault_id: &str,
        permission: crate::vault_access_control::VaultPermission,
    ) -> Result<bool> {
        if let Some(vault) = self.repository.get_vault_by_id(vault_id).await? {
            self.access_policy.can_perform_action(user, &vault, permission).await
        } else {
            Ok(false)
        }
    }

    /// Create vault with proper ownership
    pub async fn create_vault(&self, user: &User, request: CreateVaultRequest) -> Result<Vault> {
        // Implementation would create vault and set proper ownership
        // This is a placeholder for the actual implementation
        todo!("Implement vault creation with proper ownership")
    }
}

/// Factory for creating different user contexts
pub struct UserContextFactory;

impl UserContextFactory {
    /// Create default admin user for offline mode
    pub fn create_default_admin() -> User {
        User {
            id: "default_user".to_string(),
            username: "admin".to_string(),
            email: "admin@zapchat.org".to_string(),
            role: "admin".to_string(),
            is_active: true,
            mfa_enabled: false,
            last_login: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }
    }

    /// Create user from database row or token
    pub fn create_from_token(token_data: serde_json::Value) -> Result<User> {
        Ok(User {
            id: token_data["user_id"].as_str().unwrap_or("unknown").to_string(),
            username: token_data["username"].as_str().unwrap_or("unknown").to_string(),
            email: token_data["email"].as_str().unwrap_or("unknown@example.com").to_string(),
            role: token_data["role"].as_str().unwrap_or("user").to_string(),
            is_active: true,
            mfa_enabled: false,
            last_login: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }
}
