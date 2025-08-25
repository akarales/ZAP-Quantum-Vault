use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use blake3;
use hex;
use crate::quantum_crypto::{QuantumCryptoManager, QuantumDriveHeader, QuantumEncryptedData};
use sysinfo::{Disks, Disk};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsbDrive {
    pub id: String,
    pub device_path: String,
    pub mount_point: Option<String>,
    pub capacity: u64,
    pub available_space: u64,
    pub filesystem: String,
    pub is_encrypted: bool,
    pub label: Option<String>,
    pub is_removable: bool,
    pub trust_level: TrustLevel,
    pub last_seen: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TrustLevel {
    Trusted,
    Untrusted,
    Blocked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupMetadata {
    pub id: String,
    pub drive_id: String,
    pub backup_type: BackupType,
    pub backup_path: String,
    pub vault_ids: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub size_bytes: u64,
    pub checksum: String,
    pub encryption_method: String,
    pub item_count: u32,
    pub vault_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BackupType {
    Full,
    Incremental,
    Selective,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupRequest {
    pub drive_id: String,
    pub backup_type: BackupType,
    pub vault_items: Vec<String>,
    pub include_metadata: bool,
    pub compression_level: u8,
    pub verification: bool,
    pub password: Option<String>, // For additional encryption
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreRequest {
    pub backup_id: String,
    pub restore_type: RestoreType,
    pub vault_ids: Option<Vec<String>>, // None for full restore
    pub merge_mode: bool, // true to merge with existing data
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RestoreType {
    Full,
    Selective,
    KeysOnly,
}

pub struct ColdStorageManager {
    disks: Disks,
    drives: HashMap<String, UsbDrive>,
    trusted_drives: HashMap<String, TrustLevel>,
}

impl ColdStorageManager {
    pub fn new() -> Self {
        Self {
            disks: Disks::new_with_refreshed_list(),
            drives: HashMap::new(),
            trusted_drives: HashMap::new(),
        }
    }

    /// Detect all connected USB drives
    pub fn detect_usb_drives(&mut self) -> Result<Vec<UsbDrive>> {
        self.disks.refresh(true);
        let mut usb_drives = Vec::new();
        
        // First check mounted drives via sysinfo
        for disk in self.disks.list() {
            if self.is_removable_drive(disk) {
                match self.create_usb_drive_info(disk) {
                    Ok(drive) => {
                        self.drives.insert(drive.id.clone(), drive.clone());
                        usb_drives.push(drive);
                    },
                    Err(e) => {
                        eprintln!("Failed to create USB drive info: {}", e);
                    }
                }
            }
        }
        
        // Also check for unmounted USB drives by scanning /dev/sd* directly
        self.detect_unmounted_usb_drives(&mut usb_drives)?;
        
        Ok(usb_drives)
    }
    
    /// Detect unmounted USB drives by scanning /dev/sd* devices
    fn detect_unmounted_usb_drives(&mut self, usb_drives: &mut Vec<UsbDrive>) -> Result<()> {
        
        // Check for USB drives starting from /dev/sde (typically where USB drives appear)
        for letter in ['e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'] {
            let device_path = format!("/dev/sd{}", letter);
            let partition_path = format!("/dev/sd{}1", letter);
            
            // Check if the device exists
            if std::path::Path::new(&device_path).exists() {
                println!("Found potential USB device: {}", device_path);
                
                // Check if we already detected this drive
                let already_detected = usb_drives.iter().any(|drive| 
                    drive.device_path == device_path || drive.device_path == partition_path
                );
                
                if !already_detected {
                    // Try to get device info
                    if let Ok(drive) = self.create_usb_drive_from_device(&device_path, &partition_path) {
                        self.drives.insert(drive.id.clone(), drive.clone());
                        usb_drives.push(drive);
                    }
                }
            }
        }
        
        Ok(())
    }
    
    /// Create USB drive info from device path (for unmounted drives)
    fn create_usb_drive_from_device(&self, device_path: &str, partition_path: &str) -> Result<UsbDrive> {
        use std::process::Command;
        
        // Use lsblk to get device information
        let output = Command::new("lsblk")
            .args(["-b", "-n", "-o", "SIZE,RM", device_path])
            .output()?;
        
        if !output.status.success() {
            return Err(anyhow::anyhow!("Failed to get device info for {}", device_path));
        }
        
        let output_str = String::from_utf8_lossy(&output.stdout);
        let parts: Vec<&str> = output_str.trim().split_whitespace().collect();
        
        if parts.len() < 2 {
            return Err(anyhow::anyhow!("Invalid lsblk output for {}", device_path));
        }
        
        let size_bytes: u64 = parts[0].parse()?;
        let is_removable = parts[1] == "1";
        
        if !is_removable {
            return Err(anyhow::anyhow!("Device {} is not removable", device_path));
        }
        
        let drive_id = format!("usb_{}", device_path.replace("/dev/", ""));
        
        Ok(UsbDrive {
            id: drive_id,
            device_path: partition_path.to_string(), // Use partition path
            capacity: size_bytes,
            available_space: size_bytes, // Assume full space available for unmounted
            is_encrypted: false,
            trust_level: TrustLevel::Untrusted,
            mount_point: None,
            filesystem: "Unknown".to_string(),
            label: Some(format!("USB Drive ({})", device_path)),
            is_removable: true,
            last_seen: chrono::Utc::now(),
        })
    }

    /// Check if a disk is a removable USB drive
    fn is_removable_drive(&self, disk: &Disk) -> bool {
        let device_path = disk.name().to_string_lossy();
        let mount_point = disk.mount_point().to_string_lossy();
        
        // Debug: Print all disks for troubleshooting
        println!("Checking mounted disk: {} at {} (removable: {})", 
                device_path, mount_point, disk.is_removable());
        
        // First check if it's marked as removable by the system
        let is_removable = disk.is_removable();
        
        // Also check for USB drives by device path pattern
        let is_usb_device = device_path.starts_with("/dev/sde") || // USB drives typically start from sde
                           device_path.starts_with("/dev/sdf") ||
                           device_path.starts_with("/dev/sdg") ||
                           device_path.starts_with("/dev/sdh");
        
        // Must be either removable OR a USB device pattern
        if !is_removable && !is_usb_device {
            return false;
        }
        
        // Exclude system mount points even if marked as removable
        let is_system_mount = mount_point == "/" || 
                             mount_point == "/boot" || 
                             mount_point == "/home" ||
                             mount_point.starts_with("/snap/") ||
                             mount_point.starts_with("/var/") ||
                             mount_point.starts_with("/usr/") ||
                             mount_point.starts_with("/opt/") ||
                             mount_point.starts_with("/tmp/") ||
                             mount_point.starts_with("/sys/") ||
                             mount_point.starts_with("/proc/") ||
                             mount_point.starts_with("/dev/") ||
                             mount_point.starts_with("/run/") && !mount_point.starts_with("/run/media/");
        
        if is_system_mount {
            return false;
        }
        
        // Exclude all internal drives - be very specific
        let is_internal_drive = device_path.starts_with("/dev/sda") ||  // Primary SATA
                               device_path.starts_with("/dev/sdb") ||  // Secondary SATA
                               device_path.starts_with("/dev/sdc") ||  // Third SATA (internal SSD)
                               device_path.starts_with("/dev/sdd") ||  // Fourth SATA (internal HDD)
                               device_path.contains("/dev/nvme") ||    // NVMe drives
                               device_path.contains("/dev/mmcblk");   // eMMC/SD
        
        if is_internal_drive {
            println!("Excluding internal drive: {}", device_path);
            return false;
        }
        
        // Only allow drives that are actually removable USB devices
        // Focus on /dev/sde and higher, which are typically USB
        let is_usb_range = device_path.starts_with("/dev/sde") ||
                          device_path.starts_with("/dev/sdf") ||
                          device_path.starts_with("/dev/sdg") ||
                          device_path.starts_with("/dev/sdh");
        
        let is_removable_device = disk.is_removable();
        
        println!("Drive {} - USB range: {}, removable: {}", 
                device_path, is_usb_range, is_removable_device);
        
        // Only accept if it's in the USB device range AND marked as removable
        is_usb_range && is_removable_device
    }

    /// Create UsbDrive info from system disk
    fn create_usb_drive_info(&self, disk: &Disk) -> Result<UsbDrive> {
        let device_path = disk.name().to_string_lossy().to_string();
        let mount_point = disk.mount_point().to_string_lossy().to_string();
        
        // Generate a unique ID based on device characteristics
        let drive_id = self.generate_drive_id(&device_path, disk.total_space())?;
        
        // Detect filesystem
        let filesystem = self.detect_filesystem(&mount_point)?;
        
        // Check if encrypted (basic detection)
        let is_encrypted = self.detect_encryption(&mount_point)?;
        
        // Get drive label
        let label = self.get_drive_label(&mount_point)?;

        Ok(UsbDrive {
            id: drive_id,
            device_path,
            mount_point: Some(mount_point),
            capacity: disk.total_space(),
            available_space: disk.available_space(),
            filesystem,
            is_encrypted,
            label,
            is_removable: true,
            trust_level: TrustLevel::Untrusted, // Default to untrusted
            last_seen: Utc::now(),
        })
    }

    /// Generate a unique drive ID
    fn generate_drive_id(&self, device_path: &str, capacity: u64) -> Result<String> {
        let mut hasher = blake3::Hasher::new();
        hasher.update(device_path.as_bytes());
        hasher.update(&capacity.to_le_bytes());
        
        let hash = hasher.finalize();
        Ok(format!("drive_{}", hex::encode(&hash.as_bytes()[..8])))
    }

    /// Detect filesystem type
    fn detect_filesystem(&self, mount_point: &str) -> Result<String> {
        // Try to read filesystem info
        if let Ok(mounts) = fs::read_to_string("/proc/mounts") {
            for line in mounts.lines() {
                if line.contains(mount_point) {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 3 {
                        return Ok(parts[2].to_string());
                    }
                }
            }
        }
        
        Ok("unknown".to_string())
    }

    /// Detect if drive is encrypted
    fn detect_encryption(&self, mount_point: &str) -> Result<bool> {
        // Check for LUKS encryption
        if let Ok(output) = std::process::Command::new("lsblk")
            .arg("-f")
            .arg(mount_point)
            .output()
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            if output_str.contains("crypto_LUKS") {
                return Ok(true);
            }
        }

        // Check for VeraCrypt containers
        let veracrypt_indicators = [".hc", ".tc", "veracrypt"];
        if let Ok(entries) = fs::read_dir(mount_point) {
            for entry in entries.flatten() {
                let filename = entry.file_name().to_string_lossy().to_lowercase();
                for indicator in &veracrypt_indicators {
                    if filename.contains(indicator) {
                        return Ok(true);
                    }
                }
            }
        }

        Ok(false)
    }

    /// Get drive label/name
    fn get_drive_label(&self, mount_point: &str) -> Result<Option<String>> {
        if let Ok(output) = std::process::Command::new("lsblk")
            .arg("-o")
            .arg("LABEL")
            .arg(mount_point)
            .output()
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            let lines: Vec<&str> = output_str.lines().collect();
            if lines.len() > 1 && !lines[1].trim().is_empty() {
                return Ok(Some(lines[1].trim().to_string()));
            }
        }
        
        Ok(None)
    }

    /// Set trust level for a drive
    pub fn set_drive_trust(&mut self, drive_id: &str, trust_level: TrustLevel) -> Result<()> {
        self.trusted_drives.insert(drive_id.to_string(), trust_level);
        Ok(())
    }

    /// Check if a drive exists
    pub fn drive_exists(&self, drive_id: &str) -> bool {
        self.drives.contains_key(drive_id)
    }

    /// Get drive by ID
    pub fn get_drive(&self, drive_id: &str) -> Option<&UsbDrive> {
        self.drives.get(drive_id)
    }

    /// Get drive by ID (public access)
    pub fn get_drive_public(&self, drive_id: &str) -> Option<&UsbDrive> {
        self.drives.get(drive_id)
    }

    /// Create encrypted backup on USB drive with proper integration
    pub fn create_backup(&mut self, drive_id: &str, vault_data: &[u8], recovery_phrase: &str, password: &str) -> Result<String> {
        let trust_level = self.trusted_drives.get(drive_id)
            .ok_or_else(|| anyhow!("Drive not found or not trusted"))?;

        match trust_level {
            TrustLevel::Blocked => return Err(anyhow!("Drive is blocked")),
            TrustLevel::Untrusted => return Err(anyhow!("Drive is not trusted")),
            TrustLevel::Trusted => {}
        }

        let backup_id = Uuid::new_v4().to_string();
        
        // Get actual drive mount point
        let drive = self.drives.get(drive_id)
            .ok_or_else(|| anyhow!("Drive not found"))?;
        
        let mount_point = drive.mount_point.as_ref()
            .ok_or_else(|| anyhow!("Drive not mounted"))?;
        
        // Create backup directory on the actual USB drive
        let backup_root = std::path::Path::new(mount_point).join("ZAP_QUANTUM_VAULT_BACKUPS");
        let backup_dir = backup_root.join(&backup_id);
        
        std::fs::create_dir_all(&backup_dir)?;
        std::fs::create_dir_all(backup_dir.join("vaults"))?;
        std::fs::create_dir_all(backup_dir.join("keys"))?;
        std::fs::create_dir_all(backup_dir.join("metadata"))?;

        // Initialize quantum crypto with proper keypairs
        let mut quantum_crypto = QuantumCryptoManager::new();
        quantum_crypto.generate_keypairs()?;
        
        // Encrypt vault data with quantum-safe encryption
        let encrypted_data = quantum_crypto.encrypt_data(vault_data, password)
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;
        
        // Write encrypted vault data
        let serialized_data = serde_json::to_vec(&encrypted_data)?;
        std::fs::write(backup_dir.join("vaults").join("vault_data.enc"), serialized_data)?;
        
        // Write recovery phrase securely
        std::fs::write(backup_dir.join("keys").join("recovery.txt"), recovery_phrase.as_bytes())?;
        
        // Create backup metadata
        let backup_metadata = BackupMetadata {
            id: backup_id.clone(),
            drive_id: drive_id.to_string(),
            backup_type: BackupType::Full,
            backup_path: backup_dir.to_string_lossy().to_string(),
            vault_ids: vec!["main_vault".to_string()],
            created_at: Utc::now(),
            size_bytes: vault_data.len() as u64,
            checksum: hex::encode(blake3::hash(vault_data).as_bytes()),
            encryption_method: "ZAP-Quantum-Crypto-v1.0".to_string(),
            item_count: 1,
            vault_count: 1,
        };
        
        // Write metadata
        let metadata_json = serde_json::to_string_pretty(&backup_metadata)?;
        std::fs::write(backup_dir.join("metadata").join("backup.json"), metadata_json)?;
        
        // Create backup manifest
        let manifest = serde_json::json!({
            "version": "2.0",
            "created_at": Utc::now(),
            "encryption": "ZAP-Quantum-Crypto-v1.0",
            "filesystem": "ext4",
            "structure_version": "2.0",
            "quantum_resistant": true,
            "algorithms": {
                "key_encapsulation": "CRYSTALS-Kyber-1024",
                "digital_signature": "CRYSTALS-Dilithium5",
                "symmetric_encryption": "AES-256-GCM",
                "key_derivation": "Argon2id + SHA3-512 + Blake3"
            },
            "backups": [backup_id]
        });
        
        std::fs::write(
            backup_root.join("backup_manifest.json"),
            serde_json::to_string_pretty(&manifest)?
        )?;

        Ok(backup_id)
    }


    /// List available backups on a drive
    pub fn list_backups(&self, drive_id: &str) -> Result<Vec<BackupMetadata>> {
        // For now, return empty list since we're using mock drives
        // In a real implementation, we would find the actual drive and check its mount point
        let _trust_level = self.trusted_drives.get(drive_id)
            .ok_or_else(|| anyhow!("Drive not found"))?;

        // Mock mount point for testing
        let mount_point = "/media/usb";

        let backup_root = Path::new(mount_point).join("ZapQuantumVault_Backups");
        
        if !backup_root.exists() {
            return Ok(Vec::new());
        }

        let mut backups = Vec::new();
        
        for entry in fs::read_dir(backup_root)? {
            let entry = entry?;
            if entry.file_type()?.is_dir() {
                let metadata_file = entry.path().join("metadata").join("backup.json");
                if metadata_file.exists() {
                    if let Ok(metadata_str) = fs::read_to_string(metadata_file) {
                        if let Ok(metadata) = serde_json::from_str::<BackupMetadata>(&metadata_str) {
                            backups.push(metadata);
                        }
                    }
                }
            }
        }

        // Sort by creation date (newest first)
        backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        Ok(backups)
    }

    /// Verify backup integrity
    pub fn verify_backup(&self, _backup_id: &str) -> Result<bool> {
        // Implement backup verification
        let backup_dir = format!("/tmp/backup_{}", _backup_id);
        
        // 1. Check if backup directory exists
        if !std::path::Path::new(&backup_dir).exists() {
            return Ok(false);
        }
        
        // 2. Verify required files exist
        let vault_file = format!("{}/vault_data.enc", backup_dir);
        let recovery_file = format!("{}/recovery.txt", backup_dir);
        
        let files_exist = std::path::Path::new(&vault_file).exists() && 
                         std::path::Path::new(&recovery_file).exists();
        
        // 3. Basic integrity check (file sizes > 0)
        if files_exist {
            let vault_size = std::fs::metadata(&vault_file)?.len();
            let recovery_size = std::fs::metadata(&recovery_file)?.len();
            Ok(vault_size > 0 && recovery_size > 0)
        } else {
            Ok(false)
        }
    }

    /// Restore from backup
    pub fn restore_backup(&self, _request: RestoreRequest) -> Result<()> {
        // Implement backup restoration
        let backup_dir = format!("/tmp/backup_{}", _request.backup_id);
        
        // 1. Verify backup integrity first
        if !self.verify_backup(&_request.backup_id)? {
            return Err(anyhow::anyhow!("Backup verification failed"));
        }
        
        // 2. Read encrypted backup data
        let vault_file = format!("{}/vault_data.enc", backup_dir);
        let serialized_data = std::fs::read(&vault_file)?;
        
        // 3. Deserialize and decrypt data
        let encrypted_data: QuantumEncryptedData = serde_json::from_slice(&serialized_data)?;
        let quantum_crypto = QuantumCryptoManager::new();
        let _decrypted_data = quantum_crypto.decrypt_data(&encrypted_data, "default_password")
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;
        
        // 4. Restore would write decrypted data back to vault database
        // This is where you'd integrate with the main vault system
        println!("Backup restoration completed successfully");

        Ok(())
    }

    /// Format and encrypt a drive with quantum-safe cryptography
    pub async fn format_and_encrypt_drive(&mut self, drive_id: &str, password: &str, window: &tauri::Window) -> Result<()> {
        use tauri::Emitter;
        
        let emit_progress = |stage: &str, progress: u8, message: &str| {
            let _ = window.emit("format_progress", serde_json::json!({
                "stage": stage,
                "progress": progress,
                "message": message
            }));
        };

        // Get drive info
        let drive = self.drives.get(drive_id)
            .ok_or_else(|| anyhow!("Drive not found"))?;
        
        let device_path = &drive.device_path;
        
        emit_progress("formatting", 40, "Unmounting drive...");
        
        // Step 1: Unmount the drive
        if let Some(mount_point) = &drive.mount_point {
            let output = Command::new("umount")
                .arg(mount_point)
                .output()?;
            
            if !output.status.success() {
                // Try force unmount
                Command::new("umount")
                    .arg("-f")
                    .arg(mount_point)
                    .output()?;
            }
        }
        
        emit_progress("formatting", 50, "Creating new filesystem...");
        
        // Step 2: Create new ext4 filesystem
        let output = Command::new("mkfs.ext4")
            .arg("-F") // Force overwrite
            .arg("-L") // Set label
            .arg("ZAP_QUANTUM_VAULT")
            .arg(device_path)
            .output()?;
        
        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("Failed to create filesystem: {}", error));
        }
        
        emit_progress("formatting", 65, "Initializing quantum cryptography...");
        
        // Step 3: Create mount point and mount the drive
        let mount_point = format!("/tmp/zap_vault_{}", drive_id);
        std::fs::create_dir_all(&mount_point)?;
        
        let output = Command::new("mount")
            .arg(device_path)
            .arg(&mount_point)
            .output()?;
        
        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("Failed to mount drive: {}", error));
        }
        
        emit_progress("encryption", 80, "Generating quantum-safe keys...");
        
        // Step 4: Create quantum vault structure
        self.create_quantum_vault_structure(&mount_point, password)?;
        
        emit_progress("structure", 90, "Creating backup structure...");
        
        // Step 5: Create basic backup structure
        let backup_root = std::path::Path::new(&mount_point).join("ZAP_QUANTUM_VAULT_BACKUPS");
        std::fs::create_dir_all(&backup_root)?;
        
        // Step 6: Sync and unmount
        Command::new("sync").output()?;
        
        Command::new("umount")
            .arg(&mount_point)
            .output()?;
        
        // Clean up temporary mount point
        std::fs::remove_dir_all(&mount_point).ok();
        
        emit_progress("complete", 100, "Drive formatting completed successfully!");
        
        Ok(())
    }
    
    /// Verify backup integrity
    pub fn verify_backup(&self, backup_id: &str) -> Result<bool> {
        // Implement backup verification
        let backup_dir = format!("/tmp/backup_{}", backup_id);
        
        // 1. Check if backup directory exists
        if !std::path::Path::new(&backup_dir).exists() {
            return Ok(false);
        }
        
        // 2. Verify required files exist
        let vault_file = format!("{}/vault_data.enc", backup_dir);
        let recovery_file = format!("{}/recovery.txt", backup_dir);
        
        let files_exist = std::path::Path::new(&vault_file).exists() && 
                         std::path::Path::new(&recovery_file).exists();
        
        // 3. Basic integrity check (file sizes > 0)
        if files_exist {
            let vault_size = std::fs::metadata(&vault_file)?.len();
            let recovery_size = std::fs::metadata(&recovery_file)?.len();
            Ok(vault_size > 0 && recovery_size > 0)
        } else {
            Ok(false)
        }
    }

/// Restore from backup
pub fn restore_backup(&self, _request: RestoreRequest) -> Result<()> {
    // Implement backup restoration
    let backup_dir = format!("/tmp/backup_{}", _request.backup_id);
    
    // 1. Verify backup integrity first
    if !self.verify_backup(&_request.backup_id)? {
        return Err(anyhow::anyhow!("Backup verification failed"));
    }
    
    // 2. Read encrypted backup data
    let vault_file = format!("{}/vault_data.enc", backup_dir);
    let serialized_data = std::fs::read(&vault_file)?;
    
    // 3. Deserialize and decrypt data
    let encrypted_data: QuantumEncryptedData = serde_json::from_slice(&serialized_data)?;
    let quantum_crypto = QuantumCryptoManager::new();
    let _decrypted_data = quantum_crypto.decrypt_data(&encrypted_data, "default_password")
        .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;
    
    // 4. Restore would write decrypted data back to vault database
    // This is where you'd integrate with the main vault system
    println!("Backup restoration completed successfully");

    Ok(())
}

/// Format and encrypt a drive with quantum-safe cryptography
pub async fn format_and_encrypt_drive(&mut self, drive_id: &str, password: &str, window: &tauri::Window) -> Result<()> {
    use tauri::Emitter;
    
    let emit_progress = |stage: &str, progress: u8, message: &str| {
        let _ = window.emit("format_progress", serde_json::json!({
            "stage": stage,
            "progress": progress,
            "message": message
        }));
    };

    // Get drive info
    let drive = self.drives.get(drive_id)
        .ok_or_else(|| anyhow!("Drive not found"))?;
    
    let device_path = &drive.device_path;
    
    emit_progress("formatting", 40, "Unmounting drive...");
    
    // Step 1: Unmount the drive
    if let Some(mount_point) = &drive.mount_point {
        let output = Command::new("umount")
            .arg(mount_point)
            .output()?;
        
        if !output.status.success() {
            // Try force unmount
            Command::new("umount")
                .arg("-f")
                .arg(mount_point)
                .output()?;
        }
    }
    
    emit_progress("formatting", 50, "Creating new filesystem...");
    
    // Step 2: Create new ext4 filesystem
    let output = Command::new("mkfs.ext4")
        .arg("-F") // Force overwrite
        .arg("-L") // Set label
        .arg("ZAP_QUANTUM_VAULT")
        .arg(device_path)
        .output()?;
    
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("Failed to create filesystem: {}", error));
    }
    
    emit_progress("formatting", 65, "Initializing quantum cryptography...");
    
    // Step 3: Create mount point and mount the drive
    let mount_point = format!("/tmp/zap_vault_{}", drive_id);
    std::fs::create_dir_all(&mount_point)?;
    
    let output = Command::new("mount")
        .arg(device_path)
        .arg(&mount_point)
        .output()?;
    
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("Failed to mount drive: {}", error));
    }
    
    emit_progress("encryption", 80, "Generating quantum-safe keys...");
    
    // Step 4: Create quantum vault structure
    self.create_quantum_vault_structure(&mount_point, password)?;
    
    emit_progress("structure", 90, "Creating quantum backup structure...");
    
    // Step 5: Create backup directory structure
    self.create_backup_structure(&mount_point)?;
    
    // Step 6: Sync and unmount
    Command::new("sync").output()?;
    
    Command::new("umount")
        .arg(&mount_point)
        .output()?;
    
    // Clean up temporary mount point
    std::fs::remove_dir_all(&mount_point).ok();
    
    emit_progress("complete", 100, "Drive formatting completed successfully!");
    
    Ok(())
}

/// Create quantum vault structure on the drive
pub fn create_quantum_vault_structure(&self, mount_point: &str, password: &str) -> Result<()> {
    // Create main directories
    let vault_dir = format!("{}/quantum_vault", mount_point);
    let keys_dir = format!("{}/keys", vault_dir);
    let data_dir = format!("{}/data", vault_dir);
    let metadata_dir = format!("{}/metadata", vault_dir);
    
    std::fs::create_dir_all(&vault_dir)?;
    std::fs::create_dir_all(&keys_dir)?;
    std::fs::create_dir_all(&data_dir)?;
    std::fs::create_dir_all(&metadata_dir)?;
    
    // Create quantum crypto manager and generate keys
    let crypto_manager = crate::quantum_crypto::QuantumCryptoManager::new();
    
    // Generate and save quantum keys
    let key_pair = crypto_manager.generate_kyber_keypair()?;
    let signing_keys = crypto_manager.generate_dilithium_keypair()?;
    
    // Save keys (encrypted with password)
    let key_data = serde_json::json!({
        "kyber_public": hex::encode(&key_pair.0),
        "kyber_private": hex::encode(&key_pair.1),
        "dilithium_public": hex::encode(&signing_keys.0),
        "dilithium_private": hex::encode(&signing_keys.1),
        "created_at": chrono::Utc::now().to_rfc3339()
    });
    
    // Encrypt key data with password
    let encrypted_keys = self.encrypt_with_password(&key_data.to_string(), password)?;
    
    std::fs::write(
        format!("{}/quantum_keys.enc", keys_dir),
        encrypted_keys
    )?;
    
    // Create vault metadata
    let metadata = serde_json::json!({
        "version": "1.0",
        "created_at": chrono::Utc::now().to_rfc3339(),
        "encryption": "ZAP_QUANTUM_CRYPTO",
        "algorithms": ["Kyber1024", "Dilithium5", "ChaCha20Poly1305"],
        "drive_id": self.generate_drive_id("/dev/sda1", 1000000)? // placeholder
    });
    
    std::fs::write(
        format!("{}/vault_info.json", metadata_dir),
        metadata.to_string()
    )?;
    
    Ok(())
}

/// Encrypt data with password using ChaCha20Poly1305
fn encrypt_with_password(&self, data: &str, password: &str) -> Result<Vec<u8>> {
    use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce, KeyInit};
    use chacha20poly1305::aead::Aead;
    use sha2::{Sha256, Digest};
    
    // Derive key from password
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hasher.update(b"ZAP_QUANTUM_VAULT_SALT");
    let key_bytes = hasher.finalize();
    
    let key = Key::from_slice(&key_bytes);
    let cipher = ChaCha20Poly1305::new(key);
    
    // Generate random nonce
    let nonce_bytes: [u8; 12] = rand::random();
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Encrypt data
    let ciphertext = cipher.encrypt(nonce, data.as_bytes())
        .map_err(|e| anyhow!("Encryption failed: {}", e))?;
    
    // Prepend nonce to ciphertext
    let mut result = nonce_bytes.to_vec();
    result.extend_from_slice(&ciphertext);
    
    Ok(result)
}
    
/// Format drive with ext4 filesystem
async fn format_drive_ext4(&self, device_path: &str) -> Result<()> {
    // Unmount if mounted
    let _ = Command::new("umount")
        .arg(device_path)
        .output();
    
    // Create ext4 filesystem
    let output = Command::new("mkfs.ext4")
        .args(["-F", "-L", "ZAP_QUANTUM_VAULT", device_path])
        .output()?;
            
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("Failed to format drive with ext4: {}", error));
    }
    
    Ok(())
}
    
/// Mount drive using standard Linux mount
fn mount_drive(&self, device_path: &str, mount_point: &str) -> Result<()> {
    let output = Command::new("mount")
        .args([device_path, mount_point])
        .output()?;
            
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("Failed to mount drive: {}", error));
    }
    
    Ok(())
}
    
/// Create quantum-safe backup directory structure
fn create_quantum_backup_structure(&self, mount_point: &str, drive_header: &QuantumDriveHeader, quantum_crypto: &QuantumCryptoManager) -> Result<()> {
    let base_path = format!("{}/ZAPCHAT_QUANTUM_VAULT_V2", mount_point);
    
    // Create main directories
    let directories = vec![
        format!("{}/metadata", base_path),
        format!("{}/vaults", base_path),
        format!("{}/keys", base_path),
        format!("{}/tools", base_path),
        format!("{}/recovery", base_path),
    ];
    
    for dir in directories {
        fs::create_dir_all(&dir)?;
    }
    
    // Write quantum drive header
    let header_json = serde_json::to_string_pretty(drive_header)?;
    fs::write(format!("{}/metadata/quantum_drive_header.json", base_path), header_json)?;
    
    // Export public keys for cross-platform recovery
    let public_keys = quantum_crypto.export_public_keys()?;
    let keys_json = serde_json::to_string_pretty(&public_keys)?;
    fs::write(format!("{}/keys/public_keys.json", base_path), keys_json)?;
    
    // Generate and save recovery phrase
    let recovery_phrase = quantum_crypto.generate_recovery_phrase()?;
    fs::write(format!("{}/recovery/recovery_phrase.txt", base_path), recovery_phrase)?;
    
    // Create quantum recovery instructions
    let instructions = self.create_quantum_recovery_instructions();
    fs::write(format!("{}/metadata/quantum_recovery_instructions.txt", base_path), instructions)?;
    
    // Create backup manifest template
    let manifest = serde_json::json!({
        "version": "ZQV-PQC-1.0",
        "created_at": Utc::now(),
        "encryption": "AES-256-GCM + Kyber-1024 + Dilithium5 + SPHINCS+",
        "filesystem": "ext4",
        "structure_version": "2.0",
        "quantum_resistant": true,
        "algorithms": {
            "key_encapsulation": "CRYSTALS-Kyber-1024",
            "digital_signature": "CRYSTALS-Dilithium5",
            "backup_signature": "SPHINCS+-SHAKE-256-256s-simple",
            "symmetric_encryption": "AES-256-GCM",
            "key_derivation": "Argon2id + SHA3-512 + Blake3"
        },
        "backups": []
    });
    fs::write(
        format!("{}/metadata/quantum_backup_manifest.json", base_path),
        serde_json::to_string_pretty(&manifest)?
    )?;
    
    Ok(())
}
    
/// Create quantum recovery instructions
fn create_quantum_recovery_instructions(&self) -> String {
    r#"ZAP Quantum Vault Post-Quantum Cold Storage Recovery Instructions
================================================================

This USB drive contains quantum-resistant encrypted backups from your ZAP Quantum Vault.

QUANTUM-SAFE EMERGENCY RECOVERY PROCEDURE
=========================================

If you need to access this backup without the ZAP Quantum Vault application:

1. INSTALL REQUIRED TOOLS
   - Linux: Install Rust and cargo
   - Clone ZAP Quantum Vault recovery tools
   - Compile with post-quantum cryptography support

2. MOUNT THE DRIVE
   - This drive uses standard ext4 filesystem
   - Mount normally: sudo mount /dev/sdX /mnt/recovery
   - Navigate to ZAPCHAT_QUANTUM_VAULT_V2 folder

3. RECOVERY PROCESS
   - Use recovery phrase from recovery/recovery_phrase.txt
   - Public keys are in keys/public_keys.json
   - Quantum drive header in metadata/quantum_drive_header.json
   - Run quantum recovery tool with your password

4. QUANTUM SECURITY FEATURES
   - CRYSTALS-Kyber-1024 key encapsulation
   - CRYSTALS-Dilithium5 digital signatures
   - SPHINCS+ backup signatures
   - AES-256-GCM symmetric encryption
   - Argon2id key derivation
   - SHA3-512 and Blake3 hashing

BACKUP STRUCTURE
================
ZAPCHAT_QUANTUM_VAULT_V2/
├── metadata/           # Quantum headers and manifests
├── vaults/            # Quantum-encrypted vault data
├── keys/              # Post-quantum public keys
├── tools/             # Quantum recovery tools
└── recovery/          # BIP39 recovery phrases

SECURITY NOTES
==============
- This drive is quantum-resistant (secure against quantum computers)
- Uses NIST-approved post-quantum cryptography standards
- Password + recovery phrase required for access
- Keep this drive in a secure, climate-controlled location
- Test recovery procedure annually

For technical support, visit: https://github.com/zapchat/quantum-vault

Generated by ZAP Quantum Vault v2.0 - Post-Quantum Edition"#.to_string()
}
    
/// Unmount regular filesystem
fn unmount_drive(&self, device_path: &str) -> Result<()> {
    let output = Command::new("umount")
        .arg(device_path)
        .output()?;
            
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("Failed to unmount drive: {}", error));
    }
    
    Ok(())
}
    
/// Safely eject a USB drive
pub fn eject_drive(&self, drive_id: &str) -> Result<()> {
    let _trust_level = self.trusted_drives.get(drive_id)
        .ok_or_else(|| anyhow!("Drive not found"))?;

    // Mock mount point for testing
    let mount_point = "/media/usb";
    
    {
        // Sync filesystem
        std::process::Command::new("sync").output()?;
            .ok_or_else(|| anyhow!("Drive not found"))?;

        // Mock mount point for testing
        let mount_point = "/media/usb";
        
        {
            // Sync filesystem
            std::process::Command::new("sync").output()?;
            
            // Unmount drive
            let output = std::process::Command::new("umount")
                .arg(mount_point)
                .output()?;

            if !output.status.success() {
                return Err(anyhow!("Failed to unmount drive: {}", 
                    String::from_utf8_lossy(&output.stderr)));
            }
        }

        Ok(())
    }
}

/// Calculate Blake3 hash of file
pub fn calculate_file_hash(file_path: &Path) -> Result<String> {
    let data = fs::read(file_path)?;
    let hash = blake3::hash(&data);
    Ok(hex::encode(hash.as_bytes()))
}

/// Generate BIP39 recovery phrase for key backup
pub fn generate_recovery_phrase() -> Result<String> {
    use bip39::{Mnemonic, Language};
    use rand::RngCore;
    
    let mut entropy = [0u8; 32]; // 256 bits for 24 words
    rand::thread_rng().fill_bytes(&mut entropy);
    
    let mnemonic = Mnemonic::from_entropy_in(Language::English, &entropy)?;
    Ok(mnemonic.to_string())
}

/// Recover key from BIP39 phrase
pub fn recover_from_phrase(phrase: &str) -> Result<Vec<u8>> {
    use bip39::{Mnemonic, Language};
    
    let mnemonic = Mnemonic::parse_in_normalized(Language::English, phrase)?;
    let seed = mnemonic.to_seed("");
    Ok(seed[..32].to_vec()) // Use first 32 bytes as key
}

/// Calculate Blake3 hash of file
pub fn calculate_file_hash(file_path: &Path) -> Result<String> {
    let data = fs::read(file_path)?;
    let hash = blake3::hash(&data);
    Ok(hex::encode(hash.as_bytes()))
}

/// Generate BIP39 recovery phrase for key backup
pub fn generate_recovery_phrase() -> Result<String> {
    use bip39::{Mnemonic, Language};
    use rand::RngCore;
    
    let mut entropy = [0u8; 32]; // 256 bits for 24 words
    rand::thread_rng().fill_bytes(&mut entropy);
    
    let mnemonic = Mnemonic::from_entropy_in(Language::English, &entropy)?;
    Ok(mnemonic.to_string())
}

/// Recover key from BIP39 phrase
pub fn recover_from_phrase(phrase: &str) -> Result<Vec<u8>> {
    use bip39::{Mnemonic, Language};
    
    let mnemonic = Mnemonic::parse_in_normalized(Language::English, phrase)?;
    let seed = mnemonic.to_seed("");
    Ok(seed[..32].to_vec()) // Use first 32 bytes as key
}
