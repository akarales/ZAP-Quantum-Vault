pub mod logging;
mod database;
mod state;
mod vault_service;
mod models;
mod commands;
mod auth_middleware;
mod bitcoin_commands;
mod bitcoin_keys_clean;
mod ethereum_commands;
mod ethereum_keys;
mod cosmos_keys;
mod cosmos_commands;
mod zap_blockchain_keys;
mod zap_blockchain_commands;
mod cold_storage;
mod cold_storage_commands;
pub mod crypto;
mod debug_commands;
mod encryption;
mod error_handling;
mod format_commands;
mod validation;
mod jwt;
mod jwt_commands;
mod quantum_crypto;
mod usb_password_commands;
mod utils;
mod vault_commands;

#[cfg(test)]
mod tests;

// use crate::commands::{register_user, login_user, get_user_count, get_all_users, update_user_role, toggle_user_status, delete_user, clear_all_users};
use tauri::Manager;
use crate::cold_storage_commands::{detect_usb_drives, refresh_usb_drives, get_drive_details, set_drive_trust, create_backup, list_backups, eject_drive, mount_drive, unmount_drive, mount_encrypted_drive, mount_encrypted_drive_auto};
use crate::format_commands::format_and_encrypt_drive;
use crate::jwt_commands::{refresh_token, logout_user, validate_session, get_token_info};
use crate::vault_commands::{decrypt_vault_item_with_password, migrate_vault_item_to_real_encryption, create_vault_item_with_encryption};
use crate::usb_password_commands::{save_usb_drive_password, get_usb_drive_password, get_user_usb_drive_passwords, update_usb_drive_password_hint, get_all_trusted_drives, delete_trusted_drive};
use crate::bitcoin_commands::{generate_bitcoin_key, generate_hd_wallet, list_bitcoin_keys, list_hd_wallets, derive_hd_key, export_keys_to_usb, get_key_backup_history, list_receiving_addresses, generate_receiving_address, list_trashed_bitcoin_keys, restore_bitcoin_key, hard_delete_bitcoin_key, decrypt_private_key, get_bitcoin_key_details, delete_bitcoin_key, update_bitcoin_key_metadata};
use crate::ethereum_commands::{generate_ethereum_key, list_ethereum_keys, decrypt_ethereum_private_key, update_ethereum_key_metadata, trash_ethereum_key, restore_ethereum_key, get_ethereum_network_info, export_ethereum_keys_to_usb, get_ethereum_key_details};
use crate::cosmos_commands::{
    generate_cosmos_key, list_cosmos_keys, get_cosmos_key_by_id, decrypt_cosmos_key, 
    decrypt_cosmos_private_key, export_cosmos_key, trash_cosmos_key, restore_cosmos_key, 
    list_trashed_cosmos_keys, delete_cosmos_key_permanently
};
use crate::zap_blockchain_commands::{
    generate_zap_genesis_keyset, list_zap_blockchain_keys, get_zap_blockchain_key_by_id,
    delete_zap_blockchain_key, export_zap_genesis_config, get_zap_networks,
    list_trashed_zap_blockchain_keys, restore_zap_blockchain_key, permanently_delete_zap_blockchain_key,
    decrypt_zap_blockchain_private_key
};
// Vault commands temporarily disabled
// Offline vault commands temporarily disabled
use crate::logging::init_logger;
use crate::database::initialize_database_with_app_handle;
use crate::state::AppState;
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
                match initialize_database_with_app_handle(&handle).await {
                    Ok(db) => {
                        let db_arc: Arc<sqlx::SqlitePool> = Arc::new(db);
                        let vault_service = Arc::new(VaultService::new(db_arc.clone()));
                        
                        handle.manage(AppState {
                            db: db_arc,
                            vault_service,
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
            // register_user,
            // login_user,
            // get_user_count,
            // get_all_users,
            // update_user_role,
            // toggle_user_status,
            // delete_user,
            // clear_all_users,
            detect_usb_drives,
            refresh_usb_drives,
            get_drive_details,
            set_drive_trust,
            format_and_encrypt_drive,
            create_backup,
            list_backups,
            eject_drive,
            mount_drive,
            unmount_drive,
            mount_encrypted_drive,
            mount_encrypted_drive_auto,
            save_usb_drive_password,
            decrypt_vault_item_with_password,
            migrate_vault_item_to_real_encryption,
            create_vault_item_with_encryption,
            get_usb_drive_password,
            get_user_usb_drive_passwords,
            update_usb_drive_password_hint,
            get_all_trusted_drives,
            delete_trusted_drive,
            refresh_token,
            logout_user,
            validate_session,
            get_token_info,
            commands::register_user,
            commands::login_user,
            commands::get_user_count,
            commands::get_all_users,
            commands::update_user_role,
            commands::toggle_user_status,
            commands::delete_user,
            commands::clear_all_users,
            commands::reset_user_password,
            commands::update_admin_profile,
            commands::create_vault,
            commands::get_user_vaults,
            commands::create_vault_item,
            commands::get_vault_items,
            commands::delete_vault,
            commands::delete_vault_item,
            commands::decrypt_vault_item,
            commands::list_user_vaults,
            vault_commands::get_user_vaults_offline,
            vault_commands::create_vault_offline,
            vault_commands::get_vault_items_offline,
            vault_commands::get_vault_item_details_offline,
            vault_commands::create_vault_item_offline,
            vault_commands::delete_vault_offline,
            vault_commands::delete_vault_item_offline,
            vault_commands::decrypt_vault_item_offline,
            vault_commands::export_all_vault_data_for_backup,
            debug_commands::debug_database_state,
            debug_commands::debug_vault_query,
            generate_bitcoin_key,
            generate_hd_wallet,
            list_bitcoin_keys,
            list_hd_wallets,
            derive_hd_key,
            export_keys_to_usb,
            get_key_backup_history,
            decrypt_private_key,
            get_bitcoin_key_details,
            list_receiving_addresses,
            generate_receiving_address,
            delete_bitcoin_key,
            hard_delete_bitcoin_key,
            restore_bitcoin_key,
            update_bitcoin_key_metadata,
            list_trashed_bitcoin_keys,
            generate_ethereum_key,
            list_ethereum_keys,
            get_ethereum_key_details,
            decrypt_ethereum_private_key,
            update_ethereum_key_metadata,
            trash_ethereum_key,
            restore_ethereum_key,
            get_ethereum_network_info,
            export_ethereum_keys_to_usb,
            generate_cosmos_key,
            list_cosmos_keys,
            decrypt_cosmos_key,
            decrypt_cosmos_private_key,
            get_cosmos_key_by_id,
            export_cosmos_key,
            trash_cosmos_key,
            restore_cosmos_key,
            list_trashed_cosmos_keys,
            delete_cosmos_key_permanently,
            generate_zap_genesis_keyset,
            list_zap_blockchain_keys,
            get_zap_blockchain_key_by_id,
            delete_zap_blockchain_key,
            export_zap_genesis_config,
            get_zap_networks,
            list_trashed_zap_blockchain_keys,
            restore_zap_blockchain_key,
            permanently_delete_zap_blockchain_key,
            decrypt_zap_blockchain_private_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
