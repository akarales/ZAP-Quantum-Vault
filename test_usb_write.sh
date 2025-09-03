#!/bin/bash

# Test script to write to USB drive and verify backup functionality
# USB Drive is mounted at /media/test1

USB_MOUNT_POINT="/media/test1"
TEST_DIR="$USB_MOUNT_POINT/ZAP_QUANTUM_VAULT_BACKUPS"
BACKUP_ID="test_backup_$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$TEST_DIR/$BACKUP_ID"

echo "=== ZAP Quantum Vault USB Write Test ==="
echo "USB Mount Point: $USB_MOUNT_POINT"
echo "Backup Directory: $BACKUP_DIR"
echo

# Check if USB drive is mounted and writable
if [ ! -d "$USB_MOUNT_POINT" ]; then
    echo "❌ ERROR: USB drive not mounted at $USB_MOUNT_POINT"
    exit 1
fi

# Test write permissions
echo "🔍 Testing write permissions..."
TEST_FILE="$USB_MOUNT_POINT/.backup_test"
if echo "test" > "$TEST_FILE" 2>/dev/null; then
    echo "✅ Write permissions confirmed"
    rm -f "$TEST_FILE"
else
    echo "❌ ERROR: No write permissions on USB drive"
    exit 1
fi

# Create backup directory structure
echo "📁 Creating backup directory structure..."
mkdir -p "$BACKUP_DIR/vaults"
mkdir -p "$BACKUP_DIR/keys" 
mkdir -p "$BACKUP_DIR/metadata"

if [ $? -eq 0 ]; then
    echo "✅ Backup directories created successfully"
else
    echo "❌ ERROR: Failed to create backup directories"
    exit 1
fi

# Create test vault data (encrypted)
echo "🔐 Creating test encrypted vault data..."
VAULT_DATA="Test encrypted vault data - Bitcoin Address: 1KtGchdCPSp9JjoNXVa2kGzuEKSvtymHF6"
echo "$VAULT_DATA" > "$BACKUP_DIR/vaults/vault_data.enc"

# Create test recovery phrase
echo "🔑 Creating test recovery phrase..."
RECOVERY_PHRASE="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
echo "$RECOVERY_PHRASE" > "$BACKUP_DIR/keys/recovery.txt"

# Create backup metadata
echo "📋 Creating backup metadata..."
cat > "$BACKUP_DIR/metadata/backup.json" << EOF
{
  "id": "$BACKUP_ID",
  "drive_id": "usb_sdf",
  "backup_type": "Full",
  "backup_path": "$BACKUP_DIR",
  "vault_ids": ["86d2c9e7-ab51-4add-962d-f3ae4a134fd2"],
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "size_bytes": $(echo -n "$VAULT_DATA" | wc -c),
  "checksum": "$(echo -n "$VAULT_DATA" | sha256sum | cut -d' ' -f1)",
  "encryption_method": "ZAP-Quantum-Crypto-v1.0",
  "item_count": 1,
  "vault_count": 1
}
EOF

# Verify files were created
echo "🔍 Verifying backup files..."
if [ -f "$BACKUP_DIR/vaults/vault_data.enc" ] && \
   [ -f "$BACKUP_DIR/keys/recovery.txt" ] && \
   [ -f "$BACKUP_DIR/metadata/backup.json" ]; then
    echo "✅ All backup files created successfully"
else
    echo "❌ ERROR: Some backup files missing"
    exit 1
fi

# Display backup information
echo
echo "=== Backup Created Successfully ==="
echo "Backup ID: $BACKUP_ID"
echo "Location: $BACKUP_DIR"
echo "Files created:"
ls -la "$BACKUP_DIR"/*
echo
echo "Vault data size: $(stat -c%s "$BACKUP_DIR/vaults/vault_data.enc") bytes"
echo "Recovery phrase: $(head -c 50 "$BACKUP_DIR/keys/recovery.txt")..."
echo
echo "✅ USB write test completed successfully!"
echo "The backup system can now write to: $USB_MOUNT_POINT"
