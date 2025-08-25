#!/bin/bash

# Setup passwordless sudo for ZAP Vault mount operations
echo "Setting up passwordless sudo for ZAP Vault mount operations..."

# Create sudoers rule for mount/unmount operations
SUDOERS_RULE="$USER ALL=(ALL) NOPASSWD: /bin/mount, /bin/umount, /bin/mkdir, /bin/rmdir, /usr/bin/blkid"

# Add the rule to sudoers
echo "$SUDOERS_RULE" | sudo tee /etc/sudoers.d/zap-vault-mount > /dev/null

# Set proper permissions
sudo chmod 440 /etc/sudoers.d/zap-vault-mount

# Verify the rule was added correctly
if sudo visudo -c -f /etc/sudoers.d/zap-vault-mount; then
    echo "✅ Sudoers rule added successfully!"
    echo "ZAP Vault can now mount/unmount drives without password prompts."
else
    echo "❌ Error: Failed to add sudoers rule"
    sudo rm -f /etc/sudoers.d/zap-vault-mount
    exit 1
fi

echo ""
echo "To remove this rule later, run:"
echo "sudo rm /etc/sudoers.d/zap-vault-mount"
