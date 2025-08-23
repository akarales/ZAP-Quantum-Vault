use std::sync::Arc;
use sqlx::SqlitePool;

pub struct AppState {
    pub db: Arc<SqlitePool>,
}
