pub mod commands;
pub mod crypto;
pub mod error;
pub mod models;

use commands::vault::{VaultMutex, UnlockState};
use commands::keys::{KeyStore, SessionKey};
use commands::airgap::SeenNonces;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .setup(|app| {
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path")
                .join("salt.txt");
            app.handle().plugin(
                tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build(),
            )?;
            Ok(())
        })
        .manage(VaultMutex(Mutex::new(models::vault::VaultState::default())))
        .manage(KeyStore(Mutex::new(Vec::new())))
        .manage(SessionKey(Mutex::new(None)))
        .manage(SeenNonces::default())
        .manage(UnlockState::default())
        .invoke_handler(tauri::generate_handler![
            commands::vault::vault_status,
            commands::vault::create_vault,
            commands::vault::unlock_vault,
            commands::vault::change_password,
            commands::vault::lock_vault,
            commands::vault::yubikey_status,
            commands::vault::enroll_yubikey,
            commands::vault::disable_yubikey,
            commands::yubikey::detect_yubikey,
            commands::keys::generate_key,
            commands::keys::list_keys,
            commands::keys::get_key_detail,
            commands::signing::sign_message,
            commands::signing::sign_message_with_key,
            commands::signing::verify_message,
            commands::airgap::generate_qr,
            commands::airgap::generate_qr_with_key,
            commands::airgap::parse_qr,
            commands::airgap::verify_qr,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
