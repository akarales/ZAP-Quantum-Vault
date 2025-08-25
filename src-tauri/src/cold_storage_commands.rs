use crate::cold_storage::{ColdStorageManager, UsbDrive, BackupRequest, RestoreRequest, BackupMetadata, TrustLevel};
use crate::state::AppState;
use std::sync::Mutex;
use tauri::State;

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
pub async fn get_drive_details(drive_id: String) -> Result<UsbDrive, String> {
    let mut manager = COLD_STORAGE.lock().map_err(|e| e.to_string())?;
    let drives = manager.detect_usb_drives().map_err(|e| e.to_string())?;
    
    drives.into_iter()
        .find(|drive| drive.id == drive_id)
        .ok_or_else(|| "Drive not found".to_string())
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
    manager.create_backup(&request.drive_id, &[], "", "").map_err(|e| e.to_string())
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
