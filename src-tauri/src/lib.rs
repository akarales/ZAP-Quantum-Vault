pub mod commands;
pub mod crypto;
pub mod error;
pub mod models;

use commands::vault::VaultMutex;
use commands::keys::KeyStore;
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
        .invoke_handler(tauri::generate_handler![
            commands::vault::create_vault,
            commands::vault::unlock_vault,
            commands::vault::lock_vault,
            commands::keys::generate_key,
            commands::keys::list_keys,
            commands::keys::get_key_detail,
            commands::signing::sign_message,
            commands::signing::verify_message,
            commands::airgap::generate_qr,
            commands::airgap::parse_qr,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
