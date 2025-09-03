# USB Drive Detail Page - Comprehensive Code Audit

## Issues Identified

### 1. Password Display Problem ❌
**Issue**: Current password not displaying properly for encrypted drives
**Location**: `FormatSection.tsx` lines 133-166
**Problem**: 
- Both current password and new password fields use the same `formatOptions.password` value
- No separate state for current vs new password
- Current password field should show existing drive password, not new password input

### 2. Button Logic Problem ❌
**Issue**: Reset button should be "Format" when drive is encrypted
**Location**: `FormatSection.tsx` lines 260-297
**Problem**:
- Reset button (line 261-267) is always visible and labeled "Reset"
- For encrypted drives, this should be "Format" button
- Only "Format & Re-encrypt" should be available for encrypted drives

### 3. Backup Functionality Problem ❌
**Issue**: Create Backup functionality not working
**Location**: `BackupManagement.tsx` and `UsbDriveDetailPage.tsx`
**Problem**:
- `handleBackupCreate` in UsbDriveDetailPage.tsx (line 50-53) only sets success message
- No actual Tauri API call to create backup
- Missing integration with backend backup functionality

### 4. State Management Issues ❌
**Issue**: Inconsistent state management for passwords
**Location**: `UsbDriveDetailPage.tsx` and `useFormatOperations.ts`
**Problem**:
- No separate state for current password vs new password
- Password validation doesn't account for encrypted drive scenarios
- Missing current password verification before format operations

### 5. UI/UX Issues ❌
**Issue**: Confusing user interface for encrypted drives
**Problems**:
- Same password field used for current and new password
- Button labels don't clearly indicate what will happen
- No clear indication of drive's current encryption status

## Proposed Fixes

### Fix 1: Separate Current and New Password States
```typescript
// Add to UsbDriveDetailPage state
const [currentPassword, setCurrentPassword] = useState('');
const [newPassword, setNewPassword] = useState('');
const [confirmNewPassword, setConfirmNewPassword] = useState('');
```

### Fix 2: Update Button Logic
```typescript
// In FormatSection.tsx - Remove Reset button for encrypted drives
// Show only "Format & Re-encrypt" for encrypted drives
// Show "Format Drive" for unencrypted drives
```

### Fix 3: Implement Real Backup Functionality
```typescript
// Add actual Tauri API call for backup creation
const handleBackupCreate = async (options: BackupOptions) => {
  try {
    await safeTauriInvoke('create_drive_backup', {
      driveId,
      backupName: options.name,
      includeSettings: options.includeSettings,
      encrypt: options.encryptBackup
    });
    setSuccess(`Backup created: ${options.name || 'Unnamed backup'}`);
  } catch (error) {
    setError(`Failed to create backup: ${error}`);
  }
  setShowBackupSection(false);
};
```

### Fix 4: Add Current Password Verification
```typescript
// Add password verification before format operations
const verifyCurrentPassword = async (password: string) => {
  return await safeTauriInvoke('verify_drive_password', {
    driveId,
    password
  });
};
```

### Fix 5: Improve Drive Status Detection
```typescript
// Better encryption detection
const isEncrypted = drive.encrypted === true || 
                   drive.filesystem?.includes('LUKS') || 
                   drive.filesystem?.includes('crypto_');
```

## Test Scenarios Needed

### Test 1: Encrypted Drive Password Display
- Load encrypted drive
- Verify current password field shows placeholder
- Verify new password field is separate
- Test password visibility toggles work independently

### Test 2: Button Logic for Encrypted Drives
- Load encrypted drive
- Verify only "Format & Re-encrypt" button is visible
- Verify button is disabled until current password is entered
- Test format operation with current password verification

### Test 3: Button Logic for Unencrypted Drives
- Load unencrypted drive
- Verify "Format Drive" button is visible
- Verify no current password field is shown
- Test format operation works without current password

### Test 4: Backup Functionality
- Test backup creation with various options
- Verify backup appears in drive backup count
- Test backup creation error handling
- Verify backup with encryption option

### Test 5: Password Validation
- Test current password verification
- Test new password strength validation
- Test password confirmation matching
- Test form validation prevents invalid operations

## Priority Order

1. **HIGH**: Fix password display and state management
2. **HIGH**: Fix button logic for encrypted vs unencrypted drives
3. **HIGH**: Implement real backup functionality
4. **MEDIUM**: Add current password verification
5. **LOW**: UI/UX improvements and better error messages

## Files to Modify

1. `src/pages/UsbDriveDetailPage.tsx` - Main component state management
2. `src/components/drive/FormatSection.tsx` - Password fields and button logic
3. `src/components/drive/BackupManagement.tsx` - Backup functionality
4. `src/hooks/useFormatOperations.ts` - Format operations logic
5. `src/utils/tauri-api.ts` - Add backup and password verification mock commands

## Mock Data Updates Needed

Add to `tauri-api.ts` mock commands:
- `create_drive_backup`
- `verify_drive_password`
- `get_drive_backups`
- Update drive mock data to include proper encryption status
