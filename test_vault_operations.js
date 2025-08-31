/**
 * Comprehensive Vault Operations Test Script
 * Tests vault creation, retrieval, and deletion with detailed logging
 * 
 * Usage: Run this in the browser console when the Tauri app is running
 */

class VaultTester {
    constructor() {
        this.testResults = [];
        this.createdVaults = [];
    }

    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        console.log(`%c${logEntry}`, this.getLogStyle(level));
        if (data) {
            console.log('%cData:', 'color: #666; font-style: italic;', data);
        }
        
        this.testResults.push({
            timestamp,
            level,
            message,
            data
        });
    }

    getLogStyle(level) {
        const styles = {
            info: 'color: #2196F3; font-weight: bold;',
            success: 'color: #4CAF50; font-weight: bold;',
            error: 'color: #F44336; font-weight: bold;',
            warning: 'color: #FF9800; font-weight: bold;',
            debug: 'color: #9C27B0; font-weight: normal;'
        };
        return styles[level] || 'color: #333;';
    }

    async testTauriConnection() {
        this.log('info', '🔌 Testing Tauri connection...');
        
        if (!window.__TAURI__) {
            this.log('error', '❌ Tauri not available - make sure app is running');
            return false;
        }
        
        if (!window.__TAURI__.core) {
            this.log('error', '❌ Tauri core not available');
            return false;
        }
        
        this.log('success', '✅ Tauri connection established');
        this.log('debug', 'Available Tauri commands:', Object.keys(window.__TAURI__.core));
        return true;
    }

    async testVaultCreation(testName = 'test_vault') {
        this.log('info', `🔨 Testing vault creation: ${testName}`);
        
        const vaultData = {
            name: testName,
            description: `Test vault created at ${new Date().toISOString()}`,
            vault_type: 'Personal',
            encryption_password: this.generateSecurePassword(),
            is_shared: false
        };
        
        this.log('debug', 'Vault creation request data:', vaultData);
        
        try {
            this.log('info', '📤 Sending create_vault_offline request...');
            const result = await window.__TAURI__.core.invoke('create_vault_offline', {
                request: vaultData
            });
            
            this.log('success', `✅ Vault created successfully: ${result.id}`);
            this.log('debug', 'Created vault details:', result);
            
            this.createdVaults.push(result);
            return result;
            
        } catch (error) {
            this.log('error', `❌ Vault creation failed: ${error}`);
            this.log('error', 'Error details:', {
                message: error.message || error,
                type: typeof error,
                stack: error.stack
            });
            throw error;
        }
    }

    async testVaultRetrieval() {
        this.log('info', '📋 Testing vault retrieval...');
        
        try {
            this.log('info', '📤 Sending get_user_vaults_offline request...');
            const vaults = await window.__TAURI__.core.invoke('get_user_vaults_offline');
            
            this.log('success', `✅ Retrieved ${vaults.length} vaults`);
            this.log('debug', 'Retrieved vaults:', vaults);
            
            return vaults;
            
        } catch (error) {
            this.log('error', `❌ Vault retrieval failed: ${error}`);
            this.log('error', 'Error details:', error);
            throw error;
        }
    }

    async testVaultDeletion(vaultId) {
        this.log('info', `🗑️ Testing vault deletion: ${vaultId}`);
        
        try {
            this.log('info', '📤 Sending delete_vault_offline request...');
            const result = await window.__TAURI__.core.invoke('delete_vault_offline', {
                vault_id: vaultId
            });
            
            this.log('success', `✅ Vault deleted successfully: ${vaultId}`);
            this.log('debug', 'Deletion result:', result);
            
            // Remove from our tracking
            this.createdVaults = this.createdVaults.filter(v => v.id !== vaultId);
            
            return result;
            
        } catch (error) {
            this.log('error', `❌ Vault deletion failed: ${error}`);
            this.log('error', 'Error details:', error);
            throw error;
        }
    }

    async testPasswordStorage(vaultId, vaultName) {
        this.log('info', `🔐 Testing password storage for vault: ${vaultId}`);
        
        try {
            const passwords = await window.__TAURI__.core.invoke('get_vault_passwords', {
                userId: 'default_user',
                vaultId: vaultId
            });
            
            this.log('success', `✅ Retrieved ${passwords.length} stored passwords`);
            this.log('debug', 'Stored passwords:', passwords);
            
            return passwords;
            
        } catch (error) {
            this.log('error', `❌ Password retrieval failed: ${error}`);
            this.log('error', 'Error details:', error);
            throw error;
        }
    }

    generateSecurePassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        let password = '';
        for (let i = 0; i < 24; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    async runFullTest() {
        this.log('info', '🚀 Starting comprehensive vault operations test...');
        
        try {
            // Test 1: Tauri Connection
            const tauriOk = await this.testTauriConnection();
            if (!tauriOk) return;
            
            // Test 2: Initial vault retrieval
            this.log('info', '📋 Step 1: Testing initial vault retrieval...');
            const initialVaults = await this.testVaultRetrieval();
            
            // Test 3: Vault creation
            this.log('info', '🔨 Step 2: Testing vault creation...');
            const testVaultName = `test_vault_${Date.now()}`;
            const createdVault = await this.testVaultCreation(testVaultName);
            
            // Test 4: Verify creation by retrieving vaults again
            this.log('info', '🔍 Step 3: Verifying vault creation...');
            const vaultsAfterCreation = await this.testVaultRetrieval();
            
            if (vaultsAfterCreation.length > initialVaults.length) {
                this.log('success', '✅ Vault creation verified - vault count increased');
            } else {
                this.log('warning', '⚠️ Vault count did not increase after creation');
            }
            
            // Test 5: Password storage verification
            this.log('info', '🔐 Step 4: Testing password storage...');
            await this.testPasswordStorage(createdVault.id, createdVault.name);
            
            // Test 6: Vault deletion
            this.log('info', '🗑️ Step 5: Testing vault deletion...');
            await this.testVaultDeletion(createdVault.id);
            
            // Test 7: Verify deletion
            this.log('info', '🔍 Step 6: Verifying vault deletion...');
            const vaultsAfterDeletion = await this.testVaultRetrieval();
            
            if (vaultsAfterDeletion.length === initialVaults.length) {
                this.log('success', '✅ Vault deletion verified - vault count restored');
            } else {
                this.log('warning', '⚠️ Vault count mismatch after deletion');
            }
            
            this.log('success', '🎉 All tests completed successfully!');
            this.printSummary();
            
        } catch (error) {
            this.log('error', '💥 Test suite failed:', error);
            this.printSummary();
            throw error;
        }
    }

    async cleanupCreatedVaults() {
        this.log('info', `🧹 Cleaning up ${this.createdVaults.length} created vaults...`);
        
        for (const vault of this.createdVaults) {
            try {
                await this.testVaultDeletion(vault.id);
            } catch (error) {
                this.log('warning', `Failed to cleanup vault ${vault.id}: ${error}`);
            }
        }
        
        this.createdVaults = [];
        this.log('success', '✅ Cleanup completed');
    }

    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));
        
        const summary = this.testResults.reduce((acc, result) => {
            acc[result.level] = (acc[result.level] || 0) + 1;
            return acc;
        }, {});
        
        Object.entries(summary).forEach(([level, count]) => {
            const icon = {
                info: 'ℹ️',
                success: '✅',
                error: '❌',
                warning: '⚠️',
                debug: '🔍'
            }[level] || '📝';
            
            console.log(`${icon} ${level.toUpperCase()}: ${count}`);
        });
        
        console.log('='.repeat(60));
        console.log(`📝 Total log entries: ${this.testResults.length}`);
        console.log(`🗂️ Created vaults remaining: ${this.createdVaults.length}`);
        console.log('='.repeat(60) + '\n');
    }

    exportResults() {
        const exportData = {
            timestamp: new Date().toISOString(),
            testResults: this.testResults,
            createdVaults: this.createdVaults,
            summary: this.testResults.reduce((acc, result) => {
                acc[result.level] = (acc[result.level] || 0) + 1;
                return acc;
            }, {})
        };
        
        console.log('📤 Exporting test results...');
        console.log(JSON.stringify(exportData, null, 2));
        
        return exportData;
    }
}

// Global instance for easy access
window.vaultTester = new VaultTester();

// Quick test functions
window.testVaultCreation = () => window.vaultTester.testVaultCreation();
window.testVaultRetrieval = () => window.vaultTester.testVaultRetrieval();
window.runFullVaultTest = () => window.vaultTester.runFullTest();
window.cleanupVaults = () => window.vaultTester.cleanupCreatedVaults();

console.log('🔧 Vault Tester loaded! Available commands:');
console.log('  - runFullVaultTest() - Run complete test suite');
console.log('  - testVaultCreation() - Test vault creation only');
console.log('  - testVaultRetrieval() - Test vault retrieval only');
console.log('  - cleanupVaults() - Clean up any created test vaults');
console.log('  - vaultTester.exportResults() - Export detailed results');
console.log('\n🚀 Run runFullVaultTest() to start testing!');
