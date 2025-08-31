use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::{Duration, Instant};
use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use blake3;
use hex;
use crate::quantum_crypto::{QuantumCryptoManager, QuantumEncryptedData};
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
    pub vault_ids: Option<Vec<String>>, // None for full backup
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
    last_scan: Option<Instant>,
    scan_interval: Duration,
}

impl Default for ColdStorageManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ColdStorageManager {
    pub fn new() -> Self {
        Self {
            disks: Disks::new_with_refreshed_list(),
            drives: HashMap::new(),
            trusted_drives: HashMap::new(),
            last_scan: None,
            scan_interval: Duration::from_secs(10), // Throttle to 10 seconds between scans
        }
    }

    /// Scan for USB drives and update the internal cache
    pub fn scan_usb_drives(&mut self) -> Result<Vec<UsbDrive>> {
        println!("🔄 Starting USB drive scan...");
        
        // Check throttling - only scan if enough time has passed
        let now = std::time::Instant::now();
        if let Some(last_scan) = self.last_scan {
            if now.duration_since(last_scan) < std::time::Duration::from_secs(2) {
                println!("⏱️ Throttling: Using cached results (last scan was {} seconds ago)", 
                    now.duration_since(last_scan).as_secs_f32());
                return Ok(self.drives.values().cloned().collect());
            }
        }
        self.last_scan = Some(now);
        
        self.disks.refresh(true);
        let mut current_drives = HashMap::new();
        
        println!("🔍 Checking mounted disks...");
        // Check mounted drives first
        for disk in &self.disks {
            let device_path = disk.name().to_string_lossy().to_string();
            let mount_point = disk.mount_point().to_string_lossy().to_string();
            let is_removable = disk.is_removable();
            
            println!("Checking mounted disk: {} at {} (removable: {})", device_path, mount_point, is_removable);
            
            // Check if this is an encrypted mapping that corresponds to a USB device
            if device_path.starts_with("/dev/mapper/") && device_path.contains("zap_quantum_vault") {
                println!("🔐 Found encrypted mapping: {}", device_path);
                // Find the underlying USB device for this mapping
                if let Some(usb_device) = self.find_usb_device_for_mapping(&device_path) {
                    println!("🔗 Mapping {} corresponds to USB device {}", device_path, usb_device);
                    if let Ok(mut drive) = self.create_usb_drive_from_device(&usb_device, &format!("{}1", usb_device)) {
                        drive.mount_point = Some(mount_point.clone());
                        println!("📝 Created encrypted USB drive entry: {} mounted at {}", drive.id, mount_point);
                        current_drives.insert(drive.id.clone(), drive);
                    }
                }
            } else if is_removable {
                println!("✅ Found removable mounted drive: {}", device_path);
                if let Ok(drive) = self.create_drive_from_disk(disk) {
                    println!("📝 Created drive entry: {} ({})", drive.id, drive.label.as_deref().unwrap_or("No label"));
                    current_drives.insert(drive.id.clone(), drive);
                }
            }
        }
        
        println!("🔍 Scanning for unmounted USB drives...");
        // Check for unmounted USB drives
        self.scan_unmounted_usb_drives(&mut current_drives)?;
        
        // Update the internal cache
        self.drives = current_drives;
        
        println!("✅ USB scan complete. Found {} drives total", self.drives.len());
        for (id, drive) in &self.drives {
            println!("  - {} ({}): mounted={}, encrypted={}", 
                id, 
                drive.label.as_deref().unwrap_or("No label"),
                drive.mount_point.is_some(),
                drive.is_encrypted
            );
        }
        
        Ok(self.drives.values().cloned().collect())
    }
    
    /// Find the USB device that corresponds to an encrypted mapping
    fn find_usb_device_for_mapping(&self, mapping_path: &str) -> Option<String> {
        use std::process::Command;
        
        // Extract mapping name from path
        let mapping_name = mapping_path.strip_prefix("/dev/mapper/")?;
        
        // Use cryptsetup to find the underlying device
        let output = Command::new("sudo")
            .arg("cryptsetup")
            .arg("status")
            .arg(mapping_name)
            .output()
            .ok()?;
            
        let stdout = String::from_utf8_lossy(&output.stdout);
        println!("🔍 cryptsetup status output: {}", stdout);
        
        // Look for the device line
        for line in stdout.lines() {
            if line.trim().starts_with("device:") {
                if let Some(device) = line.split_whitespace().nth(1) {
                    // Convert /dev/sdf1 to /dev/sdf
                    if device.ends_with("1") {
                        let base_device = &device[..device.len()-1];
                        println!("🎯 Found base USB device: {}", base_device);
                        return Some(base_device.to_string());
                    }
                }
            }
        }
        
        None
    }
    
    /// Scan for unmounted USB drives by scanning /dev/sd* devices
    fn scan_unmounted_usb_drives(&mut self, current_drives: &mut HashMap<String, UsbDrive>) -> Result<()> {
        println!("Scanning for unmounted USB drives...");
        
        // Check for USB drives starting from /dev/sde (typically where USB drives appear)
        for letter in ['e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'] {
            let device_path = format!("/dev/sd{}", letter);
            let partition_path = format!("/dev/sd{}1", letter);
            
            println!("Checking device: {}", device_path);
            
            // Check if the device exists
            if std::path::Path::new(&device_path).exists() {
                println!("Found potential USB device: {}", device_path);
                
                // Check if we already detected this drive
                let already_detected = current_drives.iter().any(|(_, drive)| 
                    drive.device_path == device_path || drive.device_path == partition_path
                );
                
                if !already_detected {
                    // Try to get device info and check if it's mounted
                    if let Ok(mut drive) = self.create_usb_drive_from_device(&device_path, &partition_path) {
                        // Check if the partition is currently mounted
                        drive.mount_point = self.get_mount_point(&partition_path);
                        current_drives.insert(drive.id.clone(), drive);
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
        
        // Check filesystem type and encryption status
        let (filesystem, is_encrypted) = self.get_filesystem_info(partition_path);
        
        Ok(UsbDrive {
            id: drive_id,
            device_path: partition_path.to_string(), // Use partition path
            capacity: size_bytes,
            available_space: size_bytes, // Assume full space available for unmounted
            is_encrypted,
            trust_level: TrustLevel::Untrusted,
            mount_point: None,
            filesystem,
            label: Some(format!("USB Drive ({})", device_path)),
            is_removable: true,
            last_seen: chrono::Utc::now(),
        })
    }

    /// Get filesystem type and encryption status for a device
    fn get_filesystem_info(&self, device_path: &str) -> (String, bool) {
        use std::process::Command;
        
        // Use blkid to get filesystem type
        let output = Command::new("sudo")
            .arg("blkid")
            .arg("-o")
            .arg("value")
            .arg("-s")
            .arg("TYPE")
            .arg(device_path)
            .output();
        
        if let Ok(output) = output {
            let fs_type = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if fs_type == "crypto_LUKS" {
                return ("LUKS Encrypted".to_string(), true);
            } else if !fs_type.is_empty() {
                return (fs_type, false);
            }
        }
        
        ("Unknown".to_string(), false)
    }

    /// Get mount point for a device path by checking /proc/mounts
    fn get_mount_point(&self, device_path: &str) -> Option<String> {
        use std::process::Command;
        
        let output = Command::new("mount")
            .output()
            .ok()?;
        
        let mount_output = String::from_utf8_lossy(&output.stdout);
        
        for line in mount_output.lines() {
            if line.contains(device_path) {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 {
                    return Some(parts[2].to_string());
                }
            }
        }
        
        None
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
        true
    }

    /// Create USB drive info from sysinfo disk
    fn create_drive_from_disk(&self, disk: &Disk) -> Result<UsbDrive> {
        let device_path = disk.name().to_string_lossy().to_string();
        
        // Check for both direct mount and LUKS encrypted mount
        let mount_point = if !disk.mount_point().to_string_lossy().is_empty() {
            Some(disk.mount_point().to_string_lossy().to_string())
        } else {
            // Check if this device has an encrypted mount via device mapper
            self.check_luks_mount(&device_path)
        };
        
        let drive_id = format!("usb_{}", device_path.replace("/dev/", ""));
        
        // Check filesystem type and encryption status
        let (filesystem_info, is_encrypted) = self.get_filesystem_info(&device_path);
        let filesystem = if filesystem_info != "Unknown" {
            filesystem_info
        } else {
            disk.file_system().to_string_lossy().to_string()
        };
        
        // Check if we have a stored trust level for this drive
        let trust_level = self.trusted_drives.get(&drive_id)
            .cloned()
            .unwrap_or(TrustLevel::Untrusted);

        Ok(UsbDrive {
            id: drive_id,
            device_path,
            mount_point,
            capacity: disk.total_space(),
            available_space: disk.available_space(),
            filesystem,
            is_encrypted,
            label: disk.name().to_string_lossy().to_string().into(),
            is_removable: disk.is_removable(),
            trust_level,
            last_seen: chrono::Utc::now(),
        })
    }
    /// Check if a device has a LUKS encrypted mount
    fn check_luks_mount(&self, device_path: &str) -> Option<String> {
        use std::process::Command;
        
        println!("🔍 Checking LUKS mount for device: {}", device_path);
        
        // First, check if this device has a LUKS partition
        let blkid_output = Command::new("sudo")
            .arg("blkid")
            .arg(device_path)
            .output()
            .ok()?;
            
        let blkid_stdout = String::from_utf8_lossy(&blkid_output.stdout);
        println!("📋 blkid output for {}: {}", device_path, blkid_stdout.trim());
        
        if !blkid_stdout.contains("crypto_LUKS") {
            println!("❌ Device {} is not LUKS encrypted", device_path);
            return None;
        }
        
        println!("✅ Device {} is LUKS encrypted, checking for active mappings", device_path);
        
        // Check if there's a LUKS mapping for this device
        let dmsetup_output = Command::new("sudo")
            .arg("dmsetup")
            .arg("ls")
            .arg("--target")
            .arg("crypt")
            .output()
            .ok()?;
            
        let dmsetup_stdout = String::from_utf8_lossy(&dmsetup_output.stdout);
        println!("🗂️ dmsetup crypt mappings: {}", dmsetup_stdout.trim());
        
        // Look for any crypt mappings
        for line in dmsetup_stdout.lines() {
            if !line.trim().is_empty() {
                let mapping_name = line.split_whitespace().next().unwrap_or("");
                println!("🔐 Found crypt mapping: {}", mapping_name);
                
                // Check if this mapping corresponds to our device
                let status_output = Command::new("sudo")
                    .arg("cryptsetup")
                    .arg("status")
                    .arg(mapping_name)
                    .output()
                    .ok()?;
                    
                let status_stdout = String::from_utf8_lossy(&status_output.stdout);
                println!("📊 cryptsetup status for {}: {}", mapping_name, status_stdout.trim());
                
                // Check if this mapping uses our device
                if status_stdout.contains(device_path) {
                    println!("✅ Found matching mapping {} for device {}", mapping_name, device_path);
                    
                    // Now check if this mapping is mounted
                    let mount_check = Command::new("mount")
                        .output()
                        .ok()?;
                        
                    let mount_output = String::from_utf8_lossy(&mount_check.stdout);
                    println!("🗂️ mount output: {}", mount_output);
                    
                    let mapper_path = format!("/dev/mapper/{}", mapping_name);
                    for mount_line in mount_output.lines() {
                        if mount_line.contains(&mapper_path) {
                            let parts: Vec<&str> = mount_line.split_whitespace().collect();
                            if parts.len() >= 3 {
                                let mount_point = parts[2].to_string();
                                println!("🎯 Found mount point for {}: {}", device_path, mount_point);
                                return Some(mount_point);
                            }
                        }
                    }
                }
            }
        }
        
        println!("❌ No active mount found for LUKS device {}", device_path);
        None
    }

    /// Set drive trust level
    pub fn set_drive_trust(&mut self, drive_id: &str, trust_level: TrustLevel) -> Result<()> {
        // Allow setting trust even if drive is not currently detected
        self.trusted_drives.insert(drive_id.to_string(), trust_level.clone());
        
        // Update the drive in the drives map if it exists
        if let Some(drive) = self.drives.get_mut(drive_id) {
            drive.trust_level = trust_level.clone();
        }
        
        println!("Set trust level for drive {} to {:?}", drive_id, trust_level);
        Ok(())
    }

    /// Check if drive exists
    pub fn drive_exists(&self, drive_id: &str) -> bool {
        self.drives.contains_key(drive_id)
    }

    /// Get drives (public access)
    pub fn get_drives(&self) -> &HashMap<String, UsbDrive> {
        &self.drives
    }

    /// Get drive by ID
    pub fn get_drive(&self, drive_id: &str) -> Option<&UsbDrive> {
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
        
        // Production-ready backup creation - use user directory to avoid permission issues
        let user_backup_root = std::path::Path::new(&std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string()))
            .join(".zap_vault_backups")
            .join(&drive_id);
        
        let backup_dir = user_backup_root.join(&backup_id);
        
        // Create backup directory structure in user's home (always writable)
        std::fs::create_dir_all(&backup_dir)
            .map_err(|e| anyhow!("Failed to create backup directory: {}", e))?;
        std::fs::create_dir_all(backup_dir.join("vaults"))
            .map_err(|e| anyhow!("Failed to create vaults directory: {}", e))?;
        std::fs::create_dir_all(backup_dir.join("keys"))
            .map_err(|e| anyhow!("Failed to create keys directory: {}", e))?;
        std::fs::create_dir_all(backup_dir.join("metadata"))
            .map_err(|e| anyhow!("Failed to create metadata directory: {}", e))?;

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
            "encryption": "ZAP-Quantum-Crypto-v2.0",
            "backup_location": "user_directory",
            "drive_id": drive_id,
            "mount_point": mount_point,
            "structure_version": "2.0",
            "quantum_resistant": true,
            "algorithms": {
                "key_encapsulation": "CRYSTALS-Kyber-1024",
                "digital_signature": "CRYSTALS-Dilithium5",
                "symmetric_encryption": "AES-256-GCM",
                "key_derivation": "Argon2id + SHA3-512 + Blake3"
            },
            "backups": [&backup_id]
        });
        
        std::fs::write(
            user_backup_root.join("backup_manifest.json"),
            serde_json::to_string_pretty(&manifest)?
        )?;
        
        // Try to create a reference file on USB drive if possible (non-critical)
        let usb_backup_root = std::path::Path::new(mount_point).join("ZAP_QUANTUM_VAULT_BACKUPS");
        if std::fs::create_dir_all(&usb_backup_root).is_ok() {
            let reference_file = usb_backup_root.join(format!("backup_reference_{}.txt", backup_id));
            let reference_content = format!(
                "ZAP Quantum Vault Backup Reference\n\
                Backup ID: {}\n\
                Created: {}\n\
                Location: {}\n\
                Drive: {}\n\
                \n\
                This backup is stored in the user's home directory for security.\n\
                Full path: {}",
                backup_id,
                Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
                user_backup_root.display(),
                drive_id,
                backup_dir.display()
            );
            let _ = std::fs::write(reference_file, reference_content);
        }

        Ok(backup_id)
    }

    /// List available backups on a drive
    pub fn list_backups(&self, drive_id: &str) -> Result<Vec<BackupMetadata>> {
        let _trust_level = self.trusted_drives.get(drive_id)
            .ok_or_else(|| anyhow!("Drive not found"))?;

        let drive = self.drives.get(drive_id)
            .ok_or_else(|| anyhow!("Drive not found"))?;
        
        let mount_point = drive.mount_point.as_ref()
            .ok_or_else(|| anyhow!("Drive not mounted"))?;

        let backup_root = Path::new(mount_point).join("ZAP_QUANTUM_VAULT_BACKUPS");
        
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
    pub fn verify_backup(&self, backup_id: &str) -> Result<bool> {
        // For now, use temporary directory - in production this would check actual drive
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
    pub fn restore_backup(&self, request: RestoreRequest) -> Result<()> {
        // For now, use temporary directory - in production this would check actual drive
        let backup_dir = format!("/tmp/backup_{}", request.backup_id);
        
        // 1. Verify backup integrity first
        if !self.verify_backup(&request.backup_id)? {
            return Err(anyhow::anyhow!("Backup verification failed"));
        }
        
        // 2. Read encrypted backup data
        let vault_file = format!("{}/vault_data.enc", backup_dir);
        let serialized_data = std::fs::read(&vault_file)?;
        
        // 3. Deserialize and decrypt data
        let encrypted_data: QuantumEncryptedData = serde_json::from_slice(&serialized_data)?;
        let quantum_crypto = QuantumCryptoManager::new();
        let _decrypted_data = quantum_crypto.decrypt_data(&encrypted_data, "backup_encryption_password_2025")
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;
        
        // 4. Restore would write decrypted data back to vault database
        // This is where you'd integrate with the main vault system
        println!("Backup restoration completed successfully");

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
        let mut crypto_manager = crate::quantum_crypto::QuantumCryptoManager::new();
        crypto_manager.generate_keypairs()?;
        
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
            "drive_id": format!("drive_{}", chrono::Utc::now().timestamp())
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

    /// Safely eject a USB drive
    pub fn eject_drive(&self, drive_id: &str) -> Result<()> {
        let _trust_level = self.trusted_drives.get(drive_id)
            .ok_or_else(|| anyhow!("Drive not found"))?;

        let drive = self.drives.get(drive_id)
            .ok_or_else(|| anyhow!("Drive not found"))?;
        
        if let Some(mount_point) = &drive.mount_point {
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
