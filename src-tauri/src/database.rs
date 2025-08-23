use anyhow::Result;
use sqlx::SqlitePool;
use std::env;

pub async fn initialize_database() -> Result<SqlitePool> {
    // Get current working directory and create database path
    let current_dir = env::current_dir()?;
    let db_path = current_dir.join("vault.db");
    let database_url = format!("sqlite:{}", db_path.display());
    println!("Database URL: {}", database_url);
    
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
            encrypted_data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )"
    )
    .execute(&pool)
    .await?;
    
    println!("Database initialized successfully!");
    Ok(pool)
}
