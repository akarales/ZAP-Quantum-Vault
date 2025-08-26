use anyhow::Result;
use async_trait::async_trait;
use crate::models::{User, Vault, VaultPermission};

/// Single Responsibility: Define user roles and permissions
#[derive(Debug, Clone, PartialEq)]
pub enum UserRole {
    Admin,
    User,
    Guest,
}

#[derive(Debug, Clone, PartialEq)]
pub enum VaultPermission {
    Read,
    Write,
    Delete,
    Share,
    Admin,
}

/// Interface Segregation: Separate interfaces for different access patterns
#[async_trait]
pub trait VaultAccessPolicy {
    async fn can_access_vault(&self, user: &User, vault: &Vault) -> Result<bool>;
    async fn get_user_permissions(&self, user: &User, vault: &Vault) -> Result<Vec<VaultPermission>>;
    async fn can_perform_action(&self, user: &User, vault: &Vault, permission: VaultPermission) -> Result<bool>;
}

#[async_trait]
pub trait VaultQueryPolicy {
    async fn get_accessible_vaults(&self, user: &User) -> Result<Vec<String>>; // Returns vault IDs
    async fn should_include_vault(&self, user: &User, vault: &Vault) -> Result<bool>;
}

/// Dependency Inversion: Abstract repository interface
#[async_trait]
pub trait VaultRepository {
    async fn get_all_vaults(&self) -> Result<Vec<Vault>>;
    async fn get_vaults_by_user(&self, user_id: &str) -> Result<Vec<Vault>>;
    async fn get_vault_by_id(&self, vault_id: &str) -> Result<Option<Vault>>;
    async fn get_user_vault_permissions(&self, user_id: &str, vault_id: &str) -> Result<Vec<VaultPermission>>;
}

/// Open/Closed: Extensible access policies
pub struct AdminAccessPolicy;

#[async_trait]
impl VaultAccessPolicy for AdminAccessPolicy {
    async fn can_access_vault(&self, user: &User, _vault: &Vault) -> Result<bool> {
        Ok(user.role == "admin" || user.role == "root")
    }

    async fn get_user_permissions(&self, user: &User, _vault: &Vault) -> Result<Vec<VaultPermission>> {
        if user.role == "admin" || user.role == "root" {
            Ok(vec![
                VaultPermission::Read,
                VaultPermission::Write,
                VaultPermission::Delete,
                VaultPermission::Share,
                VaultPermission::Admin,
            ])
        } else {
            Ok(vec![])
        }
    }

    async fn can_perform_action(&self, user: &User, vault: &Vault, permission: VaultPermission) -> Result<bool> {
        if user.role == "admin" || user.role == "root" {
            Ok(true)
        } else {
            self.can_access_vault(user, vault).await
        }
    }
}

#[async_trait]
impl VaultQueryPolicy for AdminAccessPolicy {
    async fn get_accessible_vaults(&self, user: &User) -> Result<Vec<String>> {
        if user.role == "admin" || user.role == "root" {
            // Admin can see all vaults - return empty vec to indicate "all"
            Ok(vec![])
        } else {
            // Regular users only see their own vaults
            Ok(vec![user.id.clone()])
        }
    }

    async fn should_include_vault(&self, user: &User, _vault: &Vault) -> Result<bool> {
        // Admin sees all vaults
        Ok(user.role == "admin" || user.role == "root")
    }
}

pub struct OwnerAccessPolicy;

#[async_trait]
impl VaultAccessPolicy for OwnerAccessPolicy {
    async fn can_access_vault(&self, user: &User, vault: &Vault) -> Result<bool> {
        Ok(vault.user_id == user.id || vault.is_shared)
    }

    async fn get_user_permissions(&self, user: &User, vault: &Vault) -> Result<Vec<VaultPermission>> {
        if vault.user_id == user.id {
            Ok(vec![
                VaultPermission::Read,
                VaultPermission::Write,
                VaultPermission::Delete,
                VaultPermission::Share,
            ])
        } else if vault.is_shared {
            Ok(vec![VaultPermission::Read])
        } else {
            Ok(vec![])
        }
    }

    async fn can_perform_action(&self, user: &User, vault: &Vault, permission: VaultPermission) -> Result<bool> {
        let permissions = self.get_user_permissions(user, vault).await?;
        Ok(permissions.contains(&permission))
    }
}

#[async_trait]
impl VaultQueryPolicy for OwnerAccessPolicy {
    async fn get_accessible_vaults(&self, user: &User) -> Result<Vec<String>> {
        Ok(vec![user.id.clone()])
    }

    async fn should_include_vault(&self, user: &User, vault: &Vault) -> Result<bool> {
        Ok(vault.user_id == user.id || vault.is_shared)
    }
}

/// Liskov Substitution: Composable access control
pub struct CompositeAccessPolicy {
    policies: Vec<Box<dyn VaultAccessPolicy + Send + Sync>>,
}

impl CompositeAccessPolicy {
    pub fn new() -> Self {
        Self {
            policies: vec![
                Box::new(AdminAccessPolicy),
                Box::new(OwnerAccessPolicy),
            ],
        }
    }

    pub fn add_policy(&mut self, policy: Box<dyn VaultAccessPolicy + Send + Sync>) {
        self.policies.push(policy);
    }
}

#[async_trait]
impl VaultAccessPolicy for CompositeAccessPolicy {
    async fn can_access_vault(&self, user: &User, vault: &Vault) -> Result<bool> {
        for policy in &self.policies {
            if policy.can_access_vault(user, vault).await? {
                return Ok(true);
            }
        }
        Ok(false)
    }

    async fn get_user_permissions(&self, user: &User, vault: &Vault) -> Result<Vec<VaultPermission>> {
        let mut all_permissions = Vec::new();
        for policy in &self.policies {
            let permissions = policy.get_user_permissions(user, vault).await?;
            all_permissions.extend(permissions);
        }
        all_permissions.dedup();
        Ok(all_permissions)
    }

    async fn can_perform_action(&self, user: &User, vault: &Vault, permission: VaultPermission) -> Result<bool> {
        for policy in &self.policies {
            if policy.can_perform_action(user, vault, permission.clone()).await? {
                return Ok(true);
            }
        }
        Ok(false)
    }
}
