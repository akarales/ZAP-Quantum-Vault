use std::sync::Arc;
use sqlx::SqlitePool;
use crate::vault_service::VaultService;
use crate::quantum_crypto::QuantumCryptoManager;
use tauri::AppHandle;

pub struct AppState {
    pub db: Arc<SqlitePool>,
    pub vault_service: Arc<VaultService>,
    pub crypto: Arc<QuantumCryptoManager>,
    pub app_handle: AppHandle,
}
