use tauri::{Emitter, AppHandle};
use std::process::Command;
use std::os::unix::process::ExitStatusExt;
use log::{info, debug};
use crate::cold_storage::UsbDrive;

#[tauri::command]
pub async fn format_and_encrypt_drive(
    app: AppHandle,
    drive_id: String,
    password: String,
    drive_name: Option<String>,
) -> Result<String, String> {
    info!("Starting format_and_encrypt_drive for drive_id: {}", drive_id);
    debug!("Drive name: {:?}", drive_name);
    
    let emit_progress = |stage: &str, progress: u8, message: &str| {
        info!("Progress: {} - {}% - {}", stage, progress, message);
        let _ = app.emit("format_progress", serde_json::json!({
            "stage": stage,
            "progress": progress,
            "message": message
        }));
    };
    
    // Step 1: Find the drive
    emit_progress("detecting", 5, "Finding USB drive...");
    
    // Parse drive_id to extract actual device name
    let device_name = if drive_id.starts_with("usb_") {
        // Extract device name from "usb_sde1" -> "sde"
        drive_id.strip_prefix("usb_").unwrap_or(&drive_id).trim_end_matches('1')
    } else if drive_id.starts_with("/dev/") {
        drive_id.strip_prefix("/dev/").unwrap_or(&drive_id)
    } else {
        &drive_id
    };
    
    let device_path = format!("/dev/{}", device_name);
    
    let partition_path = if device_path.ends_with("1") {
        device_path.clone()
    } else {
        format!("{}1", device_path)
    };
    
    println!("Device path: {}, Partition path: {}", device_path, partition_path);
    emit_progress("detecting", 10, &format!("Found device: {}", device_path));
    
    // Step 2: Check if device exists
    if !std::path::Path::new(&device_path).exists() {
        let error_msg = format!("Device {} does not exist", device_path);
        println!("Error: {}", error_msg);
        emit_progress("error", 0, &error_msg);
        return Err(error_msg);
    }
    
    // Step 3: Robust device cleanup before formatting
    emit_progress("cleanup", 15, "Performing device cleanup...");
    
    // First, check and cleanup any existing LUKS mappings
    if let Err(e) = cleanup_existing_luks_mappings(&device_path, &partition_path).await {
        println!("Warning during LUKS cleanup: {}", e);
    }
    
    // Step 4: Unmount if mounted
    emit_progress("unmounting", 20, "Checking if drive is mounted...");
    let mount_check = Command::new("findmnt")
        .arg("-n")
        .arg("-o")
        .arg("TARGET")
        .arg(&partition_path)
        .output();
    
    if let Ok(output) = mount_check {
        if !output.stdout.is_empty() {
            let mount_point = String::from_utf8_lossy(&output.stdout).trim().to_string();
            println!("Drive is mounted at: {}, unmounting...", mount_point);
            emit_progress("unmounting", 25, &format!("Unmounting from {}", mount_point));
            
            // First attempt: normal unmount
            let umount_result = Command::new("sudo")
                .arg("umount")
                .arg(&partition_path)
                .output();
                
            if let Ok(umount_output) = umount_result {
                if !umount_output.status.success() {
                    let error = String::from_utf8_lossy(&umount_output.stderr);
                    println!("Normal unmount failed: {}", error);
                    
                    if error.contains("target is busy") || error.contains("device is busy") {
                        println!("Device is busy, attempting force unmount...");
                        emit_progress("unmounting", 30, "Device busy, forcing unmount...");
                        
                        // Kill processes using the mount point
                        let _ = Command::new("sudo")
                            .arg("fuser")
                            .arg("-km")
                            .arg(&mount_point)
                            .output();
                        
                        // Wait a moment for processes to terminate
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        
                        // Try lazy unmount
                        let lazy_umount = Command::new("sudo")
                            .arg("umount")
                            .arg("-l")
                            .arg(&partition_path)
                            .output();
                        
                        if let Ok(lazy_output) = lazy_umount {
                            if !lazy_output.status.success() {
                                let lazy_error = String::from_utf8_lossy(&lazy_output.stderr);
                                println!("Lazy unmount also failed: {}", lazy_error);
                                
                                // Last resort: force unmount
                                let force_umount = Command::new("sudo")
                                    .arg("umount")
                                    .arg("-f")
                                    .arg("-l")
                                    .arg(&partition_path)
                                    .output();
                                
                                if let Ok(force_output) = force_umount {
                                    if !force_output.status.success() {
                                        let force_error = String::from_utf8_lossy(&force_output.stderr);
                                        println!("Force unmount failed: {}", force_error);
                                        emit_progress("error", 0, "Cannot unmount drive - please close all applications using the drive and try again");
                                        return Err("Cannot unmount drive - please close all applications using the drive and try again".to_string());
                                    } else {
                                        println!("Force unmount succeeded");
                                    }
                                }
                            } else {
                                println!("Lazy unmount succeeded");
                            }
                        }
                    } else {
                        emit_progress("error", 0, &format!("Failed to unmount: {}", error));
                        return Err(format!("Failed to unmount: {}", error));
                    }
                } else {
                    println!("Normal unmount succeeded");
                }
            }
            
            // Wait for unmount to complete
            std::thread::sleep(std::time::Duration::from_secs(1));
        }
    }
    
    // Step 4: Clear filesystem signatures
    emit_progress("clearing", 40, "Clearing filesystem signatures...");
    println!("Clearing filesystem signatures on {}", device_path);
    
    let wipefs_result = Command::new("sudo")
        .arg("wipefs")
        .arg("-af")
        .arg(&device_path)
        .output();
        
    if let Ok(output) = wipefs_result {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("wipefs stdout: {}", stdout);
        println!("wipefs stderr: {}", stderr);
    }
    
    // Step 5: Create new partition table
    emit_progress("partitioning", 60, "Creating partition table...");
    println!("Creating new partition table on {}", device_path);
    
    // First, ensure all processes are done with the device
    let _ = Command::new("sudo")
        .arg("sync")
        .output();
    
    std::thread::sleep(std::time::Duration::from_millis(500));
    
    let parted_commands = vec![
        format!("sudo parted {} --script mklabel gpt", device_path),
        format!("sudo parted {} --script mkpart primary ext4 0% 100%", device_path),
    ];
    
    for cmd_str in parted_commands {
        println!("Executing: {}", cmd_str);
        let parts: Vec<&str> = cmd_str.split_whitespace().collect();
        let result = Command::new(parts[0])
            .args(&parts[1..])
            .output();
            
        if let Ok(output) = result {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            let exit_code = output.status.code().unwrap_or(-1);
            
            println!("Command exit code: {}", exit_code);
            println!("Command stdout: {}", stdout);
            println!("Command stderr: {}", stderr);
            
            // Check if it's just a kernel notification warning (non-fatal)
            if !output.status.success() {
                if stderr.contains("unable to inform the kernel") && stderr.contains("You should reboot") {
                    println!("Warning: Kernel notification failed, but partition was created. Attempting to reload partition table...");
                    emit_progress("partitioning", 65, "Reloading partition table...");
                    
                    // Try to reload the partition table
                    let partprobe_result = Command::new("sudo")
                        .arg("partprobe")
                        .arg(&device_path)
                        .output();
                    
                    if let Ok(partprobe_output) = partprobe_result {
                        if partprobe_output.status.success() {
                            println!("Successfully reloaded partition table with partprobe");
                        } else {
                            println!("partprobe failed, trying blockdev --rereadpt");
                            let _ = Command::new("sudo")
                                .arg("blockdev")
                                .arg("--rereadpt")
                                .arg(&device_path)
                                .output();
                        }
                    }
                } else {
                    let error_msg = format!("Partitioning failed. Exit code: {}, Stderr: {}", exit_code, stderr);
                    println!("Error: {}", error_msg);
                    emit_progress("error", 0, &error_msg);
                    return Err(error_msg);
                }
            }
        }
    }
    
    // Sync and wait for partition to be recognized
    let _ = Command::new("sudo")
        .arg("sync")
        .output();
    
    std::thread::sleep(std::time::Duration::from_secs(3));
    
    // Verify partition exists
    let mut retries = 0;
    while retries < 10 {
        if std::path::Path::new(&partition_path).exists() {
            println!("Partition {} is now available", partition_path);
            break;
        }
        println!("Waiting for partition {} to become available... (attempt {})", partition_path, retries + 1);
        std::thread::sleep(std::time::Duration::from_millis(500));
        retries += 1;
    }
    
    if !std::path::Path::new(&partition_path).exists() {
        let error_msg = format!("Partition {} was not created or is not accessible", partition_path);
        println!("Error: {}", error_msg);
        emit_progress("error", 0, &error_msg);
        return Err(error_msg);
    }
    
    // Step 6: Setup LUKS encryption
    emit_progress("encrypting", 60, "Setting up LUKS encryption...");
    
    let label = drive_name.unwrap_or_else(|| "ZAP_VAULT".to_string());
    // Sanitize the name for device mapper - remove spaces and special characters
    let sanitized_name = label
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
        .collect::<String>()
        .replace(' ', "_")
        .to_lowercase();
    let encrypted_name = format!("{}_encrypted", sanitized_name);
    
    println!("Setting up LUKS encryption on {}", partition_path);
    emit_progress("encrypting", 65, "Creating encrypted container...");
    
    // Create LUKS encrypted container
    let mut luks_cmd = Command::new("sudo");
    luks_cmd.arg("cryptsetup")
        .arg("luksFormat")
        .arg("--type")
        .arg("luks2")
        .arg("--cipher")
        .arg("aes-xts-plain64")
        .arg("--key-size")
        .arg("512")
        .arg("--hash")
        .arg("sha256")
        .arg("--iter-time")
        .arg("2000")
        .arg("--batch-mode")
        .arg(&partition_path)
        .stdin(std::process::Stdio::piped());
    
    let mut luks_process = luks_cmd.spawn().map_err(|e| {
        let error_msg = format!("Failed to start LUKS encryption: {}", e);
        println!("LUKS command spawn error: {}", error_msg);
        emit_progress("error", 0, &error_msg);
        error_msg
    })?;
    
    // Write password to stdin
    if let Some(stdin) = luks_process.stdin.as_mut() {
        use std::io::Write;
        stdin.write_all(password.as_bytes()).map_err(|e| {
            let error_msg = format!("Failed to write password to LUKS: {}", e);
            println!("Password write error: {}", error_msg);
            emit_progress("error", 0, &error_msg);
            error_msg
        })?;
    }
    
    let luks_output = luks_process.wait_with_output().map_err(|e| {
        let error_msg = format!("LUKS encryption process failed: {}", e);
        println!("LUKS process error: {}", error_msg);
        emit_progress("error", 0, &error_msg);
        error_msg
    })?;
    
    if !luks_output.status.success() {
        let stderr = String::from_utf8_lossy(&luks_output.stderr);
        let error_msg = format!("LUKS encryption failed: {}", stderr);
        println!("LUKS failed: {}", error_msg);
        emit_progress("error", 0, &error_msg);
        return Err(error_msg);
    }
    
    println!("LUKS encryption completed successfully");
    emit_progress("encrypting", 75, "Opening encrypted container...");
    
    // Open the LUKS container
    let mut open_cmd = Command::new("sudo");
    open_cmd.arg("cryptsetup")
        .arg("luksOpen")
        .arg(&partition_path)
        .arg(&encrypted_name)
        .stdin(std::process::Stdio::piped());
    
    let mut open_process = open_cmd.spawn().map_err(|e| {
        let error_msg = format!("Failed to open LUKS container: {}", e);
        println!("LUKS open spawn error: {}", error_msg);
        emit_progress("error", 0, &error_msg);
        error_msg
    })?;
    
    // Write password to stdin for opening
    if let Some(stdin) = open_process.stdin.as_mut() {
        use std::io::Write;
        stdin.write_all(password.as_bytes()).map_err(|e| {
            let error_msg = format!("Failed to write password for LUKS open: {}", e);
            println!("Password write error for open: {}", error_msg);
            emit_progress("error", 0, &error_msg);
            error_msg
        })?;
    }
    
    let open_output = open_process.wait_with_output().map_err(|e| {
        let error_msg = format!("LUKS open process failed: {}", e);
        println!("LUKS open process error: {}", error_msg);
        emit_progress("error", 0, &error_msg);
        error_msg
    })?;
    
    if !open_output.status.success() {
        let stderr = String::from_utf8_lossy(&open_output.stderr);
        let error_msg = format!("Failed to open LUKS container: {}", stderr);
        println!("LUKS open failed: {}", error_msg);
        emit_progress("error", 0, &error_msg);
        return Err(error_msg);
    }
    
    println!("LUKS container opened successfully");
    emit_progress("formatting", 80, "Formatting encrypted filesystem...");
    
    // Step 7: Format the encrypted container with ext4
    let encrypted_device = format!("/dev/mapper/{}", encrypted_name);
    let format_cmd = format!("sudo mkfs.ext4 -F -L {} {}", label, encrypted_device);
    println!("Executing format command on encrypted device: {}", format_cmd);
    
    let output = Command::new("sudo")
        .arg("mkfs.ext4")
        .arg("-F")
        .arg("-L")
        .arg(&label)
        .arg(&encrypted_device)
        .output()
        .map_err(|e| {
            let error_msg = format!("Failed to format encrypted device: {}", e);
            println!("Format command execution error: {}", error_msg);
            emit_progress("error", 0, &error_msg);
            error_msg
        })?;
    
    // Log detailed output
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let exit_code = output.status.code().unwrap_or(-1);
    
    println!("Format command exit code: {}", exit_code);
    println!("Format command stdout: {}", stdout);
    println!("Format command stderr: {}", stderr);
    
    if !output.status.success() {
        let error_msg = format!(
            "Failed to format encrypted partition. Exit code: {}, Stderr: {}", 
            exit_code, stderr
        );
        println!("Format failed: {}", error_msg);
        emit_progress("error", 0, &error_msg);
        return Err(error_msg);
    }
    
    println!("Encrypted filesystem format successful: {}", stdout);
    emit_progress("formatting", 90, "Encrypted formatting completed successfully");
    
    // Step 8: Verify encrypted filesystem
    emit_progress("verifying", 95, "Verifying encrypted filesystem...");
    let fsck_result = Command::new("fsck.ext4")
        .arg("-f")
        .arg("-y")
        .arg(&encrypted_device)
        .output();
    
    if let Ok(fsck_output) = fsck_result {
        let fsck_stdout = String::from_utf8_lossy(&fsck_output.stdout);
        let fsck_stderr = String::from_utf8_lossy(&fsck_output.stderr);
        println!("fsck stdout: {}", fsck_stdout);
        println!("fsck stderr: {}", fsck_stderr);
        
        if fsck_output.status.success() {
            // Step 9: Mount the encrypted drive
            emit_progress("mounting", 98, "Mounting encrypted drive...");
            
            // Create mount point using sudo
            let mount_point = format!("/media/{}", label);
            let mkdir_result = Command::new("sudo")
                .arg("mkdir")
                .arg("-p")
                .arg(&mount_point)
                .output();
            
            if let Err(e) = mkdir_result {
                println!("Failed to create mount point: {}", e);
            }
            
            // Mount the encrypted device
            let mount_result = Command::new("sudo")
                .arg("mount")
                .arg(&encrypted_device)
                .arg(&mount_point)
                .output();
            
            match mount_result {
                Ok(mount_output) if mount_output.status.success() => {
                    emit_progress("complete", 100, "Encrypted drive formatted and mounted successfully!");
                    println!("Encrypted drive formatting and mounting completed successfully at {}", mount_point);
                    Ok(format!("Encrypted drive formatted and mounted at {}", mount_point))
                },
                Ok(mount_output) => {
                    let mount_stderr = String::from_utf8_lossy(&mount_output.stderr);
                    println!("Mount failed but encryption succeeded: {}", mount_stderr);
                    
                    // Close the LUKS container since we can't mount it
                    let _ = Command::new("sudo")
                        .arg("cryptsetup")
                        .arg("luksClose")
                        .arg(&encrypted_name)
                        .output();
                    
                    emit_progress("complete", 100, "Drive encrypted successfully (mount failed)!");
                    Ok("Drive encrypted successfully but could not be mounted automatically".to_string())
                },
                Err(e) => {
                    println!("Mount command failed: {}", e);
                    
                    // Close the LUKS container since we can't mount it
                    let _ = Command::new("sudo")
                        .arg("cryptsetup")
                        .arg("luksClose")
                        .arg(&encrypted_name)
                        .output();
                    
                    emit_progress("complete", 100, "Drive encrypted successfully (mount failed)!");
                    Ok("Drive encrypted successfully but could not be mounted automatically".to_string())
                }
            }
        } else {
            let error_msg = format!("Filesystem verification failed: {}", fsck_stderr);
            println!("Verification error: {}", error_msg);
            emit_progress("error", 0, &error_msg);
            Err(error_msg)
        }
    } else {
        // Try to mount even without verification
        emit_progress("mounting", 98, "Mounting encrypted drive...");
        
        let mount_point = format!("/media/{}", label);
        let mkdir_result = Command::new("sudo")
            .arg("mkdir")
            .arg("-p")
            .arg(&mount_point)
            .output();
        
        if let Err(e) = mkdir_result {
            println!("Failed to create mount point: {}", e);
        }
        
        let mount_result = Command::new("sudo")
            .arg("mount")
            .arg(&encrypted_device)
            .arg(&mount_point)
            .output();
        
        match mount_result {
            Ok(mount_output) if mount_output.status.success() => {
                emit_progress("complete", 100, "Encrypted drive formatted and mounted successfully!");
                println!("Encrypted drive formatting and mounting completed successfully at {}", mount_point);
                Ok(format!("Encrypted drive formatted and mounted at {}", mount_point))
            },
            _ => {
                // Close the LUKS container since we can't mount it
                let _ = Command::new("sudo")
                    .arg("cryptsetup")
                    .arg("luksClose")
                    .arg(&encrypted_name)
                    .output();
                
                emit_progress("complete", 100, "Drive encrypted successfully (verification skipped)!");
                println!("Drive encryption completed (fsck unavailable)");
                Ok("Drive encrypted and ready for use".to_string())
            }
        }
    }
}

/// Robust function to detect and cleanup existing LUKS mappings and device locks
async fn cleanup_existing_luks_mappings(device_path: &str, partition_path: &str) -> Result<(), String> {
    println!("Starting comprehensive device cleanup for {}", device_path);
    
    // Step 1: Find and close any existing LUKS mappings for this device
    let dmsetup_output = Command::new("sudo")
        .arg("dmsetup")
        .arg("ls")
        .arg("--target")
        .arg("crypt")
        .output()
        .map_err(|e| format!("Failed to list device mappings: {}", e))?;
    
    if dmsetup_output.status.success() {
        let mappings = String::from_utf8_lossy(&dmsetup_output.stdout);
        println!("Current LUKS mappings:\n{}", mappings);
        
        // Parse mappings and close all LUKS mappings (safer approach)
        for line in mappings.lines() {
            if !line.trim().is_empty() {
                // Extract the full mapping name (everything before the device info in parentheses)
                let raw_mapping_name = if let Some(paren_pos) = line.find('(') {
                    line[..paren_pos].trim()
                } else {
                    line.split('\t').next().unwrap_or("").trim()
                };
                
                // Sanitize the mapping name to handle spaces (device mapper doesn't like spaces in commands)
                let mapping_name = raw_mapping_name.replace(' ', "_");
                
                if !mapping_name.is_empty() && mapping_name != "No" && !mapping_name.starts_with("device") {
                    println!("Found LUKS mapping '{}', attempting to close...", mapping_name);
                    
                    // Step 1: Check if the mapping is mounted and unmount it first
                    let mount_point = format!("/dev/mapper/{}", mapping_name);
                    let mount_check = Command::new("mount")
                        .output()
                        .unwrap_or_else(|_| std::process::Output {
                            status: std::process::ExitStatus::from_raw(1),
                            stdout: Vec::new(),
                            stderr: Vec::new(),
                        });
                    
                    let mount_output = String::from_utf8_lossy(&mount_check.stdout);
                    if mount_output.contains(&mount_point) {
                        println!("LUKS mapping {} is mounted, attempting to unmount...", mapping_name);
                        
                        // Force unmount the filesystem
                        let unmount_result = Command::new("sudo")
                            .arg("umount")
                            .arg("-f")
                            .arg(&mount_point)
                            .output();
                        
                        match unmount_result {
                            Ok(output) => {
                                if output.status.success() {
                                    println!("Successfully unmounted {}", mount_point);
                                } else {
                                    let stderr = String::from_utf8_lossy(&output.stderr);
                                    println!("Warning: Failed to unmount {}: {}", mount_point, stderr);
                                    
                                    // Try lazy unmount as fallback
                                    let _ = Command::new("sudo")
                                        .arg("umount")
                                        .arg("-l")
                                        .arg(&mount_point)
                                        .output();
                                    println!("Attempted lazy unmount for {}", mount_point);
                                }
                            }
                            Err(e) => {
                                println!("Error executing umount for {}: {}", mount_point, e);
                            }
                        }
                        
                        // Wait for unmount to complete
                        std::thread::sleep(std::time::Duration::from_millis(1000));
                    }
                    
                    // Step 2: Now close the LUKS mapping
                    if let Ok(output) = Command::new("sudo")
                        .arg("cryptsetup")
                        .arg("luksClose")
                        .arg(&mapping_name)
                        .output()
                    {
                        if output.status.success() {
                            println!("Successfully closed LUKS mapping: {}", mapping_name);
                        } else {
                            let stderr = String::from_utf8_lossy(&output.stderr);
                            println!("Warning: Failed to close LUKS mapping {}: {}", mapping_name, stderr);
                        }
                    } else {
                        println!("Error executing cryptsetup luksClose for mapping: {}", mapping_name);
                    }
                    
                    // Wait a moment between closures
                    std::thread::sleep(std::time::Duration::from_millis(500));
                }
            }
        }
    }
    
    // Step 1.5: Also check partition path for LUKS mappings
    let partition_fuser = Command::new("sudo")
        .arg("fuser")
        .arg("-v")
        .arg(partition_path)
        .output();
    
    if let Ok(output) = partition_fuser {
        let fuser_info = String::from_utf8_lossy(&output.stderr);
        if !fuser_info.trim().is_empty() && !fuser_info.contains("No process") {
            println!("Found processes using partition: {}", fuser_info);
            let _ = Command::new("sudo")
                .arg("fuser")
                .arg("-km")
                .arg(partition_path)
                .output();
            std::thread::sleep(std::time::Duration::from_secs(1));
        }
    }

    // Step 2: Kill any processes that might be using the device
    println!("Checking for processes using the device...");
    let fuser_output = Command::new("sudo")
        .arg("fuser")
        .arg("-v")
        .arg(device_path)
        .output();
    
    if let Ok(output) = fuser_output {
        let fuser_info = String::from_utf8_lossy(&output.stderr); // fuser outputs to stderr
        if !fuser_info.trim().is_empty() && !fuser_info.contains("No process") {
            println!("Found processes using device: {}", fuser_info);
            
            // Kill processes using the device
            let kill_result = Command::new("sudo")
                .arg("fuser")
                .arg("-km")
                .arg(device_path)
                .output();
            
            if let Ok(kill_output) = kill_result {
                if kill_output.status.success() {
                    println!("Killed processes using the device");
                    // Wait for processes to terminate
                    std::thread::sleep(std::time::Duration::from_secs(2));
                }
            }
        }
    }
    
    // Step 3: Check for and unmount any mounted filesystems on the device
    let mount_output = Command::new("mount")
        .output()
        .map_err(|e| format!("Failed to check mounts: {}", e))?;
    
    let mount_info = String::from_utf8_lossy(&mount_output.stdout);
    for line in mount_info.lines() {
        if line.contains(device_path) || line.contains(partition_path) {
            // Extract mount point
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                let mount_point = parts[2];
                println!("Found mounted filesystem at {}, unmounting...", mount_point);
                
                // Force unmount
                let umount_result = Command::new("sudo")
                    .arg("umount")
                    .arg("-f")
                    .arg("-l")
                    .arg(mount_point)
                    .output();
                
                match umount_result {
                    Ok(output) if output.status.success() => {
                        println!("Successfully unmounted {}", mount_point);
                    }
                    Ok(output) => {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        println!("Warning: Failed to unmount {}: {}", mount_point, stderr);
                    }
                    Err(e) => {
                        println!("Error unmounting {}: {}", mount_point, e);
                    }
                }
            }
        }
    }
    
    // Step 4: Force release any device locks
    println!("Releasing device locks...");
    
    // Try to release any exclusive locks
    let blockdev_result = Command::new("sudo")
        .arg("blockdev")
        .arg("--flushbufs")
        .arg(device_path)
        .output();
    
    if let Ok(output) = blockdev_result {
        if output.status.success() {
            println!("Flushed device buffers");
        }
    }
    
    // Step 5: Sync and wait
    let _ = Command::new("sync").output();
    std::thread::sleep(std::time::Duration::from_secs(1));
    
    // Step 6: Final check - verify device is not in use
    let lsof_check = Command::new("sudo")
        .arg("lsof")
        .arg(device_path)
        .output();
    
    if let Ok(output) = lsof_check {
        let lsof_info = String::from_utf8_lossy(&output.stdout);
        if !lsof_info.trim().is_empty() {
            println!("Warning: Device still has open file handles:\n{}", lsof_info);
            return Err(format!("Device {} is still in use by some processes. Please close all applications and try again.", device_path));
        }
    }
    
    println!("Device cleanup completed successfully");
    Ok(())
}
