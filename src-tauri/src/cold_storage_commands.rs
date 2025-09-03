use crate::cold_storage::{ColdStorageManager, UsbDrive, TrustLevel, BackupRequest, BackupMetadata, RestoreRequest, BackupType};
use crate::encryption::SecurePassword;
use crate::validation::InputValidator;
use crate::state::AppState;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tauri::State;
use tokio::sync::RwLock;

// Cached drive data with timestamp
#[derive(Clone)]
struct CachedDriveData {
    drives: Vec<UsbDrive>,
    last_updated: Instant,
}

// Global cache for USB drives (manual refresh only)
lazy_static::lazy_static! {
    static ref DRIVE_CACHE: Arc<RwLock<Option<CachedDriveData>>> = Arc::new(RwLock::new(None));
    static ref COLD_STORAGE: Mutex<ColdStorageManager> = Mutex::new(ColdStorageManager::new());
}

// No automatic cache expiration - only manual refresh

#[tauri::command]
pub async fn detect_usb_drives(state: State<'_, AppState>) -> Result<Vec<UsbDrive>, String> {
    get_cached_drives(state).await
}

#[tauri::command]
pub async fn refresh_usb_drives(state: State<'_, AppState>) -> Result<Vec<UsbDrive>, String> {
    refresh_drive_cache(state).await
}

// Helper function to get drives with caching (manual refresh only)
async fn get_cached_drives(state: State<'_, AppState>) -> Result<Vec<UsbDrive>, String> {
    // Check cache first - return cached data if available
    {
        let cache = DRIVE_CACHE.read().await;
        if let Some(cached_data) = cache.as_ref() {
            println!(
                "[CACHE] Returning cached drives (age: {:.1}s)", 
                cached_data.last_updated.elapsed().as_secs_f32()
            );
            return Ok(cached_data.drives.clone());
        }
    }
    
    // No cache - perform initial scan
    println!("[CACHE] No cached data, performing initial USB scan");
    refresh_drive_cache(state).await
}

// Force refresh the drive cache
async fn refresh_drive_cache(state: State<'_, AppState>) -> Result<Vec<UsbDrive>, String> {
    println!("[CACHE] Force refreshing USB drive cache");
    let mut manager = ColdStorageManager::with_database((*state.db).clone()).await;
    let drives = manager.detect_usb_drives().await.map_err(|e| e.to_string())?;
    
    // Update cache
    {
        let mut cache = DRIVE_CACHE.write().await;
        *cache = Some(CachedDriveData {
            drives: drives.clone(),
            last_updated: Instant::now(),
        });
    }
    
    println!("[CACHE] Cache updated with {} drives", drives.len());
    Ok(drives)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn get_drive_details(driveId: String, state: State<'_, AppState>) -> Result<UsbDrive, String> {
    println!("[GET_DRIVE_DETAILS] Starting get_drive_details for driveId: {}", driveId);
    
    // Use cached drives instead of rescanning
    let drives = get_cached_drives(state).await?;
    println!("[GET_DRIVE_DETAILS] Retrieved {} drives from cache", drives.len());
    
    let found_drive = drives.into_iter()
        .find(|drive| drive.id == driveId);
        
    match &found_drive {
        Some(drive) => {
            println!("[GET_DRIVE_DETAILS] ✅ Found drive {} with trust_level: {:?}", drive.id, drive.trust_level);
        }
        None => {
            println!("[GET_DRIVE_DETAILS] ❌ Drive {} not found", driveId);
        }
    }
    
    found_drive.ok_or_else(|| "Drive not found".to_string())
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn set_drive_trust(driveId: String, trustLevel: String, state: State<'_, AppState>) -> Result<String, String> {
    println!("[TRUST_CMD] Starting set_drive_trust");
    println!("[TRUST_CMD] Parameters: driveId={}, trustLevel={}", driveId, trustLevel);
    
    let trust = match trustLevel.as_str() {
        "trusted" => {
            println!("[TRUST_CMD] ✅ Parsed trust level as Trusted");
            TrustLevel::Trusted
        },
        "untrusted" => {
            println!("[TRUST_CMD] ⚠️ Parsed trust level as Untrusted");
            TrustLevel::Untrusted
        },
        "blocked" => {
            println!("[TRUST_CMD] 🚫 Parsed trust level as Blocked");
            TrustLevel::Blocked
        },
        _ => {
            println!("[TRUST_CMD] ❌ Invalid trust level: {}", trustLevel);
            return Err("Invalid trust level".to_string());
        }
    };

    // Create a new manager with database access for this operation
    println!("[TRUST_CMD] Creating ColdStorageManager with database access");
    let mut manager = ColdStorageManager::with_database((*state.db).clone()).await;
    
    // First detect drives to populate the manager
    println!("[TRUST_CMD] Detecting USB drives to populate manager");
    match manager.detect_usb_drives().await {
        Ok(drives) => {
            println!("[MOUNT_CMD] Found {} drives", drives.len());
            for drive in &drives {
                let is_mounted = drive.mount_point.is_some();
                println!("[MOUNT_CMD] Drive: {} - Mounted: {}", drive.id, is_mounted);
            }
        }
        Err(e) => {
            println!("[MOUNT_CMD] Error detecting drives: {}", e);
            return Err(e.to_string());
        }
    }
    
    // Set trust level with database persistence
    println!("[TRUST_CMD] Setting trust level for drive {} to {:?}", driveId, trust);
    match manager.set_drive_trust(&driveId, trust).await {
        Ok(_) => {
            println!("[TRUST_CMD] ✅ Successfully set trust level for drive {}", driveId);
            Ok("Trust level updated successfully".to_string())
        },
        Err(e) => {
            println!("[TRUST_CMD] ❌ Failed to set trust level: {}", e);
            eprintln!("[TRUST_CMD] Trust level error details: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn create_backup(
    drive_id: String,
    backup_type: String,
    vault_ids: Option<Vec<String>>,
    compression_level: Option<u8>,
    verification: Option<bool>,
    password: Option<String>,
    state: State<'_, AppState>
) -> Result<String, String> {
    println!("[BACKUP_CMD] ==================== BACKUP START ====================");
    println!("[BACKUP_CMD] Starting vault backup to USB drive");
    println!("[BACKUP_CMD] Parameters: drive_id={}, backup_type={}", drive_id, backup_type);
    println!("[BACKUP_CMD] Vault IDs: {:?}", vault_ids);
    println!("[BACKUP_CMD] Compression level: {:?}", compression_level);
    println!("[BACKUP_CMD] Verification: {:?}", verification);
    println!("[BACKUP_CMD] Password provided: {}", password.is_some());
    
    // Create BackupRequest from individual parameters
    let request = BackupRequest {
        drive_id: drive_id.clone(),
        backup_type: match backup_type.as_str() {
            "Full" => BackupType::Full,
            _ => BackupType::Full, // Default to Full
        },
        vault_ids,
        compression_level: compression_level.unwrap_or(5),
        verification: verification.unwrap_or(true),
    };
    
    // Create manager with database access for backup operations
    println!("[BACKUP_CMD] Creating ColdStorageManager with database access");
    let mut manager = ColdStorageManager::with_database((*state.db).clone()).await;
    println!("[BACKUP_CMD] ✅ ColdStorageManager created successfully");
    
    // Detect drives to populate the manager
    println!("[BACKUP_CMD] Detecting USB drives to populate manager...");
    let detected_drives = manager.detect_usb_drives().await.map_err(|e| {
        println!("[BACKUP_CMD] ❌ Failed to detect drives: {}", e);
        e.to_string()
    })?;
    println!("[BACKUP_CMD] ✅ Detected {} drives", detected_drives.len());
    
    // Log all detected drives
    for drive in &detected_drives {
        println!("[BACKUP_CMD] Drive found: {} - {} - Mounted: {} - Trust: {:?}", 
                 drive.id, drive.device_path, drive.mount_point.is_some(), drive.trust_level);
    }
    
    // Check if target drive exists
    let target_drive = detected_drives.iter().find(|d| d.id == request.drive_id);
    match target_drive {
        Some(drive) => {
            println!("[BACKUP_CMD] ✅ Target drive found: {} ({})", drive.id, drive.device_path);
            println!("[BACKUP_CMD] Drive details: mounted={}, trust={:?}, capacity={} bytes", 
                     drive.mount_point.is_some(), drive.trust_level, drive.capacity);
        },
        None => {
            println!("[BACKUP_CMD] ❌ Target drive '{}' not found in detected drives", request.drive_id);
            return Err(format!("Target drive '{}' not found", request.drive_id));
        }
    }
    
    // Get actual vault data from the application state
    println!("[BACKUP_CMD] Retrieving actual vault data from database...");
    let vault_export_data = crate::vault_commands::export_all_vault_data_for_backup(state.clone()).await.map_err(|e| {
        println!("[BACKUP_CMD] ❌ Failed to export vault data: {}", e);
        format!("Failed to export vault data: {}", e)
    })?;
    
    println!("[BACKUP_CMD] ✅ Retrieved vault data: {} vaults, {} items", 
             vault_export_data.total_vaults, vault_export_data.total_items);
    
    // Serialize the actual vault data for backup
    println!("[BACKUP_CMD] Serializing vault data for backup...");
    let vault_data = serde_json::to_vec(&vault_export_data).map_err(|e| {
        println!("[BACKUP_CMD] ❌ Failed to serialize vault data: {}", e);
        format!("Failed to serialize vault data: {}", e)
    })?;
    
    println!("[BACKUP_CMD] ✅ Vault data serialized successfully ({} bytes)", vault_data.len());
    
    // No recovery phrase needed for backups - USB drive encryption provides security
    println!("[BACKUP_CMD] Skipping recovery phrase generation (not needed for backups)");
    
    // Validate drive ID
    let validated_drive_id = InputValidator::validate_drive_id(&drive_id)
        .map_err(|e| format!("Invalid drive ID: {}", e))?;
    
    // Use default password if none provided
    let backup_password = password.unwrap_or_else(|| "default_backup_key".to_string());
    let secure_password = SecurePassword::from_stored(backup_password);
    
    println!("[BACKUP_CMD] ✅ Password setup successful");
    
    println!("[BACKUP_CMD] Creating encrypted backup on drive {}...", validated_drive_id);
    println!("[BACKUP_CMD] Backup data size: {} bytes", vault_data.len());
    
    match manager.create_backup(&validated_drive_id, &vault_data, secure_password.expose_secret()) {
        Ok(result) => {
            println!("[BACKUP_CMD] ✅ Vault backup created successfully: {}", result);
            println!("[BACKUP_CMD] Backup ID: {}", result);
            
            // Clear cache after backup creation
            {
                let mut cache = DRIVE_CACHE.write().await;
                *cache = None;
                println!("[BACKUP_CMD] ✅ Drive cache cleared after backup creation");
            }
            
            println!("[BACKUP_CMD] ==================== BACKUP SUCCESS ====================");
            Ok(result)
        },
        Err(e) => {
            println!("[BACKUP_CMD] ❌ Failed to create vault backup: {}", e);
            println!("[BACKUP_CMD] Error details: {:?}", e);
            println!("[BACKUP_CMD] ==================== BACKUP FAILED ====================");
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn list_backups(drive_id: String, state: State<'_, AppState>) -> Result<Vec<BackupMetadata>, String> {
    let mut manager = ColdStorageManager::with_database((*state.db).clone()).await;
    manager.detect_usb_drives().await.map_err(|e| e.to_string())?;
    manager.list_backups(&drive_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn verify_backup(backup_id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let mut manager = ColdStorageManager::with_database((*state.db).clone()).await;
    manager.detect_usb_drives().await.map_err(|e| e.to_string())?;
    manager.verify_backup(&backup_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restore_backup(request: RestoreRequest, state: State<'_, AppState>) -> Result<String, String> {
    let mut manager = ColdStorageManager::with_database((*state.db).clone()).await;
    manager.detect_usb_drives().await.map_err(|e| e.to_string())?;
    manager.restore_backup(request).map_err(|e| e.to_string())?;
    Ok("Backup restored successfully".to_string())
}


#[tauri::command]
pub async fn eject_drive(drive_id: String, state: State<'_, AppState>) -> Result<String, String> {
    let mut manager = ColdStorageManager::with_database((*state.db).clone()).await;
    manager.detect_usb_drives().await.map_err(|e| e.to_string())?;
    manager.eject_drive(&drive_id).map_err(|e| e.to_string())?;
    
    // Clear cache after ejecting
    {
        let mut cache = DRIVE_CACHE.write().await;
        *cache = None;
    }
    
    Ok("Drive ejected safely".to_string())
}



#[tauri::command]
pub async fn unmount_drive(drive_id: String) -> Result<String, String> {
    use std::process::Command;
    
    // Parse drive ID to get device path
    let device_path = if drive_id.starts_with("usb_") {
        let device_name = drive_id.strip_prefix("usb_").unwrap_or(&drive_id);
        format!("/dev/{}", device_name)
    } else {
        drive_id.clone()
    };
    
    println!("Attempting to unmount device: {}", device_path);
    
    // Get current mount point
    let mount_check = Command::new("mount")
        .output()
        .map_err(|e| format!("Failed to check mount status: {}", e))?;
    
    let mount_output = String::from_utf8_lossy(&mount_check.stdout);
    let mount_point = mount_output
        .lines()
        .find(|line| line.contains(&device_path))
        .and_then(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                Some(parts[2].to_string())
            } else {
                None
            }
        });
    
    if let Some(mount_path) = mount_point {
        println!("Unmounting {} from {}", device_path, mount_path);
        
        // Unmount the drive
        let unmount_result = Command::new("timeout")
            .arg("30")
            .arg("sudo")
            .arg("umount")
            .arg("-v")
            .arg(&mount_path)
            .output()
            .map_err(|e| format!("Failed to execute unmount command: {}", e))?;
        
        let stdout = String::from_utf8_lossy(&unmount_result.stdout);
        let stderr = String::from_utf8_lossy(&unmount_result.stderr);
        
        println!("Unmount stdout: {}", stdout);
        println!("Unmount stderr: {}", stderr);
        
        if unmount_result.status.success() {
            // Try to remove the mount point directory
            let _ = Command::new("sudo")
                .arg("rmdir")
                .arg(&mount_path)
                .output();
            
            println!("Successfully unmounted {} from {}", device_path, mount_path);
            Ok(format!("Drive unmounted successfully from {}", mount_path))
        } else {
            let error_msg = if stderr.contains("timeout") {
                "Unmount operation timed out after 30 seconds".to_string()
            } else if stderr.is_empty() && !stdout.is_empty() {
                format!("Unmount failed: {}", stdout)
            } else {
                format!("Unmount failed: {}", stderr)
            };
            println!("Unmount failed: {}", error_msg);
            Err(error_msg)
        }
    } else {
        Err(format!("Drive {} is not currently mounted", device_path))
    }
}

#[tauri::command]
pub async fn mount_drive(drive_id: String, mount_point: Option<String>) -> Result<String, String> {
    use std::process::Command;
    
    // Parse drive ID to get device path
    let device_path = if drive_id.starts_with("usb_") {
        let device_name = drive_id.strip_prefix("usb_").unwrap_or(&drive_id);
        if device_name.chars().last().map_or(false, |c| c.is_ascii_digit()) {
            format!("/dev/{}", device_name)
        } else {
            format!("/dev/{}1", device_name)
        }
    } else {
        drive_id.clone()
    };
    
    println!("Attempting to mount device: {}", device_path);
    
    // Get filesystem label for mount point
    let label_output = Command::new("lsblk")
        .arg("-no")
        .arg("LABEL")
        .arg(&device_path)
        .output()
        .map_err(|e| format!("Failed to get drive label: {}", e))?;
    
    let label = String::from_utf8_lossy(&label_output.stdout)
        .trim()
        .to_string();
    let label = if label.is_empty() { "USB_DRIVE".to_string() } else { label };
    
    // Create mount point using sudo
    let mount_path = mount_point.unwrap_or_else(|| format!("/media/{}", label));
    let mkdir_result = Command::new("sudo")
        .arg("mkdir")
        .arg("-p")
        .arg(&mount_path)
        .output()
        .map_err(|e| format!("Failed to execute mkdir command: {}", e))?;
    
    if !mkdir_result.status.success() {
        let stderr = String::from_utf8_lossy(&mkdir_result.stderr);
        return Err(format!("Failed to create mount point {}: {}", mount_path, stderr));
    }
    
    // Check filesystem type first
    println!("Checking filesystem type for {}", device_path);
    let fstype_result = Command::new("sudo")
        .arg("blkid")
        .arg("-o")
        .arg("value")
        .arg("-s")
        .arg("TYPE")
        .arg(&device_path)
        .output();
    
    let filesystem_type = if let Ok(output) = fstype_result {
        let fs_type = String::from_utf8_lossy(&output.stdout).trim().to_string();
        println!("Detected filesystem: {}", if fs_type.is_empty() { "unknown" } else { &fs_type });
        if fs_type.is_empty() { None } else { Some(fs_type) }
    } else {
        println!("Could not detect filesystem type");
        None
    };
    
    // Handle LUKS encrypted drives
    let actual_device_path = if let Some(ref fs_type) = filesystem_type {
        if fs_type == "crypto_LUKS" {
            return Err("LUKS encrypted drive detected. Please use mount_encrypted_drive with password.".to_string());
        } else {
            device_path.clone()
        }
    } else {
        device_path.clone()
    };
    
    // Mount the drive with timeout and better error handling
    println!("Executing mount command: sudo mount {} {}", actual_device_path, mount_path);
    
    let mut mount_cmd = Command::new("timeout");
    mount_cmd.arg("30")  // 30 second timeout
        .arg("sudo")
        .arg("mount")
        .arg("-v");  // verbose output
    
    // Add filesystem type if detected and not LUKS
    if let Some(fs_type) = filesystem_type {
        if fs_type != "crypto_LUKS" {
            mount_cmd.arg("-t").arg(fs_type);
        }
    }
    
    let mount_result = mount_cmd
        .arg(&actual_device_path)
        .arg(&mount_path)
        .output()
        .map_err(|e| format!("Failed to execute mount command: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&mount_result.stdout);
    let stderr = String::from_utf8_lossy(&mount_result.stderr);
    
    println!("Mount stdout: {}", stdout);
    println!("Mount stderr: {}", stderr);
    println!("Mount exit code: {}", mount_result.status.code().unwrap_or(-1));
    
    if mount_result.status.success() {
        println!("Successfully mounted {} at {}", device_path, mount_path);
        Ok(format!("Drive mounted successfully at {}", mount_path))
    } else {
        let error_msg = if stderr.contains("timeout") {
            "Mount operation timed out after 30 seconds".to_string()
        } else if stderr.is_empty() && !stdout.is_empty() {
            format!("Mount failed: {}", stdout)
        } else {
            format!("Mount failed: {}", stderr)
        };
        println!("Mount failed: {}", error_msg);
        Err(error_msg)
    }
}

#[tauri::command]
pub async fn mount_encrypted_drive_auto(
    state: State<'_, AppState>,
    user_id: String,
    drive_id: String,
    mount_point: Option<String>
) -> Result<String, String> {
    // First try to get stored password
    if let Ok(Some(stored_password)) = crate::usb_password_commands::get_usb_drive_password(state.clone(), user_id, drive_id.clone()).await {
        // Try mounting with stored password
        match mount_encrypted_drive(drive_id.clone(), stored_password, mount_point.clone()).await {
            Ok(result) => return Ok(result),
            Err(_) => {
                // Stored password failed, will need manual password entry
                return Err("STORED_PASSWORD_FAILED".to_string());
            }
        }
    }
    
    // No stored password available
    Err("NO_STORED_PASSWORD".to_string())
}

#[tauri::command]
pub async fn mount_encrypted_drive(drive_id: String, password: String, mount_point: Option<String>) -> Result<String, String> {
    use std::process::Command;
    
    // Parse drive ID to get device path
    let device_path = if drive_id.starts_with("usb_") {
        let device_name = drive_id.strip_prefix("usb_").unwrap_or(&drive_id);
        if device_name.chars().last().map_or(false, |c| c.is_ascii_digit()) {
            format!("/dev/{}", device_name)
        } else {
            format!("/dev/{}1", device_name)
        }
    } else {
        drive_id.clone()
    };
    
    println!("Attempting to mount encrypted device: {}", device_path);
    
    // Check if it's actually a LUKS device
    let fstype_result = Command::new("sudo")
        .arg("blkid")
        .arg("-o")
        .arg("value")
        .arg("-s")
        .arg("TYPE")
        .arg(&device_path)
        .output()
        .map_err(|e| format!("Failed to check filesystem type: {}", e))?;
    
    let fs_type = String::from_utf8_lossy(&fstype_result.stdout).trim().to_string();
    if fs_type != "crypto_LUKS" {
        return Err(format!("Device {} is not a LUKS encrypted device (detected: {})", device_path, fs_type));
    }
    
    // Generate a unique mapper name for the LUKS device
    let mapper_name = format!("luks_vault_{}", 
        device_path.replace("/dev/", "").replace("/", "_"));
    let mapper_path = format!("/dev/mapper/{}", mapper_name);
    
    // Check if already unlocked
    if std::path::Path::new(&mapper_path).exists() {
        println!("LUKS device already unlocked at {}", mapper_path);
    } else {
        // Unlock the LUKS device
        println!("Unlocking LUKS device {} as {}", device_path, mapper_name);
        
        let unlock_result = Command::new("sudo")
            .arg("cryptsetup")
            .arg("luksOpen")
            .arg(&device_path)
            .arg(&mapper_name)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start cryptsetup: {}", e))?;
        
        // Write password to stdin
        if let Some(mut stdin) = unlock_result.stdin.as_ref() {
            use std::io::Write;
            writeln!(stdin, "{}", password)
                .map_err(|e| format!("Failed to write password: {}", e))?;
        }
        
        let unlock_output = unlock_result.wait_with_output()
            .map_err(|e| format!("Failed to wait for cryptsetup: {}", e))?;
        
        if !unlock_output.status.success() {
            let stderr = String::from_utf8_lossy(&unlock_output.stderr);
            return Err(format!("Failed to unlock LUKS device: {}", stderr));
        }
        
        println!("Successfully unlocked LUKS device");
    }
    
    // Get filesystem label for mount point
    let label_output = Command::new("lsblk")
        .arg("-no")
        .arg("LABEL")
        .arg(&mapper_path)
        .output()
        .map_err(|e| format!("Failed to get drive label: {}", e))?;
    
    let label = String::from_utf8_lossy(&label_output.stdout)
        .trim()
        .to_string();
    let label = if label.is_empty() { "ENCRYPTED_DRIVE".to_string() } else { label };
    
    // Create mount point
    let mount_path = mount_point.unwrap_or_else(|| format!("/media/{}", label));
    let mkdir_result = Command::new("sudo")
        .arg("mkdir")
        .arg("-p")
        .arg(&mount_path)
        .output()
        .map_err(|e| format!("Failed to execute mkdir command: {}", e))?;
    
    if !mkdir_result.status.success() {
        let stderr = String::from_utf8_lossy(&mkdir_result.stderr);
        // Clean up: close LUKS device if we opened it
        let _ = Command::new("sudo")
            .arg("cryptsetup")
            .arg("luksClose")
            .arg(&mapper_name)
            .output();
        return Err(format!("Failed to create mount point {}: {}", mount_path, stderr));
    }
    
    // Mount the unlocked device
    println!("Mounting unlocked device {} at {}", mapper_path, mount_path);
    
    let mount_result = Command::new("timeout")
        .arg("30")
        .arg("sudo")
        .arg("mount")
        .arg("-v")
        .arg(&mapper_path)
        .arg(&mount_path)
        .output()
        .map_err(|e| format!("Failed to execute mount command: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&mount_result.stdout);
    let stderr = String::from_utf8_lossy(&mount_result.stderr);
    
    println!("Mount stdout: {}", stdout);
    println!("Mount stderr: {}", stderr);
    
    if mount_result.status.success() {
        println!("Successfully mounted encrypted drive at {}", mount_path);
        Ok(format!("Encrypted drive mounted successfully at {}", mount_path))
    } else {
        // Clean up: close LUKS device if mount failed
        let _ = Command::new("sudo")
            .arg("cryptsetup")
            .arg("luksClose")
            .arg(&mapper_name)
            .output();
        
        let error_msg = if stderr.contains("timeout") {
            "Mount operation timed out after 30 seconds".to_string()
        } else if stderr.is_empty() && !stdout.is_empty() {
            format!("Mount failed: {}", stdout)
        } else {
            format!("Mount failed: {}", stderr)
        };
        println!("Mount failed: {}", error_msg);
        Err(error_msg)
    }
}
