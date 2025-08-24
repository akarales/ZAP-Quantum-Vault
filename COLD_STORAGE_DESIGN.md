# ZAP Quantum Vault - Cold Storage System Design

## 🧊 **Cold Storage Overview**

The Cold Storage system provides air-gapped backup capabilities for vaults and cryptographic keys using encrypted USB drives. This ensures data survivability even in catastrophic scenarios.

## 🎯 **Core Features**

### **USB Drive Management**
- **Auto-Detection**: Detect plugged USB drives automatically
- **Drive Information**: Show capacity, filesystem, encryption status
- **Multi-Drive Support**: Handle multiple USB drives simultaneously
- **Drive Verification**: Verify drive integrity and compatibility

### **Encryption Options**
- **LUKS Encryption**: Linux native full-disk encryption
- **VeraCrypt Support**: Cross-platform encrypted containers
- **Custom Encryption**: ZAP Quantum Vault native encryption
- **Key Derivation**: PBKDF2/Argon2 for password-based encryption

### **Backup Operations**
- **Full Vault Backup**: Complete vault with all items
- **Selective Backup**: Choose specific vaults/items
- **Incremental Backup**: Only changed data since last backup
- **Key Backup**: Master keys and encryption keys
- **Metadata Backup**: User profiles, settings, audit logs

### **Recovery Operations**
- **Full Restore**: Complete system restoration
- **Selective Restore**: Restore specific vaults/items
- **Key Recovery**: Restore encryption keys
- **Merge Mode**: Merge backup data with existing data
- **Verification**: Verify backup integrity before restore

## 🏗️ **Technical Architecture**

### **Rust Backend Components**

#### **USB Detection Service**
```rust
// USB drive detection and management
pub struct UsbDriveManager {
    drives: Vec<UsbDrive>,
    watcher: DriveWatcher,
}

pub struct UsbDrive {
    pub device_path: String,
    pub mount_point: Option<String>,
    pub capacity: u64,
    pub filesystem: String,
    pub is_encrypted: bool,
    pub label: Option<String>,
}
```

#### **Encryption Service**
```rust
// Drive encryption management
pub struct DriveEncryption {
    pub encryption_type: EncryptionType,
    pub key_derivation: KeyDerivation,
}

pub enum EncryptionType {
    Luks,
    VeraCrypt,
    ZapNative,
}
```

#### **Backup Service**
```rust
// Backup and restore operations
pub struct BackupManager {
    pub backup_format: BackupFormat,
    pub compression: CompressionType,
    pub verification: bool,
}

pub struct BackupMetadata {
    pub timestamp: DateTime<Utc>,
    pub vault_count: u32,
    pub item_count: u32,
    pub backup_size: u64,
    pub checksum: String,
}
```

### **Database Schema Extensions**

```sql
-- Cold storage backup tracking
CREATE TABLE cold_storage_backups (
    id TEXT PRIMARY KEY,
    drive_id TEXT NOT NULL,
    backup_type TEXT NOT NULL, -- 'full', 'incremental', 'selective'
    backup_path TEXT NOT NULL,
    vault_ids TEXT, -- JSON array of vault IDs
    created_at TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    encryption_method TEXT NOT NULL,
    metadata TEXT -- JSON metadata
);

-- USB drive registry
CREATE TABLE registered_drives (
    id TEXT PRIMARY KEY,
    device_id TEXT UNIQUE NOT NULL,
    drive_label TEXT,
    last_seen TEXT NOT NULL,
    trust_level TEXT NOT NULL, -- 'trusted', 'untrusted', 'blocked'
    encryption_status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Backup verification logs
CREATE TABLE backup_verifications (
    id TEXT PRIMARY KEY,
    backup_id TEXT NOT NULL,
    verification_type TEXT NOT NULL, -- 'checksum', 'full_scan', 'quick'
    status TEXT NOT NULL, -- 'passed', 'failed', 'warning'
    details TEXT, -- JSON details
    verified_at TEXT NOT NULL,
    FOREIGN KEY (backup_id) REFERENCES cold_storage_backups(id)
);
```

## 🖥️ **Frontend UI Design**

### **Cold Storage Page Layout**

#### **Drive Detection Panel**
- **Connected Drives**: Grid of detected USB drives
- **Drive Cards**: Show capacity, encryption status, trust level
- **Quick Actions**: Format, encrypt, eject buttons
- **Drive Health**: SMART data, wear indicators

#### **Backup Operations Panel**
- **Backup Type Selection**: Full, Incremental, Selective
- **Vault Selection**: Checkboxes for vault selection
- **Backup Options**: Compression, verification, encryption
- **Progress Tracking**: Real-time backup progress

#### **Recovery Operations Panel**
- **Available Backups**: List backups on selected drive
- **Backup Details**: Timestamp, size, vault count
- **Recovery Options**: Full restore, selective restore, merge
- **Verification**: Pre-restore integrity checks

#### **Security Settings Panel**
- **Encryption Configuration**: LUKS/VeraCrypt settings
- **Key Management**: Backup key generation and storage
- **Trust Management**: Trusted drive whitelist
- **Audit Logging**: Cold storage operation logs

## 🔐 **Security Features**

### **Multi-Layer Encryption**
1. **Drive Encryption**: Full disk encryption (LUKS/VeraCrypt)
2. **Container Encryption**: Encrypted backup containers
3. **Data Encryption**: Individual vault item encryption (existing AES-GCM)
4. **Key Encryption**: Encrypted key backups with separate passwords

### **Trust Management**
- **Drive Whitelisting**: Only trusted drives allowed
- **Device Fingerprinting**: Unique drive identification
- **Tamper Detection**: Detect drive modifications
- **Access Logging**: Log all cold storage operations

### **Key Backup Strategy**
- **Master Key Backup**: Encrypted master keys for vault recovery
- **Key Splitting**: Shamir's Secret Sharing for key distribution
- **Recovery Phrases**: BIP39-style mnemonic phrases
- **Hardware Security**: Optional hardware key storage

## 📋 **User Workflows**

### **Initial Setup Workflow**
1. **Drive Preparation**: Format and encrypt USB drive
2. **Trust Establishment**: Add drive to trusted list
3. **Backup Configuration**: Set backup preferences
4. **Initial Backup**: Create first full backup

### **Regular Backup Workflow**
1. **Drive Connection**: Plug in trusted USB drive
2. **Auto-Detection**: System detects and verifies drive
3. **Backup Selection**: Choose backup type and vaults
4. **Execution**: Perform backup with progress tracking
5. **Verification**: Verify backup integrity
6. **Safe Ejection**: Securely unmount drive

### **Recovery Workflow**
1. **Drive Connection**: Connect backup drive
2. **Backup Discovery**: Scan for available backups
3. **Backup Selection**: Choose backup to restore
4. **Verification**: Verify backup integrity
5. **Recovery Options**: Select full/partial restore
6. **Execution**: Restore data with progress tracking
7. **Validation**: Verify restored data integrity

## 🛠️ **Implementation Plan**

### **Phase 11.2a: USB Drive Detection**
- Implement USB drive detection using `sysinfo` crate
- Create drive management service
- Add drive information gathering
- Implement drive watcher for hot-plug detection

### **Phase 11.2b: Drive Encryption**
- Integrate LUKS encryption support
- Add VeraCrypt container support
- Implement native ZAP encryption
- Create encryption key management

### **Phase 11.2c: Backup System**
- Design backup file format (JSON + encrypted data)
- Implement full vault backup
- Add selective backup capabilities
- Create incremental backup system

### **Phase 11.2d: Cold Storage UI**
- Create ColdStoragePage component
- Build drive detection interface
- Add backup/restore wizards
- Implement progress tracking UI

### **Phase 11.2e: Key Backup System**
- Implement master key backup
- Add Shamir's Secret Sharing
- Create recovery phrase system
- Build key recovery interface

## 🔧 **Dependencies to Add**

```toml
# Cargo.toml additions
sysinfo = "0.30"           # System information and USB detection
cryptsetup = "0.1"         # LUKS encryption support
veracrypt-rs = "0.1"       # VeraCrypt integration (if available)
shamir = "2.0"             # Shamir's Secret Sharing
bip39 = "2.0"              # BIP39 mnemonic phrases
tar = "0.4"                # Archive creation
zstd = "0.13"              # Compression
blake3 = "1.5"             # Fast hashing for checksums
```

## 📊 **Success Metrics**

### **Functionality Metrics**
- ✅ USB drive auto-detection and management
- ✅ Multiple encryption method support
- ✅ Full and incremental backup capabilities
- ✅ Reliable restore operations
- ✅ Backup integrity verification

### **Security Metrics**
- ✅ Multi-layer encryption implementation
- ✅ Trusted drive management
- ✅ Secure key backup and recovery
- ✅ Tamper detection capabilities
- ✅ Comprehensive audit logging

### **Performance Metrics**
- **Backup Speed**: > 50 MB/s for large vaults
- **Verification Speed**: < 5 seconds for backup integrity check
- **Drive Detection**: < 2 seconds for USB plug detection
- **UI Responsiveness**: < 100ms for all UI operations

This Cold Storage system will provide enterprise-grade air-gapped backup capabilities, ensuring your quantum-safe vault data survives any digital catastrophe.
