use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub email: String,
    pub role: String,
    pub is_active: bool,
    pub mfa_enabled: bool,
    pub last_login: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub user: User,
    pub token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateVaultRequest {
    pub name: String,
    pub description: Option<String>,
    pub vault_type: String,
    pub is_shared: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Vault {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub description: Option<String>,
    pub vault_type: String,
    pub is_shared: bool,
    pub is_default: bool,
    pub is_system_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateVaultItemRequest {
    pub vault_id: String,
    pub item_type: String,
    pub title: String,
    pub data: String,
    pub metadata: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VaultItem {
    pub id: String,
    pub vault_id: String,
    pub item_type: String,
    pub title: String,
    pub encrypted_data: String,
    pub metadata: Option<String>,
    pub tags: Option<Vec<String>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VaultPermission {
    pub id: String,
    pub vault_id: String,
    pub user_id: String,
    pub permission_level: String,
    pub granted_by: String,
    pub created_at: DateTime<Utc>,
}
