# Tauri v2 API Reference

## Path Management in Rust

### AppHandle Path Methods

In Tauri v2, path resolution requires an instance of `AppHandle`, `App`, or `Window`. The API has changed from v1.

#### Correct Usage in v2:

```rust
use tauri::Manager;

#[tauri::command]
async fn my_custom_command(app_handle: tauri::AppHandle) {
    // Get app data directory
    let app_data_dir = app_handle.path().app_data_dir()?;
    
    // Get other directories
    let app_dir = app_handle.path().app_dir()?;
    let config_dir = app_handle.path().config_dir()?;
    let cache_dir = app_handle.path().cache_dir()?;
    let home_dir = app_handle.path().home_dir()?;
}
```

#### In Setup Function:

```rust
tauri::Builder::default()
    .setup(|app| {
        let app_handle = app.handle();
        let app_data_dir = app_handle.path().app_data_dir()?;
        // Use the path...
        Ok(())
    })
```

### Available Path Methods

| Method | Description | Platform Behavior |
|--------|-------------|-------------------|
| `app_data_dir()` | App-specific data directory | Linux: `$XDG_DATA_HOME/{bundle_id}` or `$HOME/.local/share/{bundle_id}`<br>macOS: `$HOME/Library/Application Support/{bundle_id}`<br>Windows: `{FOLDERID_RoamingAppData}/{bundle_id}` |
| `app_config_dir()` | App-specific config directory | Linux: `$XDG_CONFIG_HOME/{bundle_id}` or `$HOME/.config/{bundle_id}`<br>macOS: `$HOME/Library/Application Support/{bundle_id}`<br>Windows: `{FOLDERID_RoamingAppData}/{bundle_id}` |
| `app_cache_dir()` | App-specific cache directory | Linux: `$XDG_CACHE_HOME/{bundle_id}` or `$HOME/.cache/{bundle_id}`<br>macOS: `$HOME/Library/Caches/{bundle_id}`<br>Windows: `{FOLDERID_LocalAppData}/{bundle_id}` |
| `app_log_dir()` | App-specific log directory | Platform-specific log directories |
| `data_dir()` | User data directory | Linux: `$XDG_DATA_HOME` or `$HOME/.local/share`<br>macOS: `$HOME/Library/Application Support`<br>Windows: `{FOLDERID_RoamingAppData}` |
| `config_dir()` | User config directory | Linux: `$XDG_CONFIG_HOME` or `$HOME/.config`<br>macOS: `$HOME/Library/Application Support`<br>Windows: `{FOLDERID_RoamingAppData}` |
| `cache_dir()` | User cache directory | Linux: `$XDG_CACHE_HOME` or `$HOME/.cache`<br>macOS: `$HOME/Library/Caches`<br>Windows: `{FOLDERID_LocalAppData}` |
| `home_dir()` | User home directory | Cross-platform home directory |
| `desktop_dir()` | User desktop directory | Cross-platform desktop directory |
| `document_dir()` | User documents directory | Cross-platform documents directory |
| `download_dir()` | User downloads directory | Cross-platform downloads directory |

### Database Path Best Practice

For SQLite databases in production Tauri apps:

```rust
use anyhow::Result;
use sqlx::{SqlitePool, migrate::MigrateDatabase, Sqlite};

pub async fn initialize_database_with_app_handle(app_handle: &tauri::AppHandle) -> Result<SqlitePool> {
    // Use Tauri's app data directory - the proper way for production apps
    let mut db_path = app_handle.path().app_data_dir()
        .map_err(|e| anyhow::anyhow!("Failed to get app data dir: {}", e))?;
    
    // Create the app data directory if it doesn't exist
    std::fs::create_dir_all(&db_path)?;
    
    // Add the database filename
    db_path.push("vault.db");
    
    let database_url = format!("sqlite:{}", db_path.display());
    
    // Create database if it doesn't exist
    if !Sqlite::database_exists(&database_url).await.unwrap_or(false) {
        Sqlite::create_database(&database_url).await?;
    }
    
    let pool = SqlitePool::connect(&database_url).await?;
    Ok(pool)
}
```

### Key Changes from v1 to v2

1. **No Direct Import**: Can't import path functions directly anymore
2. **Requires Instance**: Need `AppHandle`, `App`, or `Window` instance
3. **Method Chaining**: Use `.path().method_name()` pattern
4. **Error Handling**: Methods return `Result<PathBuf>` instead of `Option<PathBuf>`

### JavaScript/TypeScript API

```typescript
import { appDataDir, appConfigDir, appCacheDir } from '@tauri-apps/api/path';

// These are async functions
const dataDir = await appDataDir();
const configDir = await appConfigDir();
const cacheDir = await appCacheDir();
```

### Bundle Identifier

The `{bundle_id}` in paths comes from the `identifier` field in `tauri.conf.json`:

```json
{
  "identifier": "com.example.myapp"
}
```

This ensures your app's data is isolated from other applications.

## Common Patterns

### Database Initialization in Setup

```rust
tauri::Builder::default()
    .setup(|app| {
        let handle = app.handle().clone();
        tauri::async_runtime::block_on(async move {
            match initialize_database_with_app_handle(&handle).await {
                Ok(db) => {
                    // Store database in app state
                    handle.manage(AppState { db });
                }
                Err(e) => {
                    eprintln!("Failed to initialize database: {}", e);
                    std::process::exit(1);
                }
            }
        });
        Ok(())
    })
```

### Command with Path Access

```rust
#[tauri::command]
async fn save_file(app_handle: tauri::AppHandle, content: String) -> Result<String, String> {
    let mut file_path = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    file_path.push("data.txt");
    
    std::fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(file_path.to_string_lossy().to_string())
}
```

This reference covers the essential path management patterns for Tauri v2 applications.
