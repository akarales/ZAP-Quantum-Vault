pub mod commands;
pub mod crypto;
mod database;
mod models;
mod state;
mod cold_storage;
mod cold_storage_commands;
mod quantum_crypto;
mod jwt;
mod auth_middleware;
mod jwt_commands;
mod error_handling;
mod format_commands;
mod usb_password_commands;

#[cfg(test)]
mod tests;

use crate::commands::{register_user, login_user, get_user_count, get_all_users, update_user_role, toggle_user_status, delete_user, clear_all_users, reset_user_password, update_admin_profile, create_vault, get_user_vaults, create_vault_item, get_vault_items, decrypt_vault_item, delete_vault, delete_vault_item};
use crate::cold_storage_commands::{detect_usb_drives, get_drive_details, set_drive_trust, create_backup, list_backups, eject_drive, generate_recovery_phrase, mount_drive, unmount_drive, mount_encrypted_drive, mount_encrypted_drive_auto};
use crate::format_commands::format_and_encrypt_drive;
use crate::jwt_commands::{refresh_token, logout_user, validate_session, get_token_info};
use crate::usb_password_commands::{save_usb_drive_password, get_usb_drive_password, get_user_usb_drive_passwords, delete_usb_drive_password, update_usb_drive_password_hint};
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
            update_admin_profile,
            create_vault,
            get_user_vaults,
            create_vault_item,
            get_vault_items,
            decrypt_vault_item,
            delete_vault,
            delete_vault_item,
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
            get_token_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
