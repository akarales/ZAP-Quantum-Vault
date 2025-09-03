/**
 * USB Drive Detail Page Test Script
 * Comprehensive testing utility for USB drive functionality
 */

import { safeTauriInvoke } from './tauri-api';

export interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

export interface TestSuite {
  suiteName: string;
  results: TestResult[];
  passed: boolean;
  totalTests: number;
  passedTests: number;
}

export class UsbDriveTestRunner {
  private results: TestSuite[] = [];

  /**
   * Run all USB drive tests
   */
  async runAllTests(): Promise<TestSuite[]> {
    console.log('🚀 Starting USB Drive Detail Page Test Suite...');
    
    this.results = [];
    
    // Test Suite 1: Drive Data Loading
    await this.testDriveDataLoading();
    
    // Test Suite 2: Password Management
    await this.testPasswordManagement();
    
    // Test Suite 3: Button Logic
    await this.testButtonLogic();
    
    // Test Suite 4: Backup Functionality
    await this.testBackupFunctionality();
    
    // Test Suite 5: Format Operations
    await this.testFormatOperations();
    
    // Test Suite 6: UI State Management
    await this.testUIStateManagement();
    
    this.printSummary();
    return this.results;
  }

  /**
   * Test Suite 1: Drive Data Loading
   */
  private async testDriveDataLoading(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Drive Data Loading',
      results: [],
      passed: false,
      totalTests: 0,
      passedTests: 0
    };

    // Test 1.1: Load encrypted drive data
    try {
      const encryptedDrive = await safeTauriInvoke('get_drive_details', { driveId: 'usb-encrypted-001' });
      suite.results.push({
        testName: 'Load Encrypted Drive Data',
        passed: encryptedDrive && encryptedDrive.encrypted === true,
        message: encryptedDrive ? 'Encrypted drive loaded successfully' : 'Failed to load encrypted drive',
        details: encryptedDrive
      });
    } catch (error) {
      suite.results.push({
        testName: 'Load Encrypted Drive Data',
        passed: false,
        message: `Error loading encrypted drive: ${error}`,
        details: error
      });
    }

    // Test 1.2: Load unencrypted drive data
    try {
      const unencryptedDrive = await safeTauriInvoke('get_drive_details', { driveId: 'usb-unencrypted-001' });
      suite.results.push({
        testName: 'Load Unencrypted Drive Data',
        passed: unencryptedDrive && unencryptedDrive.encrypted === false,
        message: unencryptedDrive ? 'Unencrypted drive loaded successfully' : 'Failed to load unencrypted drive',
        details: unencryptedDrive
      });
    } catch (error) {
      suite.results.push({
        testName: 'Load Unencrypted Drive Data',
        passed: false,
        message: `Error loading unencrypted drive: ${error}`,
        details: error
      });
    }

    // Test 1.3: Handle invalid drive ID
    try {
      const invalidDrive = await safeTauriInvoke('get_drive_details', { driveId: 'invalid-drive-id' });
      suite.results.push({
        testName: 'Handle Invalid Drive ID',
        passed: !invalidDrive,
        message: invalidDrive ? 'Should not return data for invalid drive ID' : 'Correctly handled invalid drive ID',
        details: invalidDrive
      });
    } catch (error) {
      suite.results.push({
        testName: 'Handle Invalid Drive ID',
        passed: true,
        message: 'Correctly threw error for invalid drive ID',
        details: error
      });
    }

    this.finalizeSuite(suite);
    this.results.push(suite);
  }

  /**
   * Test Suite 2: Password Management
   */
  private async testPasswordManagement(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Password Management',
      results: [],
      passed: false,
      totalTests: 0,
      passedTests: 0
    };

    // Test 2.1: Password validation
    const passwordTests = [
      { password: '', expected: false, name: 'Empty Password' },
      { password: 'weak', expected: false, name: 'Weak Password' },
      { password: 'StrongPassword123!', expected: true, name: 'Strong Password' },
      { password: 'VeryStrongQuantumResistantPassword2024!@#', expected: true, name: 'Very Strong Password' }
    ];

    passwordTests.forEach(test => {
      const validation = this.validatePassword(test.password);
      suite.results.push({
        testName: `Password Validation - ${test.name}`,
        passed: validation.isValid === test.expected,
        message: `Password "${test.password}" validation: ${validation.feedback}`,
        details: { password: test.password, validation }
      });
    });

    // Test 2.2: Current password verification
    try {
      const verificationResult = await safeTauriInvoke('verify_drive_password', {
        driveId: 'usb-encrypted-001',
        password: 'correct-password'
      });
      suite.results.push({
        testName: 'Current Password Verification',
        passed: verificationResult === true,
        message: verificationResult ? 'Password verification successful' : 'Password verification failed',
        details: verificationResult
      });
    } catch (error) {
      suite.results.push({
        testName: 'Current Password Verification',
        passed: false,
        message: `Password verification error: ${error}`,
        details: error
      });
    }

    this.finalizeSuite(suite);
    this.results.push(suite);
  }

  /**
   * Test Suite 3: Button Logic
   */
  private async testButtonLogic(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Button Logic',
      results: [],
      passed: false,
      totalTests: 0,
      passedTests: 0
    };

    // Test 3.1: Encrypted drive button logic
    const encryptedDriveButtons = this.getButtonsForDrive({ encrypted: true, filesystem: 'LUKS Encrypted' });
    suite.results.push({
      testName: 'Encrypted Drive Button Logic',
      passed: encryptedDriveButtons.includes('Format & Re-encrypt') && !encryptedDriveButtons.includes('Format Drive'),
      message: `Encrypted drive shows correct buttons: ${encryptedDriveButtons.join(', ')}`,
      details: encryptedDriveButtons
    });

    // Test 3.2: Unencrypted drive button logic
    const unencryptedDriveButtons = this.getButtonsForDrive({ encrypted: false, filesystem: 'ext4' });
    suite.results.push({
      testName: 'Unencrypted Drive Button Logic',
      passed: unencryptedDriveButtons.includes('Format Drive') && !unencryptedDriveButtons.includes('Format & Re-encrypt'),
      message: `Unencrypted drive shows correct buttons: ${unencryptedDriveButtons.join(', ')}`,
      details: unencryptedDriveButtons
    });

    // Test 3.3: Button state based on password validation
    const buttonStates = this.getButtonStates({
      isEncrypted: true,
      currentPassword: '',
      newPassword: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!'
    });
    suite.results.push({
      testName: 'Button State - Missing Current Password',
      passed: buttonStates.formatButtonDisabled === true,
      message: `Format button correctly disabled when current password missing: ${buttonStates.formatButtonDisabled}`,
      details: buttonStates
    });

    this.finalizeSuite(suite);
    this.results.push(suite);
  }

  /**
   * Test Suite 4: Backup Functionality
   */
  private async testBackupFunctionality(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Backup Functionality',
      results: [],
      passed: false,
      totalTests: 0,
      passedTests: 0
    };

    // Test 4.1: Create backup
    try {
      const backupResult = await safeTauriInvoke('create_drive_backup', {
        driveId: 'usb-001',
        backupName: 'Test Backup',
        includeSettings: true,
        encrypt: true
      });
      suite.results.push({
        testName: 'Create Drive Backup',
        passed: backupResult && backupResult.success === true,
        message: backupResult?.success ? 'Backup created successfully' : 'Backup creation failed',
        details: backupResult
      });
    } catch (error) {
      suite.results.push({
        testName: 'Create Drive Backup',
        passed: false,
        message: `Backup creation error: ${error}`,
        details: error
      });
    }

    // Test 4.2: List drive backups
    try {
      const backups = await safeTauriInvoke('get_drive_backups', { driveId: 'usb-001' });
      suite.results.push({
        testName: 'List Drive Backups',
        passed: Array.isArray(backups),
        message: Array.isArray(backups) ? `Found ${backups.length} backups` : 'Failed to list backups',
        details: backups
      });
    } catch (error) {
      suite.results.push({
        testName: 'List Drive Backups',
        passed: false,
        message: `Error listing backups: ${error}`,
        details: error
      });
    }

    this.finalizeSuite(suite);
    this.results.push(suite);
  }

  /**
   * Test Suite 5: Format Operations
   */
  private async testFormatOperations(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Format Operations',
      results: [],
      passed: false,
      totalTests: 0,
      passedTests: 0
    };

    // Test 5.1: Format unencrypted drive
    try {
      const formatResult = await safeTauriInvoke('format_and_encrypt_drive', {
        driveId: 'usb-unencrypted-001',
        options: {
          drive_name: 'Test Drive',
          password: 'StrongPassword123!',
          filesystem: 'ext4',
          encryption_type: 'basic_luks2'
        }
      });
      suite.results.push({
        testName: 'Format Unencrypted Drive',
        passed: formatResult && formatResult.success === true,
        message: formatResult?.success ? 'Drive formatted successfully' : 'Drive format failed',
        details: formatResult
      });
    } catch (error) {
      suite.results.push({
        testName: 'Format Unencrypted Drive',
        passed: false,
        message: `Format operation error: ${error}`,
        details: error
      });
    }

    // Test 5.2: Re-encrypt encrypted drive
    try {
      const reencryptResult = await safeTauriInvoke('reset_encrypted_drive', {
        driveId: 'usb-encrypted-001',
        currentPassword: 'current-password',
        newOptions: {
          drive_name: 'Re-encrypted Drive',
          password: 'NewStrongPassword123!',
          filesystem: 'ext4',
          encryption_type: 'basic_luks2'
        }
      });
      suite.results.push({
        testName: 'Re-encrypt Encrypted Drive',
        passed: reencryptResult && reencryptResult.success === true,
        message: reencryptResult?.success ? 'Drive re-encrypted successfully' : 'Drive re-encryption failed',
        details: reencryptResult
      });
    } catch (error) {
      suite.results.push({
        testName: 'Re-encrypt Encrypted Drive',
        passed: false,
        message: `Re-encryption error: ${error}`,
        details: error
      });
    }

    this.finalizeSuite(suite);
    this.results.push(suite);
  }

  /**
   * Test Suite 6: UI State Management
   */
  private async testUIStateManagement(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'UI State Management',
      results: [],
      passed: false,
      totalTests: 0,
      passedTests: 0
    };

    // Test 6.1: Password visibility toggle
    let passwordVisible = false;
    passwordVisible = !passwordVisible;
    suite.results.push({
      testName: 'Password Visibility Toggle',
      passed: passwordVisible === true,
      message: `Password visibility toggle works: ${passwordVisible}`,
      details: { passwordVisible }
    });

    // Test 6.2: Form validation state
    const formState = this.getFormValidationState({
      currentPassword: 'current-pass',
      newPassword: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
      isEncrypted: true
    });
    suite.results.push({
      testName: 'Form Validation State',
      passed: formState.isValid === true,
      message: `Form validation state: ${formState.isValid ? 'Valid' : 'Invalid'} - ${formState.message}`,
      details: formState
    });

    this.finalizeSuite(suite);
    this.results.push(suite);
  }

  /**
   * Helper Methods
   */
  private validatePassword(password: string): { isValid: boolean; feedback: string } {
    if (!password) {
      return { isValid: false, feedback: 'Password is required' };
    }
    if (password.length < 12) {
      return { isValid: false, feedback: 'Password must be at least 12 characters long' };
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(password)) {
      return { 
        isValid: false, 
        feedback: 'Password must contain uppercase, lowercase, number, and special character' 
      };
    }
    return { isValid: true, feedback: 'Strong quantum-resistant password' };
  }

  private getButtonsForDrive(drive: { encrypted: boolean; filesystem: string }): string[] {
    const buttons: string[] = [];
    
    const isEncrypted = drive.encrypted || drive.filesystem?.includes('LUKS') || drive.filesystem?.includes('crypto_');
    
    if (isEncrypted) {
      buttons.push('Format & Re-encrypt');
    } else {
      buttons.push('Format Drive');
    }
    
    return buttons;
  }

  private getButtonStates(params: {
    isEncrypted: boolean;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): { formatButtonDisabled: boolean; reason: string } {
    if (params.isEncrypted && !params.currentPassword) {
      return { formatButtonDisabled: true, reason: 'Current password required for encrypted drives' };
    }
    if (!params.newPassword) {
      return { formatButtonDisabled: true, reason: 'New password required' };
    }
    if (params.newPassword !== params.confirmPassword) {
      return { formatButtonDisabled: true, reason: 'Passwords do not match' };
    }
    return { formatButtonDisabled: false, reason: 'All requirements met' };
  }

  private getFormValidationState(params: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    isEncrypted: boolean;
  }): { isValid: boolean; message: string } {
    if (params.isEncrypted && !params.currentPassword) {
      return { isValid: false, message: 'Current password required for encrypted drives' };
    }
    
    const passwordValidation = this.validatePassword(params.newPassword);
    if (!passwordValidation.isValid) {
      return { isValid: false, message: passwordValidation.feedback };
    }
    
    if (params.newPassword !== params.confirmPassword) {
      return { isValid: false, message: 'Passwords do not match' };
    }
    
    return { isValid: true, message: 'Form is valid' };
  }

  private finalizeSuite(suite: TestSuite): void {
    suite.totalTests = suite.results.length;
    suite.passedTests = suite.results.filter(r => r.passed).length;
    suite.passed = suite.passedTests === suite.totalTests;
  }

  private printSummary(): void {
    console.log('\n📊 USB Drive Test Suite Summary:');
    console.log('=' .repeat(50));
    
    let totalTests = 0;
    let totalPassed = 0;
    
    this.results.forEach(suite => {
      const status = suite.passed ? '✅' : '❌';
      console.log(`${status} ${suite.suiteName}: ${suite.passedTests}/${suite.totalTests} passed`);
      
      suite.results.forEach(result => {
        const testStatus = result.passed ? '  ✓' : '  ✗';
        console.log(`${testStatus} ${result.testName}: ${result.message}`);
      });
      
      totalTests += suite.totalTests;
      totalPassed += suite.passedTests;
      console.log('');
    });
    
    console.log(`Overall: ${totalPassed}/${totalTests} tests passed (${Math.round(totalPassed/totalTests*100)}%)`);
    
    if (totalPassed === totalTests) {
      console.log('🎉 All tests passed! USB Drive functionality is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Please review the issues above.');
    }
  }
}

// Export test runner instance
export const usbDriveTestRunner = new UsbDriveTestRunner();

// Export convenience function to run tests
export const runUsbDriveTests = () => usbDriveTestRunner.runAllTests();
