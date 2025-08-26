# ZAP Quantum Vault - Key Management Architecture

## Overview

This document outlines the SOLID architecture for key generation, storage, and cold storage backup system for the ZAP Quantum Vault.

## Core Architecture Principles

### 1. Single Responsibility Principle (SRP)
- **KeyGenerator**: Only generates cryptographic keys
- **KeyStorage**: Only handles database operations for keys
- **KeyExporter**: Only handles exporting keys to cold storage
- **KeyValidator**: Only validates key integrity and format

### 2. Open/Closed Principle (OCP)
- **KeyGeneratorTrait**: Interface for different key generation algorithms
- **StorageBackendTrait**: Interface for different storage backends
- **ExportFormatTrait**: Interface for different export formats

### 3. Liskov Substitution Principle (LSP)
- All key generators implement the same interface
- All storage backends are interchangeable
- All export formats follow the same contract

### 4. Interface Segregation Principle (ISP)
- Separate interfaces for generation, storage, validation, and export
- Clients only depend on interfaces they use

### 5. Dependency Inversion Principle (DIP)
- High-level modules depend on abstractions, not concretions
- Dependency injection for all services

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/TypeScript)              │
├─────────────────────────────────────────────────────────────┤
│  KeyManagementPage │ KeyGeneratorUI │ ColdStorageBackupUI   │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 Tauri Commands Layer                        │
├─────────────────────────────────────────────────────────────┤
│  generate_key │ store_key │ list_keys │ export_to_usb       │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                Key Management Service                       │
├─────────────────────────────────────────────────────────────┤
│                KeyManagementService                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │KeyGenerator │ │ KeyStorage  │ │  ColdStorageExporter│   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 Storage Layer                               │
├─────────────────────────────────────────────────────────────┤
│    SQLite Database    │         USB Drive Storage           │
│  ┌─────────────────┐  │  ┌─────────────────────────────────┐│
│  │   vault_keys    │  │  │    Encrypted Key Backups       ││
│  │   key_metadata  │  │  │    Recovery Information         ││
│  │   backup_logs   │  │  │    Verification Checksums       ││
│  └─────────────────┘  │  └─────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Key Types & Generation

### 1. Vault Master Keys
- **Purpose**: Encrypt/decrypt vault data
- **Algorithm**: ChaCha20-Poly1305 (256-bit)
- **Derivation**: Argon2id from user password
- **Storage**: Encrypted in database with user-specific salt

### 2. Post-Quantum Keys
- **Key Exchange**: CRYSTALS-Kyber-1024 (3168 bytes)
- **Signatures**: CRYSTALS-Dilithium-5 (4595 bytes)
- **Purpose**: Future-proof quantum-resistant operations
- **Storage**: Separate key pairs with metadata

### 3. Recovery Keys
- **Purpose**: Emergency vault recovery
- **Format**: BIP39 mnemonic phrases (24 words)
- **Derivation**: PBKDF2 from master entropy
- **Storage**: Encrypted with separate recovery password

### 4. Backup Encryption Keys
- **Purpose**: Encrypt data during cold storage backup
- **Algorithm**: AES-256-GCM
- **Generation**: Per-backup unique keys
- **Storage**: Embedded in backup metadata

## Database Schema

```sql
-- Vault keys table
CREATE TABLE vault_keys (
    id TEXT PRIMARY KEY,
    vault_id TEXT NOT NULL,
    key_type TEXT NOT NULL, -- 'master', 'recovery', 'backup', 'quantum'
    algorithm TEXT NOT NULL,
    encrypted_key_data BLOB NOT NULL,
    salt BLOB NOT NULL,
    iv BLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    metadata TEXT -- JSON metadata
);

-- Key metadata and relationships
CREATE TABLE key_metadata (
    key_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    tags TEXT, -- JSON array
    backup_count INTEGER DEFAULT 0,
    last_backup DATETIME,
    security_level TEXT NOT NULL, -- 'standard', 'high', 'quantum'
    FOREIGN KEY (key_id) REFERENCES vault_keys(id)
);

-- Cold storage backup logs
CREATE TABLE backup_logs (
    id TEXT PRIMARY KEY,
    drive_id TEXT NOT NULL,
    key_ids TEXT NOT NULL, -- JSON array of key IDs
    backup_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    size_bytes INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    encryption_method TEXT NOT NULL,
    status TEXT DEFAULT 'completed' -- 'pending', 'completed', 'failed'
);
```

## Implementation Components

### 1. Key Generation Service

```rust
// Key generation traits and implementations
pub trait KeyGenerator {
    fn generate_master_key(&self, password: &str, salt: &[u8]) -> Result<Vec<u8>>;
    fn generate_quantum_keypair(&self) -> Result<(Vec<u8>, Vec<u8>)>;
    fn generate_recovery_phrase(&self) -> Result<String>;
    fn generate_backup_key(&self) -> Result<Vec<u8>>;
}

pub struct QuantumKeyGenerator {
    crypto_manager: QuantumCryptoManager,
}

pub struct StandardKeyGenerator {
    // Standard cryptographic implementations
}
```

### 2. Key Storage Service

```rust
pub trait KeyStorage {
    fn store_key(&self, key: &VaultKey) -> Result<String>;
    fn retrieve_key(&self, key_id: &str) -> Result<VaultKey>;
    fn list_keys(&self, vault_id: &str) -> Result<Vec<KeyMetadata>>;
    fn delete_key(&self, key_id: &str) -> Result<()>;
    fn update_key_metadata(&self, key_id: &str, metadata: &KeyMetadata) -> Result<()>;
}

pub struct SqliteKeyStorage {
    db_pool: SqlitePool,
}
```

### 3. Cold Storage Export Service

```rust
pub trait ColdStorageExporter {
    fn export_keys(&self, key_ids: &[String], drive_path: &str) -> Result<BackupMetadata>;
    fn verify_backup(&self, backup_id: &str) -> Result<bool>;
    fn list_backups(&self, drive_id: &str) -> Result<Vec<BackupMetadata>>;
}

pub struct EncryptedUsbExporter {
    key_storage: Box<dyn KeyStorage>,
    crypto_manager: QuantumCryptoManager,
}
```

## Frontend Implementation

### 1. Key Management Interface

```typescript
// Key management types
interface VaultKey {
  id: string;
  vaultId: string;
  keyType: 'master' | 'recovery' | 'backup' | 'quantum';
  algorithm: string;
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
  metadata: KeyMetadata;
}

interface KeyMetadata {
  name: string;
  description?: string;
  tags: string[];
  backupCount: number;
  lastBackup?: Date;
  securityLevel: 'standard' | 'high' | 'quantum';
}

// Key management hooks
const useKeyManagement = () => {
  const [keys, setKeys] = useState<VaultKey[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  
  const generateKey = async (keyType: string, options: GenerateKeyOptions) => {
    return await invoke('generate_vault_key', { keyType, options });
  };
  
  const exportToUsb = async (keyIds: string[], driveId: string) => {
    return await invoke('export_keys_to_usb', { keyIds, driveId });
  };
  
  return { keys, selectedKeys, generateKey, exportToUsb };
};
```

### 2. Key Selection & Backup UI

```tsx
const KeySelectionPage = () => {
  const { keys, selectedKeys, setSelectedKeys } = useKeyManagement();
  const { usbDrives } = useUsbDrives();
  
  return (
    <div className="key-management-container">
      <KeyList 
        keys={keys}
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
      />
      <ColdStorageBackupPanel
        selectedKeys={selectedKeys}
        availableDrives={usbDrives}
        onBackup={handleBackupToUsb}
      />
    </div>
  );
};
```

## Security Considerations

### 1. Key Protection
- All keys encrypted at rest with user-derived keys
- Memory protection with secure deletion
- Hardware security module (HSM) support for high-security keys
- Key rotation policies and automated rotation

### 2. Backup Security
- Each backup encrypted with unique keys
- Integrity verification with cryptographic checksums
- Redundant backup verification
- Secure deletion of temporary files

### 3. Access Control
- Role-based access to different key types
- Audit logging for all key operations
- Rate limiting for key generation
- Multi-factor authentication for sensitive operations

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
1. Database schema implementation
2. Key generation service with basic algorithms
3. SQLite storage backend
4. Basic Tauri commands

### Phase 2: Advanced Features (Week 3-4)
1. Post-quantum key generation
2. Cold storage export functionality
3. Key selection and management UI
4. Backup verification system

### Phase 3: Security & Polish (Week 5-6)
1. Advanced security features
2. Comprehensive testing
3. Performance optimization
4. Documentation and deployment

## Testing Strategy

### Unit Tests
- Key generation algorithms
- Storage operations
- Encryption/decryption functions
- Backup integrity verification

### Integration Tests
- End-to-end key lifecycle
- USB backup and restore
- Database consistency
- Error handling and recovery

### Security Tests
- Key entropy validation
- Encryption strength verification
- Access control enforcement
- Audit trail completeness
