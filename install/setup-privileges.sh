#!/bin/bash

# ZAP Quantum Vault Privilege Setup Script
# This script configures the necessary permissions for removable drive access

set -e

echo "🔐 Setting up ZAP Quantum Vault removable drive privileges..."

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    echo "❌ Please run this script as a regular user, not root"
    echo "   The script will ask for sudo when needed"
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📋 Installing PolicyKit rules..."
sudo cp "$SCRIPT_DIR/50-zap-vault-removable.rules" /etc/polkit-1/rules.d/
sudo chown root:root /etc/polkit-1/rules.d/50-zap-vault-removable.rules
sudo chmod 644 /etc/polkit-1/rules.d/50-zap-vault-removable.rules

echo "🔌 Installing udev rules..."
sudo cp "$SCRIPT_DIR/99-zap-vault-udev.rules" /etc/udev/rules.d/
sudo chown root:root /etc/udev/rules.d/99-zap-vault-udev.rules
sudo chmod 644 /etc/udev/rules.d/99-zap-vault-udev.rules

echo "👥 Adding user to disk group..."
sudo usermod -a -G disk "$USER"

echo "🔄 Reloading udev rules..."
sudo udevadm control --reload-rules
sudo udevadm trigger

echo "🔄 Restarting PolicyKit..."
sudo systemctl restart polkit

echo ""
echo "✅ ZAP Quantum Vault privileges configured successfully!"
echo ""
echo "📝 What was configured:"
echo "   • PolicyKit rules for removable drive access"
echo "   • udev rules for automatic permissions"
echo "   • Added $USER to 'disk' group"
echo ""
echo "⚠️  IMPORTANT: You need to log out and log back in for group changes to take effect"
echo "   Or run: newgrp disk"
echo ""
echo "🚀 After logging back in, the vault app will have proper permissions for:"
echo "   • Formatting USB drives and SD cards"
echo "   • Mounting/unmounting removable drives"
echo "   • Creating quantum vault structures"
echo ""
echo "🔒 Security: These privileges only apply to removable drives, not system drives"
