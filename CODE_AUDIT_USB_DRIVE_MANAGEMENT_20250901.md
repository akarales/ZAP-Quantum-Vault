# USB Drive Management Code Audit - September 1, 2025

## Critical Issues Identified

### 1. **Parameter Name Inconsistency - CRITICAL**

**Backend expects:** `driveId`, `trustLevel` (camelCase)
**Frontend sends different formats:**

- `utils/tauri-api.ts` line 176-178: `drive_id`, `trust_level` (snake_case)
- `pages/UsbDriveDetailPage.tsx` line 47-49: `drive_id`, `trust_level` (snake_case)  
- `hooks/useFormatOperations.ts` line 196-198: `driveId`, `trustLevel` (camelCase) ✅

**Root Cause:** Mixed parameter naming conventions across frontend files.

### 2. **Command Registration Issues**

Backend command signature:
```rust
pub async fn set_drive_trust(driveId: String, trustLevel: String, state: State<'_, AppState>)
```

Frontend calls using different parameter names cause Tauri to reject the command with "missing required key driveId".

### 3. **Async Runtime Architecture Problems**

- `ColdStorageManager::with_database()` was creating nested runtimes
- Fixed by making it async, but may have introduced other issues

### 4. **Database Integration Issues**

- Trust level persistence may not be working correctly
- Password storage integration unclear
- User ID handling inconsistent ("admin" hardcoded in some places)

## Detailed Analysis

### Frontend Parameter Usage:

1. **useFormatOperations.ts** (CORRECT):
```typescript
const trustResult = await safeTauriInvoke('set_drive_trust', {
  driveId: driveId,        // ✅ Correct
  trustLevel: 'trusted'    // ✅ Correct
});
```

2. **tauri-api.ts** (INCORRECT):
```typescript
return await safeTauriInvoke<string>('set_drive_trust', { 
  drive_id: driveId,       // ❌ Wrong - should be driveId
  trust_level: trustLevel  // ❌ Wrong - should be trustLevel
});
```

3. **UsbDriveDetailPage.tsx** (INCORRECT):
```typescript
await safeTauriInvoke('set_drive_trust', {
  drive_id: driveId,       // ❌ Wrong - should be driveId
  trust_level: backendTrustLevel // ❌ Wrong - should be trustLevel
});
```

### Backend Command Signature:
```rust
#[tauri::command]
#[allow(non_snake_case)]
pub async fn set_drive_trust(driveId: String, trustLevel: String, state: State<'_, AppState>)
```

## Impact Assessment

- **Severity:** CRITICAL - Core functionality completely broken
- **Affected Features:** 
  - Trust level setting from UI
  - Drive formatting workflow
  - Security management
- **User Experience:** Error messages, failed operations

## Recommended Fixes

### Priority 1: Fix Parameter Names
1. Update `utils/tauri-api.ts` to use camelCase parameters
2. Update `pages/UsbDriveDetailPage.tsx` to use camelCase parameters
3. Ensure all frontend calls use consistent naming

### Priority 2: Test Integration
1. Verify database persistence works
2. Test complete formatting workflow
3. Validate trust level changes persist across app restarts

### Priority 3: Code Cleanup
1. Remove unused functions (38 warnings)
2. Standardize error handling
3. Add comprehensive logging

## Files Requiring Changes

1. `/src/utils/tauri-api.ts` - Fix parameter names
2. `/src/pages/UsbDriveDetailPage.tsx` - Fix parameter names
3. Test all integration points after fixes

## Testing Checklist

- [ ] Format drive with trust level setting
- [ ] Manual trust level changes from UI
- [ ] Database persistence verification
- [ ] Error handling validation
- [ ] Cross-session trust level retention
