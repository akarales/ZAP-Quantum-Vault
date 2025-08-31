#!/usr/bin/env node

/**
 * Diagnostic Script for ZAP Quantum Vault USB Drive Commands
 * Tests all backend Tauri commands to identify correct parameter formats
 */

const { invoke } = require('@tauri-apps/api/core');

// Test results storage
const testResults = {
  commands: {},
  errors: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0
  }
};

// Helper function to test a command with different parameter formats
async function testCommand(commandName, parameterVariations, description) {
  console.log(`\n🧪 Testing: ${commandName} - ${description}`);
  console.log('=' .repeat(60));
  
  testResults.commands[commandName] = {
    description,
    variations: [],
    working: null,
    error: null
  };

  for (const [varName, params] of Object.entries(parameterVariations)) {
    try {
      console.log(`  📝 Trying variation "${varName}":`, JSON.stringify(params));
      const result = await invoke(commandName, params);
      console.log(`  ✅ SUCCESS - ${varName}:`, typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
      
      testResults.commands[commandName].variations.push({
        name: varName,
        params,
        success: true,
        result
      });
      
      if (!testResults.commands[commandName].working) {
        testResults.commands[commandName].working = { name: varName, params };
      }
      
      testResults.summary.passed++;
    } catch (error) {
      console.log(`  ❌ FAILED - ${varName}:`, error.toString());
      testResults.commands[commandName].variations.push({
        name: varName,
        params,
        success: false,
        error: error.toString()
      });
      testResults.summary.failed++;
    }
    testResults.summary.total++;
  }
}

// Main diagnostic function
async function runDiagnostics() {
  console.log('🚀 Starting ZAP Quantum Vault Backend Command Diagnostics');
  console.log('=' .repeat(80));

  try {
    // First, get the list of available USB drives
    console.log('\n📋 Step 1: Getting USB drive list...');
    const drives = await invoke('detect_usb_drives');
    console.log('Available drives:', JSON.stringify(drives, null, 2));
    
    if (!drives || drives.length === 0) {
      console.log('⚠️  No USB drives detected. Some tests may fail.');
      testResults.errors.push('No USB drives detected for testing');
    }

    const testDriveId = drives && drives.length > 0 ? drives[0].id : 'usb_sdf';
    console.log(`🎯 Using drive ID for tests: ${testDriveId}`);

    // Test 1: detect_usb_drives
    await testCommand('detect_usb_drives', {
      'no_params': {},
    }, 'Detect USB drives');

    // Test 2: get_drive_details
    await testCommand('get_drive_details', {
      'driveId': { driveId: testDriveId },
      'drive_id': { drive_id: testDriveId },
      'id': { id: testDriveId },
      'drive': { drive: testDriveId }
    }, 'Get drive details');

    // Test 3: mount_drive
    await testCommand('mount_drive', {
      'driveId': { driveId: testDriveId },
      'drive_id': { drive_id: testDriveId },
      'id': { id: testDriveId }
    }, 'Mount drive');

    // Test 4: unmount_drive  
    await testCommand('unmount_drive', {
      'driveId': { driveId: testDriveId },
      'drive_id': { drive_id: testDriveId },
      'id': { id: testDriveId }
    }, 'Unmount drive');

    // Test 5: set_drive_trust
    await testCommand('set_drive_trust', {
      'driveId_trustLevel': { driveId: testDriveId, trustLevel: 'trusted' },
      'drive_id_trust_level': { drive_id: testDriveId, trust_level: 'trusted' },
      'id_level': { id: testDriveId, level: 'trusted' }
    }, 'Set drive trust level');

    // Test 6: get_usb_drive_password
    await testCommand('get_usb_drive_password', {
      'driveId': { driveId: testDriveId },
      'drive_id': { drive_id: testDriveId },
      'id': { id: testDriveId }
    }, 'Get USB drive password');

    // Test 7: encrypt_drive
    await testCommand('encrypt_drive', {
      'driveId_password': { driveId: testDriveId, password: 'test123' },
      'drive_id_password': { drive_id: testDriveId, password: 'test123' },
      'id_pass': { id: testDriveId, pass: 'test123' }
    }, 'Encrypt drive');

  } catch (error) {
    console.error('💥 Critical error during diagnostics:', error);
    testResults.errors.push(`Critical error: ${error.toString()}`);
  }

  // Generate summary report
  console.log('\n' + '=' .repeat(80));
  console.log('📊 DIAGNOSTIC SUMMARY REPORT');
  console.log('=' .repeat(80));
  
  console.log(`\n📈 Overall Results:`);
  console.log(`  Total tests: ${testResults.summary.total}`);
  console.log(`  Passed: ${testResults.summary.passed}`);
  console.log(`  Failed: ${testResults.summary.failed}`);
  console.log(`  Success rate: ${testResults.summary.total > 0 ? ((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1) : 0}%`);

  console.log(`\n🔍 Command Analysis:`);
  for (const [cmdName, cmdData] of Object.entries(testResults.commands)) {
    console.log(`\n  ${cmdName}:`);
    if (cmdData.working) {
      console.log(`    ✅ Working format: ${cmdData.working.name}`);
      console.log(`    📝 Parameters: ${JSON.stringify(cmdData.working.params)}`);
    } else {
      console.log(`    ❌ No working format found`);
    }
  }

  if (testResults.errors.length > 0) {
    console.log(`\n⚠️  Errors encountered:`);
    testResults.errors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error}`);
    });
  }

  // Generate fix recommendations
  console.log('\n🔧 RECOMMENDED FIXES:');
  console.log('=' .repeat(50));
  
  const fixes = [];
  for (const [cmdName, cmdData] of Object.entries(testResults.commands)) {
    if (cmdData.working) {
      fixes.push({
        command: cmdName,
        correctFormat: cmdData.working.params,
        formatName: cmdData.working.name
      });
    }
  }

  if (fixes.length > 0) {
    console.log('\nUpdate frontend code to use these parameter formats:');
    fixes.forEach(fix => {
      console.log(`\n  ${fix.command}:`);
      console.log(`    invoke('${fix.command}', ${JSON.stringify(fix.correctFormat)});`);
    });
  }

  // Save results to file
  const fs = require('fs');
  const reportPath = './diagnostic_report.json';
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\n💾 Full report saved to: ${reportPath}`);

  return testResults;
}

// Run diagnostics if this script is executed directly
if (require.main === module) {
  runDiagnostics().catch(console.error);
}

module.exports = { runDiagnostics, testResults };
