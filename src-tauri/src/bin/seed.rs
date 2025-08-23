use anyhow::Result;
use sqlx::SqlitePool;
use chrono::Utc;
use uuid::Uuid;

// Import crypto functions from the main crate
use zap_vault_lib::crypto::hash_password;

#[tokio::main]
async fn main() -> Result<()> {
    println!("🌱 ZAP Quantum Vault Database Seeder");
    println!("=====================================");
    
    // Use file:// protocol for SQLite to ensure file creation
    let database_url = "sqlite://vault.db".to_string();
    
    println!("📍 Database: {}", database_url);
    
    // Connect to database
    let pool = SqlitePool::connect(&database_url).await?;
    
    // Create tables if they don't exist
    create_tables(&pool).await?;
    
    // Seed admin user
    seed_admin_user(&pool).await?;
    
    println!("✅ Database seeding completed successfully!");
    
    Ok(())
}

async fn create_tables(pool: &SqlitePool) -> Result<()> {
    println!("📋 Creating tables...");
    
    // Create users table
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
    .execute(pool)
    .await?;
    
    // Create vaults table
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
    .execute(pool)
    .await?;
    
    println!("✅ Tables created successfully");
    Ok(())
}

async fn seed_admin_user(pool: &SqlitePool) -> Result<()> {
    println!("👤 Seeding admin user...");
    
    // Check if admin user already exists
    let admin_exists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users WHERE username = 'admin'"
    )
    .fetch_one(pool)
    .await?;
    
    if admin_exists > 0 {
        println!("⚠️  Admin user already exists, skipping...");
        return Ok(());
    }
    
    // Create admin user
    let admin_id = Uuid::new_v4().to_string();
    let username = "admin";
    let email = "admin@zapchat.org";
    let password = "admin123";
    
    let (password_hash, salt) = hash_password(password)?;
    let now = Utc::now();
    let created_at = now.to_rfc3339();
    let updated_at = created_at.clone();
    
    sqlx::query(
        "INSERT INTO users (id, username, email, password_hash, salt, role, is_active, mfa_enabled, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&admin_id)
    .bind(username)
    .bind(email)
    .bind(&password_hash)
    .bind(&salt)
    .bind("admin")
    .bind(true)
    .bind(false)
    .bind(&created_at)
    .bind(&updated_at)
    .execute(pool)
    .await?;
    
    println!("✅ Admin user created successfully!");
    println!();
    println!("🔑 Admin Credentials:");
    println!("   Username: {}", username);
    println!("   Email: {}", email);
    println!("   Password: {}", password);
    println!("   Role: admin");
    println!();
    println!("🚀 You can now login with these credentials!");
    
    Ok(())
}
