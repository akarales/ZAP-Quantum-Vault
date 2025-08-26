use std::sync::Arc;
use sqlx::SqlitePool;
use crate::vault_service::VaultService;

pub struct AppState {
    pub db: Arc<SqlitePool>,
    pub vault_service: Arc<VaultService>,
}
