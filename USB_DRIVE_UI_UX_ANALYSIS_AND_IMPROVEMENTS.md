# USB Drive UI/UX Analysis and Improvements

## Current Issues Identified

### 1. Password Generator Placement
- **Issue**: Password generator is in its own separate section at the bottom of the page
- **Problem**: Creates confusion about when/why to use it
- **Expected**: Password generator should be integrated within the Format & Encryption section only

### 2. Format Button Logic
- **Issue**: Single button that changes text based on drive state
- **Problem**: Not clear enough distinction between formatting encrypted vs unencrypted drives
- **Expected**: Two distinct buttons with clear purposes

### 3. UI Flow Confusion
- **Issue**: Current password display is separate from formatting workflow
- **Problem**: Users don't understand the relationship between stored passwords and new encryption

## Backend Command Analysis

### Available Format Commands
- `format_and_encrypt_drive(drive_id, password, drive_name)` - Main formatting command
- Parameters:
  - `drive_id`: String (e.g., "usb_sde1")
  - `password`: String (new encryption password)
  - `drive_name`: Option<String> (label for the drive)

### Password Management Commands
- `save_usb_drive_password(user_id, request: SavePasswordRequest)`
- `get_usb_drive_password(user_id, drive_id)` -> Option<String>
- `delete_usb_drive_password(user_id, drive_id)`

### Database Schema - USB Drive Passwords Table
```sql
CREATE TABLE usb_drive_passwords (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    drive_id TEXT NOT NULL,
    device_path TEXT NOT NULL,
    drive_label TEXT,
    encrypted_password TEXT NOT NULL,  -- Encrypted storage
    password_hint TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_used TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id, drive_id)
)
```

## Required Improvements

### 1. Move Password Generator into Format Section
**Current State**: Standalone section at bottom
**Target State**: Integrated within Format & Encryption card

**Implementation**:
- Remove standalone `PasswordGenerator` component from main page
- Add password generator directly in `FormatSection.tsx`
- Position it near the password input fields
- Make it contextual to the formatting operation

### 2. Implement Distinct Format Buttons
**Current State**: Single button with conditional text
**Target State**: Two separate buttons with different styling and behavior

**Button Logic**:
```typescript
// For unencrypted drives (no stored password)
if (!drive.isEncrypted && !hasStoredPassword) {
  return <FormatEncryptButton />; // Red/destructive styling
}

// For encrypted drives (has stored password or LUKS filesystem)
if (drive.isEncrypted || hasStoredPassword || drive.filesystem === 'LUKS Encrypted') {
  return <FormatReencryptButton />; // Orange/warning styling
}
```

### 3. Enhanced Drive State Detection
**Current Detection**:
- `drive.filesystem === 'LUKS Encrypted'`
- `drive.filesystem === 'crypto_LUKS'`

**Improved Detection**:
```typescript
const isEncryptedDrive = (drive: UsbDrive, hasStoredPassword: boolean): boolean => {
  return (
    drive.filesystem === 'LUKS Encrypted' ||
    drive.filesystem === 'crypto_LUKS' ||
    hasStoredPassword ||
    drive.device_path?.includes('/dev/mapper/') // LUKS mapped device
  );
};
```

### 4. Streamlined Password Workflow
**Current Flow**: 
1. View current password (separate section)
2. Generate new password (separate section)
3. Format with new password (format section)

**Improved Flow**:
1. **For Encrypted Drives**: Show current password + option to change
2. **For All Drives**: Generate/enter new password within format section
3. **Format Action**: Single integrated workflow

## Implementation Plan

### Phase 1: Restructure Format Section
- [ ] Move password generator into `FormatSection.tsx`
- [ ] Add conditional rendering based on drive encryption state
- [ ] Integrate password generation with format workflow

### Phase 2: Implement Dual Button System
- [ ] Create `FormatEncryptButton` component (red styling)
- [ ] Create `FormatReencryptButton` component (orange styling)
- [ ] Add proper button logic based on drive state
- [ ] Update button text and styling

### Phase 3: Enhanced Drive Detection
- [ ] Improve drive encryption detection logic
- [ ] Add stored password checking to drive state
- [ ] Update UI conditionals based on comprehensive state

### Phase 4: Streamline Password Management
- [ ] Integrate current password display into format section
- [ ] Add password change workflow for encrypted drives
- [ ] Simplify overall UI flow

## File Changes Required

### 1. `/src/pages/UsbDriveDetailPage.tsx`
```typescript
// Remove standalone password generator
// Keep only CurrentPasswordSection and FormatSection
// Remove duplicate password management
```

### 2. `/src/components/drive/FormatSection.tsx`
```typescript
// Add integrated password generator
// Implement dual button system
// Add drive state detection
// Integrate current password management for re-encryption
```

### 3. `/src/hooks/useDriveData.ts`
```typescript
// Add stored password checking to drive data
// Enhance drive state detection
// Return comprehensive drive encryption status
```

### 4. `/src/utils/tauri-api.ts`
```typescript
// Ensure all format commands use correct parameters
// Add password management integration
```

## Expected User Experience

### For Unencrypted Drives:
1. User sees "Format & Encrypt" button (red)
2. Password generator is available within format section
3. User generates/enters password and confirms
4. Single click formats and encrypts drive
5. Password is automatically saved to vault

### For Encrypted Drives:
1. User sees current stored password (if available)
2. User sees "Format & Re-encrypt" button (orange)
3. Password generator available for new password
4. Option to use existing password or generate new one
5. Single click re-formats with new encryption
6. New password replaces old one in vault

## Success Metrics
- [ ] Password generator only appears in format section
- [ ] Clear distinction between encrypt vs re-encrypt operations
- [ ] Streamlined workflow from password generation to formatting
- [ ] No duplicate UI elements
- [ ] Intuitive user flow for both encrypted and unencrypted drives
