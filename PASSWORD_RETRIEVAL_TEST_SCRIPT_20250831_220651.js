// Password Retrieval Test Script
// Date: 2025-08-31 22:06:51
// Purpose: Test Tauri backend password retrieval functionality

console.log('[TEST] Starting password retrieval diagnostics...');

// Test configuration
const TEST_CONFIG = {
  userId: 'admin', // Default user ID from the UI
  driveId: 'USB-001', // Drive ID from the UI screenshot
  testPassword: 'test123',
  devicePath: '/media/usb1'
};

// Test 1: Check if Tauri API is available
async function testTauriAvailability() {
  console.log('\n=== Test 1: Tauri API Availability ===');
  
  if (typeof window.__TAURI__ === 'undefined') {
    console.error('[ERROR] Tauri API not available - not running in Tauri context');
    return false;
  }
  
  console.log('[SUCCESS] Tauri API is available');
  console.log('[INFO] Available Tauri modules:', Object.keys(window.__TAURI__));
  return true;
}

// Test 2: Test save password functionality
async function testSavePassword() {
  console.log('\n=== Test 2: Save Password ===');
  
  try {
    const saveRequest = {
      drive_id: TEST_CONFIG.driveId,
      device_path: TEST_CONFIG.devicePath,
      drive_label: 'Test Drive',
      password: TEST_CONFIG.testPassword,
      password_hint: 'Test password for diagnostics'
    };
    
    console.log('[INFO] Saving password with request:', saveRequest);
    
    const result = await window.__TAURI__.invoke('save_usb_drive_password', {
      user_id: TEST_CONFIG.userId,
      request: saveRequest
    });
    
    console.log('[SUCCESS] Password saved:', result);
    return true;
  } catch (error) {
    console.error('[ERROR] Failed to save password:', error);
    return false;
  }
}

// Test 3: Test get password functionality
async function testGetPassword() {
  console.log('\n=== Test 3: Get Password ===');
  
  try {
    console.log('[INFO] Retrieving password for user:', TEST_CONFIG.userId, 'drive:', TEST_CONFIG.driveId);
    
    const result = await window.__TAURI__.invoke('get_usb_drive_password', {
      user_id: TEST_CONFIG.userId,
      drive_id: TEST_CONFIG.driveId
    });
    
    console.log('[INFO] Raw API result:', result);
    console.log('[INFO] Result type:', typeof result);
    console.log('[INFO] Result value:', result);
    
    if (result === null || result === undefined) {
      console.warn('[WARNING] No password found in database');
      return null;
    }
    
    if (typeof result !== 'string') {
      console.error('[ERROR] Password is not a string:', typeof result, result);
      return false;
    }
    
    console.log('[SUCCESS] Password retrieved successfully');
    console.log('[INFO] Password length:', result.length);
    console.log('[INFO] Password matches test:', result === TEST_CONFIG.testPassword);
    
    return result;
  } catch (error) {
    console.error('[ERROR] Failed to get password:', error);
    console.error('[ERROR] Error details:', {
      message: error.message,
      stack: error.stack
    });
    return false;
  }
}

// Test 4: Test get all user passwords
async function testGetAllUserPasswords() {
  console.log('\n=== Test 4: Get All User Passwords ===');
  
  try {
    const result = await window.__TAURI__.invoke('get_user_usb_drive_passwords', {
      user_id: TEST_CONFIG.userId
    });
    
    console.log('[INFO] All user passwords:', result);
    console.log('[INFO] Number of stored passwords:', result?.length || 0);
    
    if (Array.isArray(result)) {
      result.forEach((password, index) => {
        console.log(`[INFO] Password ${index + 1}:`, {
          id: password.id,
          drive_id: password.drive_id,
          device_path: password.device_path,
          drive_label: password.drive_label,
          created_at: password.created_at,
          last_used: password.last_used
        });
      });
    }
    
    return result;
  } catch (error) {
    console.error('[ERROR] Failed to get all user passwords:', error);
    return false;
  }
}

// Test 5: Database state verification
async function testDatabaseState() {
  console.log('\n=== Test 5: Database State ===');
  
  try {
    const result = await window.__TAURI__.invoke('debug_database_state');
    console.log('[INFO] Database state:', result);
    return result;
  } catch (error) {
    console.error('[ERROR] Failed to get database state:', error);
    return false;
  }
}

// Test 6: Frontend state inspection
async function testFrontendState() {
  console.log('\n=== Test 6: Frontend State Inspection ===');
  
  // Check if we're on the USB drive details page
  const currentUrl = window.location.href;
  console.log('[INFO] Current URL:', currentUrl);
  
  // Look for password input field
  const passwordInput = document.querySelector('input[placeholder*="current password" i], input[placeholder*="enter current" i]');
  console.log('[INFO] Password input found:', !!passwordInput);
  
  if (passwordInput) {
    console.log('[INFO] Password input details:', {
      value: passwordInput.value,
      placeholder: passwordInput.placeholder,
      disabled: passwordInput.disabled,
      type: passwordInput.type
    });
  }
  
  // Look for verify button
  const verifyButton = document.querySelector('button:contains("Verify"), button[class*="verify" i]');
  console.log('[INFO] Verify button found:', !!verifyButton);
  
  // Check React DevTools
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('[INFO] React DevTools available');
  }
  
  return {
    url: currentUrl,
    passwordInputFound: !!passwordInput,
    verifyButtonFound: !!verifyButton
  };
}

// Main test runner
async function runPasswordDiagnostics() {
  console.log('🔍 PASSWORD RETRIEVAL DIAGNOSTIC SCRIPT');
  console.log('========================================');
  console.log('Date:', new Date().toISOString());
  console.log('Test Config:', TEST_CONFIG);
  
  const results = {
    tauriAvailable: false,
    passwordSaved: false,
    passwordRetrieved: null,
    allPasswords: null,
    databaseState: null,
    frontendState: null
  };
  
  // Run tests sequentially
  results.tauriAvailable = await testTauriAvailability();
  
  if (results.tauriAvailable) {
    results.passwordSaved = await testSavePassword();
    results.passwordRetrieved = await testGetPassword();
    results.allPasswords = await testGetAllUserPasswords();
    results.databaseState = await testDatabaseState();
  }
  
  results.frontendState = await testFrontendState();
  
  // Summary
  console.log('\n=== DIAGNOSTIC SUMMARY ===');
  console.log('Results:', results);
  
  // Recommendations
  console.log('\n=== RECOMMENDATIONS ===');
  
  if (!results.tauriAvailable) {
    console.log('❌ Tauri API not available - ensure running in Tauri context');
  }
  
  if (results.passwordRetrieved === null) {
    console.log('⚠️  No password found - need to save a password first');
  } else if (results.passwordRetrieved === false) {
    console.log('❌ Password retrieval failed - check backend logs');
  } else if (typeof results.passwordRetrieved !== 'string') {
    console.log('❌ Password type issue - backend returning non-string');
  } else {
    console.log('✅ Password retrieval working correctly');
  }
  
  if (!results.frontendState?.passwordInputFound) {
    console.log('⚠️  Password input field not found - check component rendering');
  }
  
  return results;
}

// Auto-run if in browser console
if (typeof window !== 'undefined') {
  runPasswordDiagnostics().catch(console.error);
}

// Export for module use
if (typeof module !== 'undefined') {
  module.exports = { runPasswordDiagnostics, TEST_CONFIG };
}
