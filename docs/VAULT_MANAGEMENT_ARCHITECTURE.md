# ZAP Quantum Vault - SOLID Principles Architecture Design

## Executive Summary

This document outlines a comprehensive architecture redesign for ZAP Quantum Vault's vault management system, following SOLID principles to ensure maintainable, extensible, and robust code.

## Current State Analysis

### Issues Identified
1. **Single Responsibility Violation**: Bitcoin key generation mixed with vault management
2. **Open/Closed Principle Violation**: Hard-coded vault references, difficult to extend
3. **Dependency Inversion Violation**: Direct database dependencies throughout
4. **Interface Segregation Issues**: Monolithic command structures
5. **Foreign Key Constraint Failures**: Missing vault initialization

## SOLID Principles Implementation Plan

### 1. Single Responsibility Principle (SRP)

#### Current Problems
- `bitcoin_commands.rs` handles key generation, storage, and vault management
- Database initialization mixed with business logic
- UI components handling both presentation and business logic

#### Solution: Separate Concerns
```rust
// Vault Management Service
pub struct VaultService {
    repository: Arc<dyn VaultRepository>,
    validator: Arc<dyn VaultValidator>,
}

// Bitcoin Key Service  
pub struct BitcoinKeyService {
    repository: Arc<dyn BitcoinKeyRepository>,
    generator: Arc<dyn KeyGenerator>,
    encryptor: Arc<dyn KeyEncryptor>,
}

// Vault Selection Service
pub struct VaultSelectionService {
    vault_service: Arc<VaultService>,
    user_preferences: Arc<dyn UserPreferenceRepository>,
}
```

### 2. Open/Closed Principle (OCP)

#### Current Problems
- Hard-coded "default_vault" references
- No extension points for different vault types
- Monolithic key generation logic

#### Solution: Abstract Interfaces
```rust
pub trait VaultProvider {
    fn get_default_vault(&self) -> Result<Vault>;
    fn get_vault_by_id(&self, id: &str) -> Result<Option<Vault>>;
    fn create_vault(&self, config: VaultConfig) -> Result<Vault>;
}

pub trait KeyGenerator {
    fn generate_key(&self, config: KeyGenerationConfig) -> Result<BitcoinKey>;
}

pub trait VaultStrategy {
    fn initialize(&self) -> Result<()>;
    fn validate_key_storage(&self, key: &BitcoinKey) -> Result<()>;
}
```

### 3. Liskov Substitution Principle (LSP)

#### Solution: Proper Inheritance Hierarchy
```rust
pub trait VaultRepository {
    fn find_by_id(&self, id: &str) -> Result<Option<Vault>>;
    fn save(&self, vault: &Vault) -> Result<()>;
    fn find_default(&self) -> Result<Vault>;
}

pub struct SqliteVaultRepository {
    pool: Arc<SqlitePool>,
}

pub struct InMemoryVaultRepository {
    vaults: Arc<Mutex<HashMap<String, Vault>>>,
}

// Both implement VaultRepository with same behavior contracts
```

### 4. Interface Segregation Principle (ISP)

#### Current Problems
- Monolithic command interfaces
- UI components depending on unused methods

#### Solution: Focused Interfaces
```rust
pub trait VaultReader {
    fn get_vault(&self, id: &str) -> Result<Option<Vault>>;
    fn list_vaults(&self) -> Result<Vec<Vault>>;
}

pub trait VaultWriter {
    fn create_vault(&self, config: VaultConfig) -> Result<Vault>;
    fn update_vault(&self, vault: &Vault) -> Result<()>;
}

pub trait VaultSelector {
    fn get_selected_vault(&self) -> Result<Vault>;
    fn set_selected_vault(&self, id: &str) -> Result<()>;
}
```

### 5. Dependency Inversion Principle (DIP)

#### Current Problems
- Direct SQLite dependencies in business logic
- Tight coupling between layers

#### Solution: Dependency Injection
```rust
pub struct ApplicationServices {
    vault_service: Arc<dyn VaultService>,
    key_service: Arc<dyn BitcoinKeyService>,
    selection_service: Arc<dyn VaultSelectionService>,
}

impl ApplicationServices {
    pub fn new(
        vault_repo: Arc<dyn VaultRepository>,
        key_repo: Arc<dyn BitcoinKeyRepository>,
        preferences: Arc<dyn UserPreferenceRepository>,
    ) -> Self {
        // Dependency injection setup
    }
}
```

## Implementation Architecture

### Core Domain Models

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vault {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub vault_type: VaultType,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub metadata: VaultMetadata,
}

#[derive(Debug, Clone)]
pub enum VaultType {
    Personal,
    Shared,
    ColdStorage,
    Hardware,
}

#[derive(Debug, Clone)]
pub struct VaultConfig {
    pub name: String,
    pub description: Option<String>,
    pub vault_type: VaultType,
    pub encryption_config: EncryptionConfig,
}
```

### Service Layer Architecture

```rust
// Vault Management Service
pub struct VaultServiceImpl {
    repository: Arc<dyn VaultRepository>,
    validator: Arc<dyn VaultValidator>,
    event_publisher: Arc<dyn EventPublisher>,
}

impl VaultService for VaultServiceImpl {
    fn create_vault(&self, config: VaultConfig) -> Result<Vault> {
        self.validator.validate_config(&config)?;
        let vault = Vault::new(config);
        self.repository.save(&vault)?;
        self.event_publisher.publish(VaultCreated { vault_id: vault.id.clone() })?;
        Ok(vault)
    }

    fn get_default_vault(&self) -> Result<Vault> {
        self.repository.find_default()
            .or_else(|_| self.create_default_vault())
    }
}
```

### Repository Pattern Implementation

```rust
#[async_trait]
pub trait VaultRepository: Send + Sync {
    async fn find_by_id(&self, id: &str) -> Result<Option<Vault>>;
    async fn find_default(&self) -> Result<Vault>;
    async fn save(&self, vault: &Vault) -> Result<()>;
    async fn list_by_user(&self, user_id: &str) -> Result<Vec<Vault>>;
    async fn set_default(&self, vault_id: &str, user_id: &str) -> Result<()>;
}

pub struct SqliteVaultRepository {
    pool: Arc<SqlitePool>,
}

#[async_trait]
impl VaultRepository for SqliteVaultRepository {
    async fn find_default(&self) -> Result<Vault> {
        let vault = sqlx::query_as!(
            VaultRow,
            "SELECT * FROM vaults WHERE is_default = true LIMIT 1"
        )
        .fetch_optional(&*self.pool)
        .await?;

        match vault {
            Some(row) => Ok(row.into()),
            None => self.create_system_default().await,
        }
    }
}
```

## Default Vault Strategy

### Initialization Flow
1. **System Startup**: Check for existing default vault
2. **First Run**: Create system default vault automatically
3. **User Selection**: Allow users to change default vault
4. **Key Generation**: Always use selected vault (defaults to system default)

### Default Vault Configuration
```rust
pub struct DefaultVaultStrategy {
    repository: Arc<dyn VaultRepository>,
}

impl DefaultVaultStrategy {
    pub async fn ensure_default_vault(&self) -> Result<Vault> {
        match self.repository.find_default().await {
            Ok(vault) => Ok(vault),
            Err(_) => self.create_system_default().await,
        }
    }

    async fn create_system_default(&self) -> Result<Vault> {
        let config = VaultConfig {
            name: "Default Vault".to_string(),
            description: Some("System default vault for Bitcoin keys".to_string()),
            vault_type: VaultType::Personal,
            encryption_config: EncryptionConfig::default(),
        };

        let mut vault = Vault::new(config);
        vault.is_default = true;
        
        self.repository.save(&vault).await?;
        Ok(vault)
    }
}
```

## Frontend Architecture

### Vault Selection Component
```typescript
interface VaultSelectorProps {
  selectedVaultId?: string;
  onVaultChange: (vaultId: string) => void;
  showCreateNew?: boolean;
}

export const VaultSelector: React.FC<VaultSelectorProps> = ({
  selectedVaultId,
  onVaultChange,
  showCreateNew = false
}) => {
  const { vaults, defaultVault, loading } = useVaults();
  const effectiveSelection = selectedVaultId || defaultVault?.id;

  return (
    <Select value={effectiveSelection} onValueChange={onVaultChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select vault" />
      </SelectTrigger>
      <SelectContent>
        {vaults.map(vault => (
          <SelectItem key={vault.id} value={vault.id}>
            <div className="flex items-center gap-2">
              <VaultIcon type={vault.type} />
              <span>{vault.name}</span>
              {vault.isDefault && <Badge variant="secondary">Default</Badge>}
            </div>
          </SelectItem>
        ))}
        {showCreateNew && (
          <SelectItem value="__create_new__">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Create New Vault</span>
            </div>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
};
```

### Key Generation with Vault Selection
```typescript
export const BitcoinKeyGenerator: React.FC = () => {
  const [selectedVaultId, setSelectedVaultId] = useState<string>();
  const { defaultVault } = useVaults();
  
  const handleGenerateKey = async () => {
    const vaultId = selectedVaultId || defaultVault?.id;
    if (!vaultId) {
      throw new Error('No vault selected');
    }

    await invoke('generate_bitcoin_key', {
      vaultId,
      keyType: form.keyType,
      network: form.network,
      password: form.password,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Bitcoin Key</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label>Target Vault</Label>
            <VaultSelector
              selectedVaultId={selectedVaultId}
              onVaultChange={setSelectedVaultId}
              showCreateNew={true}
            />
          </div>
          {/* Rest of form */}
        </div>
      </CardContent>
    </Card>
  );
};
```

## Database Schema Updates

### Enhanced Vault Table
```sql
CREATE TABLE vaults (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    vault_type TEXT NOT NULL DEFAULT 'personal',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_system_default BOOLEAN NOT NULL DEFAULT FALSE,
    encryption_config TEXT, -- JSON
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    -- Ensure only one default per user
    UNIQUE(user_id, is_default) WHERE is_default = TRUE
);

-- System-wide default vault (for offline mode)
CREATE UNIQUE INDEX idx_system_default 
ON vaults (is_system_default) 
WHERE is_system_default = TRUE;
```

## Migration Strategy

### Phase 1: Core Infrastructure
1. Create abstract interfaces and traits
2. Implement repository pattern
3. Add dependency injection container
4. Create vault service layer

### Phase 2: Default Vault System
1. Implement default vault strategy
2. Update database initialization
3. Add vault selection service
4. Create migration for existing data

### Phase 3: Frontend Integration
1. Create vault selector components
2. Update key generation UI
3. Add vault management interface
4. Implement user preferences

### Phase 4: Testing & Validation
1. Unit tests for all services
2. Integration tests for vault operations
3. End-to-end testing
4. Performance optimization

## Benefits of This Architecture

### Maintainability
- Clear separation of concerns
- Testable components
- Reduced coupling

### Extensibility
- Easy to add new vault types
- Pluggable key generation strategies
- Configurable encryption methods

### Reliability
- Proper error handling
- Transaction management
- Data consistency guarantees

### User Experience
- Intuitive vault selection
- Automatic default handling
- Seamless key management

## Next Steps

1. **Immediate**: Fix foreign key constraint by implementing default vault creation
2. **Short-term**: Refactor existing code to follow SOLID principles
3. **Medium-term**: Implement full vault management system
4. **Long-term**: Add advanced features like vault sharing and backup strategies

This architecture provides a solid foundation for scalable, maintainable vault management while ensuring excellent user experience and system reliability.
