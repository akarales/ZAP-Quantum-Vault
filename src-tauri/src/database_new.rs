use sqlx::{SqlitePool, migrate::MigrateDatabase, Sqlite};
use anyhow::Result;
use std::env;

pub async fn initialize_database() -> Result<SqlitePool> {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./vault.db".to_string());

    // Create database if it doesn't exist
    if !Sqlite::database_exists(&database_url).await.unwrap_or(false) {
        println!("Creating database {}", database_url);
        match Sqlite::create_database(&database_url).await {
            Ok(_) => println!("Database created successfully"),
            Err(error) => panic!("Error creating database: {}", error),
        }
    }

    // Connect to database
    let pool = SqlitePool::connect(&database_url).await?;

    // Run migrations
    sqlx::migrate!("../migrations").run(&pool).await?;

    println!("Database initialized and migrations applied successfully");
    Ok(pool)
}
