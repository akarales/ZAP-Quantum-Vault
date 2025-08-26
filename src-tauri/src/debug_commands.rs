use crate::state::AppState;
use tauri::State;
use sqlx::Row;
use log::{info, error};

#[tauri::command]
pub async fn debug_database_state(
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("🔍 debug_database_state: Starting database inspection...");
    let db = &*state.db;
    
    let mut debug_info = String::new();
    
    // Check users table
    let user_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(db)
        .await
        .map_err(|e| {
            error!("❌ Failed to count users: {}", e);
            e.to_string()
        })?;
    
    debug_info.push_str(&format!("👥 Users in database: {}\n", user_count));
    
    // Check vaults table
    let vault_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM vaults")
        .fetch_one(db)
        .await
        .map_err(|e| {
            error!("❌ Failed to count vaults: {}", e);
            e.to_string()
        })?;
    
    debug_info.push_str(&format!("📦 Vaults in database: {}\n", vault_count));
    
    // Get all vaults with details
    let vault_rows = sqlx::query(
        "SELECT id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at FROM vaults"
    )
    .fetch_all(db)
    .await
    .map_err(|e| {
        error!("❌ Failed to fetch vault details: {}", e);
        e.to_string()
    })?;
    
    debug_info.push_str("\n📁 Vault Details:\n");
    for (index, row) in vault_rows.iter().enumerate() {
        let id: String = row.get("id");
        let user_id: String = row.get("user_id");
        let name: String = row.get("name");
        let vault_type: String = row.get("vault_type");
        let is_default: bool = row.get("is_default");
        let is_system_default: bool = row.get("is_system_default");
        
        debug_info.push_str(&format!(
            "  {}. {} ({})\n     User: {}, Type: {}, Default: {}, System: {}\n",
            index + 1, name, id, user_id, vault_type, is_default, is_system_default
        ));
    }
    
    // Check vault items
    let item_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM vault_items")
        .fetch_one(db)
        .await
        .map_err(|e| {
            error!("❌ Failed to count vault items: {}", e);
            e.to_string()
        })?;
    
    debug_info.push_str(&format!("\n🔐 Vault items in database: {}\n", item_count));
    
    // Check bitcoin keys
    let bitcoin_key_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM bitcoin_keys")
        .fetch_one(db)
        .await
        .map_err(|e| {
            error!("❌ Failed to count bitcoin keys: {}", e);
            e.to_string()
        })?;
    
    debug_info.push_str(&format!("₿ Bitcoin keys in database: {}\n", bitcoin_key_count));
    
    info!("✅ debug_database_state: Database inspection complete");
    info!("Database state:\n{}", debug_info);
    
    Ok(debug_info)
}

#[tauri::command]
pub async fn debug_vault_query(
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("🔍 debug_vault_query: Testing vault query for default_user...");
    let db = &*state.db;
    
    let default_user_id = "default_user";
    
    // Test the exact query used in get_user_vaults_offline
    let rows = sqlx::query(
        "SELECT id, user_id, name, description, vault_type, is_shared, is_default, is_system_default, created_at, updated_at 
         FROM vaults WHERE user_id = ? ORDER BY created_at DESC"
    )
    .bind(default_user_id)
    .fetch_all(db)
    .await
    .map_err(|e| {
        error!("❌ Failed to fetch vaults for {}: {}", default_user_id, e);
        e.to_string()
    })?;
    
    let mut result = format!("Query result for user '{}': {} vaults found\n", default_user_id, rows.len());
    
    for (index, row) in rows.iter().enumerate() {
        let id: String = row.get("id");
        let name: String = row.get("name");
        let created_at: String = row.get("created_at");
        
        result.push_str(&format!("  {}. {} ({}) - Created: {}\n", index + 1, name, id, created_at));
    }
    
    info!("✅ debug_vault_query: Query test complete");
    info!("Query result:\n{}", result);
    
    Ok(result)
}
