use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use sysinfo::{System, Disk};
use std::path::{Path, PathBuf};
use std::fs;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use blake3;
use std::collections::HashMap;

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
    pub vault_ids: Option<Vec<String>>, // None for full backup
    pub compression: bool,
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
    #[allow(dead_code)]
    system: System,
    trusted_drives: HashMap<String, TrustLevel>,
}

impl ColdStorageManager {
    pub fn new() -> Self {
        Self {
            system: System::new_all(),
            trusted_drives: HashMap::new(),
        }
    }

    /// Detect all connected USB drives
    pub fn detect_usb_drives(&mut self) -> Result<Vec<UsbDrive>> {
        // For now, create mock USB drives for testing
        // In a real implementation, we would use platform-specific APIs
        let mut usb_drives = Vec::new();
        
        // Create a mock USB drive for testing
        let mock_drive = UsbDrive {
            id: "mock_usb_001".to_string(),
            device_path: "/dev/sdb1".to_string(),
            mount_point: Some("/media/usb".to_string()),
            capacity: 32 * 1024 * 1024 * 1024, // 32GB
            available_space: 28 * 1024 * 1024 * 1024, // 28GB available
            filesystem: "ext4".to_string(),
            is_encrypted: false,
            label: Some("USB Drive".to_string()),
            is_removable: true,
            trust_level: TrustLevel::Untrusted,
            last_seen: Utc::now(),
        };
        
        usb_drives.push(mock_drive);
        Ok(usb_drives)
    }

    /// Check if a disk is a removable USB drive
    #[allow(dead_code)]
    fn is_removable_drive(&self, disk: &Disk) -> bool {
        // Check if the device path indicates a removable drive
        let device_path = disk.name().to_string_lossy();
        
        // Common patterns for USB drives on Linux
        device_path.contains("/dev/sd") && !device_path.contains("/dev/sda") ||
        device_path.contains("/dev/nvme") && device_path.contains("p") ||
        device_path.contains("/media/") ||
        device_path.contains("/mnt/") ||
        disk.is_removable()
    }

    /// Create UsbDrive info from system disk
    #[allow(dead_code)]
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
    #[allow(dead_code)]
    fn generate_drive_id(&self, device_path: &str, capacity: u64) -> Result<String> {
        let mut hasher = blake3::Hasher::new();
        hasher.update(device_path.as_bytes());
        hasher.update(&capacity.to_le_bytes());
        
        let hash = hasher.finalize();
        Ok(format!("drive_{}", hex::encode(&hash.as_bytes()[..8])))
    }

    /// Detect filesystem type
    #[allow(dead_code)]
    fn detect_filesystem(&self, mount_point: &str) -> Result<String> {
        // Try to read filesystem info
        match fs::read_to_string("/proc/mounts") {
            Ok(mounts) => {
                for line in mounts.lines() {
                    if line.contains(mount_point) {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 3 {
                            return Ok(parts[2].to_string());
                        }
                    }
                }
            }
            Err(_) => {}
        }
        
        Ok("unknown".to_string())
    }

    /// Detect if drive is encrypted
    #[allow(dead_code)]
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
    #[allow(dead_code)]
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

    /// Create encrypted backup on USB drive
    pub fn create_backup(&mut self, drive_id: &str, _vault_data: &[u8], _recovery_phrase: &str) -> Result<String> {
        let trust_level = self.trusted_drives.get(drive_id)
            .ok_or_else(|| anyhow!("Drive not found or not trusted"))?;

        match trust_level {
            TrustLevel::Blocked => return Err(anyhow!("Drive is blocked")),
            TrustLevel::Untrusted => return Err(anyhow!("Drive is not trusted")),
            TrustLevel::Trusted => {}
        }

        // Create backup directory
        let backup_id = Uuid::new_v4().to_string();
        // Mock mount point for testing
        let mount_point = "/media/usb";
        let backup_dir = self.create_backup_directory(mount_point, &backup_id)?;

        // Create backup metadata
        let _metadata = BackupMetadata {
            id: backup_id.clone(),
            drive_id: drive_id.to_string(),
            backup_type: BackupType::Full,
            backup_path: backup_dir.to_string_lossy().to_string(),
            vault_ids: Vec::new(), // Default empty for now
            created_at: Utc::now(),
            size_bytes: 0, // Will be updated after backup
            checksum: String::new(), // Will be calculated
            encryption_method: "AES-256-GCM".to_string(),
            item_count: 0,
            vault_count: 0,
        };

        // TODO: Implement actual backup logic
        // This would involve:
        // 1. Encrypting vault data with AES-256-GCM
        // 2. Creating compressed archive
        // 3. Writing to backup directory
        // 4. Updating metadata with actual values

        Ok(backup_id)
    }

    /// Create backup directory structure
    fn create_backup_directory(&self, mount_point: &str, backup_id: &str) -> Result<PathBuf> {

        let backup_root = Path::new(mount_point).join("ZapQuantumVault_Backups");
        let backup_dir = backup_root.join(backup_id);

        fs::create_dir_all(&backup_dir)?;
        
        // Create subdirectories
        fs::create_dir_all(backup_dir.join("vaults"))?;
        fs::create_dir_all(backup_dir.join("keys"))?;
        fs::create_dir_all(backup_dir.join("metadata"))?;

        Ok(backup_dir)
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
        // TODO: Implement backup verification
        // This would involve:
        // 1. Reading backup metadata
        // 2. Calculating checksums of backup files
        // 3. Comparing with stored checksums
        // 4. Verifying encryption integrity
        
        Ok(true) // Placeholder
    }

    /// Restore from backup
    pub fn restore_backup(&self, _request: RestoreRequest) -> Result<()> {
        // TODO: Implement backup restoration
        // This would involve:
        // 1. Verifying backup integrity
        // 2. Reading backup data
        // 3. Decrypting data
        // 4. Decompressing if needed
        // 5. Restoring to database
        // 6. Handling merge mode if requested

        Ok(()) // Placeholder
    }

    /// Format and encrypt a USB drive
    pub fn format_drive(&self, _drive_id: &str, _encryption_type: &str, _password: &str) -> Result<()> {
        // TODO: Implement drive formatting and encryption
        // This would involve:
        // 1. Unmounting the drive
        // 2. Creating encrypted partition (LUKS)
        // 3. Formatting with filesystem
        // 4. Mounting encrypted drive
        // 5. Setting up backup directory structure

        Ok(()) // Placeholder
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
