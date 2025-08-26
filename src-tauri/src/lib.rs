pub mod logging;
mod database;
mod database_new;
mod state;
mod vault_service;
pub mod crypto;
mod cold_storage;
mod cold_storage_commands;
mod quantum_crypto;
mod jwt;
mod jwt_commands;
mod auth_middleware;
mod error_handling;
mod format_commands;
mod usb_password_commands;
mod bitcoin_keys_clean;
use bitcoin_keys_clean as bitcoin_keys;
mod bitcoin_commands;
mod bitcoin_key_commands;

#[cfg(test)]
mod tests;

// use crate::commands::{register_user, login_user, get_user_count, get_all_users, update_user_role, toggle_user_status, delete_user, clear_all_users};
use tauri::Manager;
use crate::cold_storage_commands::{detect_usb_drives, get_drive_details, set_drive_trust, create_backup, list_backups, eject_drive, generate_recovery_phrase, mount_drive, unmount_drive, mount_encrypted_drive, mount_encrypted_drive_auto};
use crate::format_commands::format_and_encrypt_drive;
use crate::jwt_commands::{refresh_token, logout_user, validate_session, get_token_info};
use crate::usb_password_commands::{save_usb_drive_password, get_usb_drive_password, get_user_usb_drive_passwords, delete_usb_drive_password, update_usb_drive_password_hint};
use crate::bitcoin_commands::{generate_bitcoin_key, generate_hd_wallet, list_bitcoin_keys, list_hd_wallets, derive_hd_key, export_keys_to_usb, get_key_backup_history};
use crate::bitcoin_key_commands::{decrypt_private_key, get_bitcoin_key_details, update_bitcoin_key_metadata, delete_bitcoin_key};
use crate::logging::init_logger;
use crate::database_new::initialize_database;
use crate::state::AppState;
// use crate::database::Database;
use crate::vault_service::VaultService;
use std::sync::Arc;
use dotenv::dotenv;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenv().ok();
    tauri::Builder::default()
        .setup(|app| {
            // Initialize logger first
            let _logger = init_logger();
            
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                match initialize_database().await {
                    Ok(db) => {
                        let db_arc = Arc::new(db);
                        let vault_service = Arc::new(VaultService::new(db_arc.clone()));
                        
                        handle.manage(AppState {
                            db: db_arc,
                            vault_service,
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
            // register_user,
            // login_user,
            // get_user_count,
            // get_all_users,
            // update_user_role,
            // toggle_user_status,
            // delete_user,
            // clear_all_users,
            detect_usb_drives,
            get_drive_details,
            set_drive_trust,
            format_and_encrypt_drive,
            create_backup,
            list_backups,
            eject_drive,
            generate_recovery_phrase,
            mount_drive,
            unmount_drive,
            mount_encrypted_drive,
            mount_encrypted_drive_auto,
            save_usb_drive_password,
            get_usb_drive_password,
            get_user_usb_drive_passwords,
            delete_usb_drive_password,
            update_usb_drive_password_hint,
            refresh_token,
            logout_user,
            validate_session,
            get_token_info,
            generate_bitcoin_key,
            generate_hd_wallet,
            list_bitcoin_keys,
            list_hd_wallets,
            derive_hd_key,
            export_keys_to_usb,
            get_key_backup_history,
            decrypt_private_key,
            get_bitcoin_key_details,
            update_bitcoin_key_metadata,
            delete_bitcoin_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
