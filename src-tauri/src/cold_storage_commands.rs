use crate::cold_storage::{ColdStorageManager, UsbDrive, BackupRequest, RestoreRequest, BackupMetadata, TrustLevel};
use std::sync::Mutex;

// Global cold storage manager
lazy_static::lazy_static! {
    static ref COLD_STORAGE: Mutex<ColdStorageManager> = Mutex::new(ColdStorageManager::new());
}

#[tauri::command]
pub async fn detect_usb_drives() -> Result<Vec<UsbDrive>, String> {
    let mut manager = COLD_STORAGE.lock().map_err(|e| e.to_string())?;
    manager.detect_usb_drives().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_drive_trust(drive_id: String, trust_level: String) -> Result<String, String> {
    let trust = match trust_level.as_str() {
        "trusted" => TrustLevel::Trusted,
        "untrusted" => TrustLevel::Untrusted,
        "blocked" => TrustLevel::Blocked,
        _ => return Err("Invalid trust level".to_string()),
    };

    let mut manager = COLD_STORAGE.lock().map_err(|e| e.to_string())?;
    manager.set_drive_trust(&drive_id, trust).map_err(|e| e.to_string())?;
    
    Ok("Trust level updated successfully".to_string())
}

#[tauri::command]
pub async fn create_backup(request: BackupRequest) -> Result<String, String> {
    let mut manager = COLD_STORAGE.lock().map_err(|e| e.to_string())?;
    manager.create_backup(&request.drive_id, &[], "").map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_backups(drive_id: String) -> Result<Vec<BackupMetadata>, String> {
    let manager = COLD_STORAGE.lock().map_err(|e| e.to_string())?;
    manager.list_backups(&drive_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn verify_backup(backup_id: String) -> Result<bool, String> {
    let manager = COLD_STORAGE.lock().map_err(|e| e.to_string())?;
    manager.verify_backup(&backup_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restore_backup(request: RestoreRequest) -> Result<String, String> {
    let manager = COLD_STORAGE.lock().map_err(|e| e.to_string())?;
    manager.restore_backup(request).map_err(|e| e.to_string())?;
    Ok("Backup restored successfully".to_string())
}

#[tauri::command]
pub async fn format_drive(
    drive_id: String, 
    encryption_type: String, 
    password: String
) -> Result<String, String> {
    let manager = COLD_STORAGE.lock().map_err(|e| e.to_string())?;
    manager.format_drive(&drive_id, &encryption_type, &password)
        .map_err(|e| e.to_string())?;
    Ok("Drive formatted and encrypted successfully".to_string())
}

#[tauri::command]
pub async fn eject_drive(drive_id: String) -> Result<String, String> {
    let manager = COLD_STORAGE.lock().map_err(|e| e.to_string())?;
    manager.eject_drive(&drive_id).map_err(|e| e.to_string())?;
    Ok("Drive ejected safely".to_string())
}

#[tauri::command]
pub async fn generate_recovery_phrase() -> Result<String, String> {
    crate::cold_storage::generate_recovery_phrase().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn recover_from_phrase(phrase: String) -> Result<Vec<u8>, String> {
    crate::cold_storage::recover_from_phrase(&phrase).map_err(|e| e.to_string())
}
