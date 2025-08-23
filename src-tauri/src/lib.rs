mod commands;
mod crypto;
mod database;
mod models;
mod state;

use crate::commands::{register_user, login_user, get_user_count, clear_all_users};
use crate::database::initialize_database;
use crate::state::AppState;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                match initialize_database().await {
                    Ok(db) => {
                        handle.manage(AppState {
                            db: Arc::new(db),
                        });
                        println!("Application state initialized successfully");
                    }
                    Err(e) => {
                        eprintln!("Failed to initialize database: {}", e);
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            register_user,
            login_user,
            get_user_count,
            clear_all_users
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
