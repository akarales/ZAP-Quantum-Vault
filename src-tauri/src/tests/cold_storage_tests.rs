#[cfg(test)]
mod tests {
    use crate::cold_storage::{ColdStorageManager, TrustLevel, BackupType, BackupRequest, RestoreRequest, RestoreType};
    use std::collections::HashMap;

    #[test]
    fn test_cold_storage_manager_creation() {
        let manager = ColdStorageManager::new();
        assert_eq!(manager.get_drives().len(), 0);
    }

    #[test]
    fn test_drive_trust_management() {
        let mut manager = ColdStorageManager::new();
        
        // Create a mock drive entry first
        let drive_id = "test_drive_123";
        
        // Since we can't easily mock USB drives, we'll test the trust system logic
        // In a real scenario, you'd detect drives first
        
        // Test setting trust level for non-existent drive should fail
        assert!(manager.set_drive_trust(drive_id, TrustLevel::Trusted).is_err());
    }

    #[test]
    fn test_backup_request_creation() {
        let backup_request = BackupRequest {
            drive_id: "test_drive".to_string(),
            backup_type: BackupType::Full,
            vault_ids: None,
            compression_level: 5,
            verification: true,
            password: Some("backup_password".to_string()),
        };
        
        assert_eq!(backup_request.drive_id, "test_drive");
        assert!(matches!(backup_request.backup_type, BackupType::Full));
        assert_eq!(backup_request.compression_level, 5);
        assert!(backup_request.verification);
    }

    #[test]
    fn test_restore_request_creation() {
        let restore_request = RestoreRequest {
            backup_id: "backup_123".to_string(),
            restore_type: RestoreType::Full,
            vault_ids: None,
            merge_mode: false,
        };
        
        assert_eq!(restore_request.backup_id, "backup_123");
        assert!(matches!(restore_request.restore_type, RestoreType::Full));
        assert!(!restore_request.merge_mode);
    }

    #[test]
    fn test_backup_types() {
        let full_backup = BackupType::Full;
        let incremental_backup = BackupType::Incremental;
        let selective_backup = BackupType::Selective;
        
        // Test that different backup types are distinct
        assert!(matches!(full_backup, BackupType::Full));
        assert!(matches!(incremental_backup, BackupType::Incremental));
        assert!(matches!(selective_backup, BackupType::Selective));
    }

    #[test]
    fn test_trust_levels() {
        let trusted = TrustLevel::Trusted;
        let untrusted = TrustLevel::Untrusted;
        let blocked = TrustLevel::Blocked;
        
        assert!(matches!(trusted, TrustLevel::Trusted));
        assert!(matches!(untrusted, TrustLevel::Untrusted));
        assert!(matches!(blocked, TrustLevel::Blocked));
    }

    #[test]
    fn test_restore_types() {
        let full_restore = RestoreType::Full;
        let selective_restore = RestoreType::Selective;
        let keys_only_restore = RestoreType::KeysOnly;
        
        assert!(matches!(full_restore, RestoreType::Full));
        assert!(matches!(selective_restore, RestoreType::Selective));
        assert!(matches!(keys_only_restore, RestoreType::KeysOnly));
    }

    #[test]
    fn test_drive_exists_check() {
        let manager = ColdStorageManager::new();
        
        // Non-existent drive should return false
        assert!(!manager.drive_exists("non_existent_drive"));
    }

    #[test]
    fn test_backup_creation_without_trusted_drive() {
        let mut manager = ColdStorageManager::new();
        let test_data = b"test vault data";
        let recovery_phrase = "test recovery phrase";
        let password = "test_password";
        
        // Should fail because drive doesn't exist or isn't trusted
        assert!(manager.create_backup("non_existent_drive", test_data, recovery_phrase, password).is_err());
    }

    #[test]
    fn test_backup_verification_non_existent() {
        let manager = ColdStorageManager::new();
        
        // Verifying non-existent backup should return false
        let result = manager.verify_backup("non_existent_backup");
        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    #[test]
    fn test_list_backups_empty_drive() {
        let manager = ColdStorageManager::new();
        
        // Listing backups for non-existent drive should fail
        assert!(manager.list_backups("non_existent_drive").is_err());
    }

    #[test]
    fn test_eject_drive_non_existent() {
        let manager = ColdStorageManager::new();
        
        // Ejecting non-existent drive should fail
        assert!(manager.eject_drive("non_existent_drive").is_err());
    }

    // Integration test for the full backup workflow (mocked)
    #[test]
    fn test_backup_workflow_structure() {
        // This test verifies the structure and types used in the backup workflow
        // without requiring actual USB drives
        
        let backup_request = BackupRequest {
            drive_id: "mock_drive".to_string(),
            backup_type: BackupType::Full,
            vault_ids: Some(vec!["vault1".to_string(), "vault2".to_string()]),
            compression_level: 9,
            verification: true,
            password: Some("strong_password_123".to_string()),
        };
        
        // Verify request structure
        assert_eq!(backup_request.vault_ids.as_ref().unwrap().len(), 2);
        assert_eq!(backup_request.compression_level, 9);
        
        let restore_request = RestoreRequest {
            backup_id: "backup_456".to_string(),
            restore_type: RestoreType::Selective,
            vault_ids: backup_request.vault_ids.clone(),
            merge_mode: true,
        };
        
        // Verify restore request structure
        assert_eq!(restore_request.vault_ids.as_ref().unwrap().len(), 2);
        assert!(restore_request.merge_mode);
    }
}
