# ZAP Quantum Vault Security Implementation Plan

**Date**: September 1, 2025  
**Priority**: CRITICAL  
**Timeline**: 6-8 weeks total implementation

## Phase 1: Critical Security Fixes (Week 1-2) 🔴

### 1.1 Real Encryption Implementation

#### **Current Issue**: Base64 encoding instead of encryption
```rust
// BROKEN: Base64 encoding (not encryption)
let decrypted_bytes = base64::decode(&encrypted_data)
```

#### **Solution**: AES-256-GCM with Argon2 key derivation
```rust
use aes_gcm::{Aes256Gcm, Key, Nonce, KeyInit};
use argon2::{Argon2, PasswordHash, PasswordHasher};

pub struct VaultEncryption {
    cipher: Aes256Gcm,
    salt: [u8; 32],
}

impl VaultEncryption {
    pub fn new(password: &str, salt: Option<[u8; 32]>) -> Result<Self, VaultError> {
        let salt = salt.unwrap_or_else(|| {
            let mut s = [0u8; 32];
            OsRng.fill_bytes(&mut s);
            s
        });
        
        // Derive key using Argon2id
        let mut key = [0u8; 32];
        Argon2::default()
            .hash_password_into(password.as_bytes(), &salt, &mut key)
            .map_err(|e| VaultError::EncryptionError(e.to_string()))?;
            
        let cipher = Aes256Gcm::new(Key::from_slice(&key));
        Ok(Self { cipher, salt })
    }
    
    pub fn encrypt(&self, data: &str) -> Result<String, VaultError> {
        let nonce = Nonce::from_slice(&OsRng.next_u64().to_le_bytes());
        let ciphertext = self.cipher
            .encrypt(nonce, data.as_bytes())
            .map_err(|e| VaultError::EncryptionError(e.to_string()))?;
            
        // Format: salt(32) + nonce(12) + ciphertext
        let mut result = Vec::new();
        result.extend_from_slice(&self.salt);
        result.extend_from_slice(nonce);
        result.extend_from_slice(&ciphertext);
        
        Ok(base64::encode(result))
    }
}
```

#### **Database Migration Required**
```sql
ALTER TABLE vault_items ADD COLUMN encrypted_data_v2 TEXT;
ALTER TABLE vault_items ADD COLUMN encryption_version INTEGER DEFAULT 2;
ALTER TABLE vault_items ADD COLUMN key_derivation_salt BLOB;
```

### 1.2 Secure Password Management

#### **Current Issue**: Hardcoded default passwords
```rust
"default_backup_password".to_string() // CRITICAL VULNERABILITY
```

#### **Solution**: Mandatory secure passwords
```rust
use secrecy::{Secret, ExposeSecret};

pub struct SecurePassword(Secret<String>);

impl SecurePassword {
    pub fn new(password: String) -> Result<Self, VaultError> {
        Self::validate_password(&password)?;
        Ok(Self(Secret::new(password)))
    }
    
    fn validate_password(password: &str) -> Result<(), VaultError> {
        if password.len() < 12 {
            return Err(VaultError::WeakPassword("Minimum 12 characters required".to_string()));
        }
        
        let has_upper = password.chars().any(|c| c.is_uppercase());
        let has_lower = password.chars().any(|c| c.is_lowercase());
        let has_digit = password.chars().any(|c| c.is_numeric());
        let has_special = password.chars().any(|c| "!@#$%^&*()_+-=[]{}|;:,.<>?".contains(c));
        
        if !(has_upper && has_lower && has_digit && has_special) {
            return Err(VaultError::WeakPassword(
                "Password must contain uppercase, lowercase, digit, and special character".to_string()
            ));
        }
        
        Ok(())
    }
}

// Updated BackupRequest - NO DEFAULT PASSWORD
pub struct BackupRequest {
    pub drive_id: String,
    pub backup_type: BackupType,
    pub vault_ids: Option<Vec<String>>,
    pub compression_level: u8,
    pub verification: bool,
    pub password: SecurePassword, // REQUIRED - no default
}
```

### 1.3 Input Validation Framework

#### **Current Issue**: No input sanitization, SQL injection potential

#### **Solution**: Comprehensive validation
```rust
pub struct InputValidator;

impl InputValidator {
    pub fn validate_vault_name(name: &str) -> Result<String, VaultError> {
        if name.is_empty() || name.len() > 255 {
            return Err(VaultError::InvalidInput("Vault name must be 1-255 characters".to_string()));
        }
        
        let valid_chars = Regex::new(r"^[a-zA-Z0-9\s\-_]+$").unwrap();
        if !valid_chars.is_match(name) {
            return Err(VaultError::InvalidInput("Invalid characters in vault name".to_string()));
        }
        
        Ok(name.trim().to_string())
    }
    
    pub fn validate_file_path(path: &str) -> Result<PathBuf, VaultError> {
        let path = Path::new(path);
        
        // Prevent path traversal
        if path.components().any(|comp| comp == std::path::Component::ParentDir) {
            return Err(VaultError::SecurityViolation("Path traversal attempt detected".to_string()));
        }
        
        let canonical = path.canonicalize()
            .map_err(|_| VaultError::InvalidInput("Invalid file path".to_string()))?;
            
        // Check against allowed base paths
        let allowed_bases = ["/media/", "/mnt/", "/tmp/zap-vault/"];
        let path_str = canonical.to_string_lossy();
        if !allowed_bases.iter().any(|base| path_str.starts_with(base)) {
            return Err(VaultError::SecurityViolation("Path outside allowed directories".to_string()));
        }
        
        Ok(canonical)
    }
}
```

## Phase 2: Authentication & Authorization (Week 3-4) 🟡

### 2.1 JWT Authentication System

#### **Current Issue**: Hardcoded "admin" user, no session management

#### **Solution**: Role-based JWT authentication
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,      // user_id
    pub role: UserRole,   // user role
    pub exp: i64,         // expiration
    pub jti: String,      // JWT ID for revocation
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum UserRole {
    Admin,
    User,
    ReadOnly,
}

pub struct AuthManager {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    db: Arc<SqlitePool>,
}

impl AuthManager {
    pub async fn authenticate(&self, username: &str, password: &str) -> Result<String, VaultError> {
        let user = self.verify_user_credentials(username, password).await?;
        
        let claims = Claims {
            sub: user.id,
            role: user.role,
            exp: (Utc::now() + Duration::hours(8)).timestamp(),
            jti: uuid::Uuid::new_v4().to_string(),
        };
        
        let token = encode(&Header::default(), &claims, &self.encoding_key)
            .map_err(|e| VaultError::AuthenticationError(e.to_string()))?;
            
        self.store_active_token(&claims.jti, &claims.sub).await?;
        Ok(token)
    }
    
    pub async fn require_role(&self, token: &str, required_role: UserRole) -> Result<Claims, VaultError> {
        let claims = self.validate_token(token).await?;
        
        match (&claims.role, &required_role) {
            (UserRole::Admin, _) => Ok(claims),
            (UserRole::User, UserRole::User) => Ok(claims),
            (UserRole::User, UserRole::ReadOnly) => Ok(claims),
            (UserRole::ReadOnly, UserRole::ReadOnly) => Ok(claims),
            _ => Err(VaultError::AuthorizationError("Insufficient permissions".to_string())),
        }
    }
}
```

### 2.2 Frontend Authentication Context
```typescript
interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) -> Promise<void>;
  logout: () => void;
  hasRole: (role: UserRole) -> boolean;
  isAuthenticated: boolean;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  
  const login = async (username: string, password: string) => {
    const response = await safeTauriInvoke('authenticate_user', { username, password });
    setToken(response.token);
    setUser(response.user);
    await safeTauriInvoke('store_auth_token', { token: response.token });
  };
  
  return (
    <AuthContext.Provider value={{ user, token, login, logout, hasRole, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
```

## Phase 3: Error Handling & Logging (Week 5) 🟡

### 3.1 Structured Error System

#### **Current Issue**: Raw error exposure, no audit logging

#### **Solution**: Sanitized errors with secure logging
```rust
#[derive(Error, Debug, Serialize, Deserialize)]
pub enum VaultError {
    #[error("Database error: {0}")]
    DatabaseError(String),
    #[error("Encryption error: {0}")]
    EncryptionError(String),
    #[error("Authentication failed: {0}")]
    AuthenticationError(String),
    #[error("Security violation: {0}")]
    SecurityViolation(String),
    #[error("Weak password: {0}")]
    WeakPassword(String),
}

impl VaultError {
    pub fn user_message(&self) -> String {
        match self {
            VaultError::DatabaseError(_) => "A database error occurred. Please try again.".to_string(),
            VaultError::EncryptionError(_) => "Failed to encrypt data. Please check your password.".to_string(),
            VaultError::AuthenticationError(_) => "Invalid username or password.".to_string(),
            VaultError::SecurityViolation(_) => "Security violation detected. Action blocked.".to_string(),
            VaultError::WeakPassword(msg) => msg.clone(),
        }
    }
}

pub struct SecureLogger;

impl SecureLogger {
    pub fn log_vault_operation(operation: &str, vault_id: &str, success: bool) {
        info!(operation = operation, vault_id = vault_id, success = success, "Vault operation completed");
    }
    
    pub fn log_backup_operation(drive_id: &str, success: bool, size_bytes: Option<u64>) {
        info!(drive_id = drive_id, success = success, size_bytes = size_bytes, "Backup operation completed");
        // NO password information ever logged
    }
    
    pub fn log_security_event(event_type: &str, user_id: Option<&str>) {
        warn!(event_type = event_type, user_id = user_id, "Security event detected");
    }
}
```

## Phase 4: Testing Strategy (Week 6) 🟢

### 4.1 Security Test Suite
```rust
#[cfg(test)]
mod security_tests {
    #[tokio::test]
    async fn test_encryption_roundtrip() {
        let password = "TestPassword123!";
        let plaintext = "Sensitive vault data";
        
        let encryption = VaultEncryption::new(password, None).unwrap();
        let encrypted = encryption.encrypt(plaintext).unwrap();
        let decrypted = encryption.decrypt(&encrypted).unwrap();
        
        assert_eq!(plaintext, decrypted);
        assert!(!encrypted.contains(plaintext)); // Ensure not plaintext
        
        // Different encryptions should be different (nonce)
        let encrypted2 = encryption.encrypt(plaintext).unwrap();
        assert_ne!(encrypted, encrypted2);
    }
    
    #[tokio::test]
    async fn test_password_validation() {
        assert!(SecurePassword::new("weak".to_string()).is_err());
        assert!(SecurePassword::new("StrongP@ssw0rd123!".to_string()).is_ok());
    }
    
    #[tokio::test]
    async fn test_input_validation() {
        let malicious_input = "'; DROP TABLE vault_items; --";
        assert!(InputValidator::validate_vault_name(malicious_input).is_err());
        
        let malicious_path = "../../../etc/passwd";
        assert!(InputValidator::validate_file_path(malicious_path).is_err());
    }
}
```

## Implementation Timeline

### Week 1-2: Critical Security (MUST COMPLETE)
- [ ] Replace Base64 with AES-256-GCM encryption
- [ ] Implement secure password requirements  
- [ ] Remove all password logging
- [ ] Add input validation framework
- [ ] Database migration for encrypted data

### Week 3-4: Authentication System
- [ ] JWT-based authentication
- [ ] Role-based access control
- [ ] Frontend auth context
- [ ] Token revocation system

### Week 5: Error Handling & Logging
- [ ] Structured error types
- [ ] Secure logging system
- [ ] Audit logging
- [ ] User-friendly error messages

### Week 6: Testing Implementation
- [ ] Unit tests for encryption
- [ ] Security penetration tests
- [ ] Integration tests
- [ ] Performance benchmarks

## Risk Assessment

| Issue | Current Risk | Post-Fix Risk | Priority |
|-------|-------------|---------------|----------|
| Fake Encryption | 🔴 Critical (10/10) | 🟢 Low (2/10) | P0 |
| Default Passwords | 🔴 Critical (9/10) | 🟢 Low (1/10) | P0 |
| No Authentication | 🟡 High (8/10) | 🟢 Low (2/10) | P1 |
| Input Validation | 🟡 High (7/10) | 🟢 Low (2/10) | P1 |

**Estimated Total Implementation Time**: 6-8 weeks  
**Critical Security Fixes**: 2 weeks (IMMEDIATE PRIORITY)
