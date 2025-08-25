#!/bin/bash

# ZAP Quantum Vault - Permission Setup Script
# This script configures the system to allow ZAP Vault to run USB operations without sudo prompts

set -e

echo "🔐 ZAP Quantum Vault - Setting up system permissions..."

# Get current username
CURRENT_USER=$(whoami)
echo "Setting up permissions for user: $CURRENT_USER"

# Method 1: Sudoers configuration (Recommended)
setup_sudoers() {
    echo "📝 Setting up sudoers configuration..."
    
    # Create sudoers file with current username
    sudo tee /etc/sudoers.d/zap-vault > /dev/null << EOF
# ZAP Quantum Vault - USB and encryption operations
# Generated for user: $CURRENT_USER
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/mount
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/umount
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/mkdir
$CURRENT_USER ALL=(ALL) NOPASSWD: /sbin/cryptsetup
$CURRENT_USER ALL=(ALL) NOPASSWD: /sbin/blkid
$CURRENT_USER ALL=(ALL) NOPASSWD: /sbin/lsblk
$CURRENT_USER ALL=(ALL) NOPASSWD: /sbin/mkfs.ext4
$CURRENT_USER ALL=(ALL) NOPASSWD: /sbin/mkfs.xfs
$CURRENT_USER ALL=(ALL) NOPASSWD: /sbin/mkfs.btrfs
$CURRENT_USER ALL=(ALL) NOPASSWD: /sbin/mkfs.f2fs
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/dd
$CURRENT_USER ALL=(ALL) NOPASSWD: /usr/bin/shred
$CURRENT_USER ALL=(ALL) NOPASSWD: /usr/bin/timeout
EOF

    # Set proper permissions
    sudo chmod 440 /etc/sudoers.d/zap-vault
    
    echo "✅ Sudoers configuration created at /etc/sudoers.d/zap-vault"
}

# Method 2: Add user to disk group (Less secure but simpler)
setup_disk_group() {
    echo "👥 Adding user to disk group..."
    sudo usermod -a -G disk $CURRENT_USER
    echo "✅ User added to disk group (requires logout/login to take effect)"
}

# Method 3: Create udev rules for USB devices
setup_udev_rules() {
    echo "🔌 Setting up udev rules for USB devices..."
    
    sudo tee /etc/udev/rules.d/99-zap-vault-usb.rules > /dev/null << EOF
# ZAP Quantum Vault - USB device permissions
# Allow users in plugdev group to access USB storage devices
SUBSYSTEM=="block", ATTRS{removable}=="1", GROUP="plugdev", MODE="0664"
SUBSYSTEM=="block", KERNEL=="sd[a-z]*", ATTRS{removable}=="1", GROUP="plugdev", MODE="0664"
EOF

    # Add user to plugdev group
    sudo usermod -a -G plugdev $CURRENT_USER
    
    # Reload udev rules
    sudo udevadm control --reload-rules
    sudo udevadm trigger
    
    echo "✅ Udev rules created and user added to plugdev group"
}

# Method 4: Polkit policy (Most secure)
setup_polkit() {
    echo "🛡️ Setting up polkit policy..."
    
    sudo tee /etc/polkit-1/rules.d/50-zap-vault.rules > /dev/null << EOF
// ZAP Quantum Vault - Polkit rules for USB operations
polkit.addRule(function(action, subject) {
    if ((action.id == "org.freedesktop.udisks2.filesystem-mount" ||
         action.id == "org.freedesktop.udisks2.filesystem-unmount" ||
         action.id == "org.freedesktop.udisks2.encrypted-unlock" ||
         action.id == "org.freedesktop.udisks2.encrypted-lock") &&
        subject.user == "$CURRENT_USER") {
        return polkit.Result.YES;
    }
});
EOF

    echo "✅ Polkit policy created"
}

# Main setup function
main() {
    echo "Choose setup method:"
    echo "1) Sudoers configuration (Recommended - most compatible)"
    echo "2) Disk group + Udev rules (Moderate security)"
    echo "3) Polkit policy (Most secure but may require udisks2)"
    echo "4) All methods (Maximum compatibility)"
    
    read -p "Enter choice (1-4): " choice
    
    case $choice in
        1)
            setup_sudoers
            ;;
        2)
            setup_disk_group
            setup_udev_rules
            ;;
        3)
            setup_polkit
            ;;
        4)
            setup_sudoers
            setup_disk_group
            setup_udev_rules
            setup_polkit
            ;;
        *)
            echo "Invalid choice. Using sudoers configuration..."
            setup_sudoers
            ;;
    esac
    
    echo ""
    echo "🎉 Setup complete!"
    echo ""
    echo "⚠️  IMPORTANT NOTES:"
    echo "• You may need to logout and login again for group changes to take effect"
    echo "• Test the application to ensure permissions work correctly"
    echo "• These permissions are specific to USB/encryption operations only"
    echo ""
    echo "🔒 Security Information:"
    echo "• Only specific commands are granted sudo access"
    echo "• Permissions are limited to the current user: $CURRENT_USER"
    echo "• You can remove permissions anytime with: sudo rm /etc/sudoers.d/zap-vault"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ Don't run this script as root. Run as your normal user."
   exit 1
fi

# Run main function
main
