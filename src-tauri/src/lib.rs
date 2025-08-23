pub mod commands;
pub mod crypto;
pub mod database;
pub mod models;
pub mod state;

use crate::commands::{register_user, login_user, get_user_count, get_all_users, update_user_role, toggle_user_status, delete_user, clear_all_users, reset_user_password, update_admin_profile};
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
            get_all_users,
            update_user_role,
            toggle_user_status,
            delete_user,
            clear_all_users,
            reset_user_password,
            update_admin_profile
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
