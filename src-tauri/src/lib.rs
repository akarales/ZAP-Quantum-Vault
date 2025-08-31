pub mod logging;
mod database;
mod state;
mod vault_service;
mod models;
mod commands;
mod vault_commands;
mod debug_commands;
mod utils;
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
mod vault_password_commands;
mod bitcoin_keys_clean;
use bitcoin_keys_clean as bitcoin_keys;
mod bitcoin_commands;
mod bitcoin_key_commands;

#[cfg(test)]
mod tests;

use crate::commands::{register_user, login_user, get_user_count, get_all_users, update_user_role, toggle_user_status, delete_user, clear_all_users};
use tauri::Manager;
use crate::cold_storage_commands::{detect_usb_drives, get_drive_details, set_drive_trust, create_vault_backup, list_backups, verify_backup, restore_vault_backup, eject_drive, generate_recovery_phrase, recover_from_phrase, mount_drive, unmount_drive, mount_encrypted_drive, mount_encrypted_drive_auto};
use crate::format_commands::format_and_encrypt_drive;
use crate::jwt_commands::{refresh_token, logout_user, validate_session, get_token_info};
use crate::usb_password_commands::{save_usb_drive_password, get_user_usb_drive_passwords, get_user_usb_drive_passwords_with_passwords, delete_usb_drive_password, update_usb_drive_password_hint};
use crate::vault_password_commands::{save_vault_password, get_vault_password, get_user_vault_passwords, delete_vault_password, update_vault_password_hint};
use crate::bitcoin_commands::{generate_bitcoin_key, generate_hd_wallet, list_bitcoin_keys, list_hd_wallets, derive_hd_key, export_keys_to_usb, get_key_backup_history, list_receiving_addresses, generate_receiving_address};
use crate::bitcoin_key_commands::{decrypt_private_key, get_bitcoin_key_details, update_bitcoin_key_metadata, delete_bitcoin_key};
use crate::commands::{create_vault, get_user_vaults, create_vault_item, get_vault_items, delete_vault, delete_vault_item, decrypt_vault_item, list_user_vaults};
use crate::vault_commands::{get_user_vaults_offline, create_vault_offline, get_vault_items_offline, get_vault_item_details_offline, create_vault_item_offline, soft_delete_vault_item, restore_vault_item, permanently_delete_vault_item, get_trash_items, empty_trash, get_vault_item_cold_storage_status, delete_vault_offline, delete_vault_item_offline, decrypt_vault_item_offline, get_vault_password_offline};
use crate::debug_commands::{debug_database_state, debug_vault_query};
use crate::logging::init_logger;
use crate::database::initialize_database_with_app_handle;
use crate::state::AppState;
// use crate::database::Database;
use crate::vault_service::VaultService;
use crate::quantum_crypto::QuantumCryptoManager;
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
                match initialize_database_with_app_handle(&handle).await {
                    Ok(db) => {
                        let db_arc: Arc<sqlx::SqlitePool> = Arc::new(db);
                        let vault_service = Arc::new(VaultService::new(db_arc.clone()));
                        let mut crypto_manager = QuantumCryptoManager::new();
                        if let Err(e) = crypto_manager.generate_keypairs() {
                            eprintln!("Warning: Failed to generate crypto keypairs: {}", e);
                        }
                        let crypto = Arc::new(crypto_manager);
                        
                        handle.manage(AppState {
                            db: db_arc,
                            vault_service,
                            crypto,
                            app_handle: handle.clone(),
                        });
                        println!("Application state initialized successfully");
                    }
                    Err(e) => {
                        eprintln!("Failed to initialize database: {}", e);
                        std::process::exit(1);
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Authentication Commands
            register_user,
            login_user,
            get_user_count,
            get_all_users,
            update_user_role,
            toggle_user_status,
            delete_user,
            clear_all_users,
            
            // Cold Storage Commands
            detect_usb_drives,
            get_drive_details,
            set_drive_trust,
            create_vault_backup,
            list_backups,
            verify_backup,
            restore_vault_backup,
            eject_drive,
            generate_recovery_phrase,
            recover_from_phrase,
            mount_drive,
            unmount_drive,
            mount_encrypted_drive,
            mount_encrypted_drive_auto,
            format_and_encrypt_drive,
            
            // USB Password Commands
            save_usb_drive_password,
            get_user_usb_drive_passwords,
            get_user_usb_drive_passwords_with_passwords,
            update_usb_drive_password_hint,
            
            // Vault Password Commands
            save_vault_password,
            get_vault_password,
            get_user_vault_passwords,
            delete_vault_password,
            update_vault_password_hint,
            
            // JWT Commands
            refresh_token,
            logout_user,
            validate_session,
            get_token_info,
            
            // Bitcoin Commands
            generate_bitcoin_key,
            generate_hd_wallet,
            list_bitcoin_keys,
            list_hd_wallets,
            derive_hd_key,
            export_keys_to_usb,
            get_key_backup_history,
            list_receiving_addresses,
            generate_receiving_address,
            
            // Bitcoin Key Commands
            decrypt_private_key,
            get_bitcoin_key_details,
            update_bitcoin_key_metadata,
            delete_bitcoin_key,
            
            // Vault Commands (Online)
            create_vault,
            get_user_vaults,
            create_vault_item,
            get_vault_items,
            delete_vault,
            delete_vault_item,
            decrypt_vault_item,
            list_user_vaults,
            
            // Vault Commands (Offline)
            get_user_vaults_offline,
            create_vault_offline,
            get_vault_items_offline,
            get_vault_item_details_offline,
            create_vault_item_offline,
            soft_delete_vault_item,
            restore_vault_item,
            permanently_delete_vault_item,
            get_trash_items,
            empty_trash,
            get_vault_item_cold_storage_status,
            delete_vault_offline,
            delete_vault_item_offline,
            decrypt_vault_item_offline,
            get_vault_password_offline,
            
            // Debug Commands
            debug_database_state,
            debug_vault_query
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
