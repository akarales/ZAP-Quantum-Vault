# ZAP Quantum Vault - Permissions Setup Guide

## 🔐 Problem
ZAP Quantum Vault requires administrative privileges for USB operations (mount, unmount, encryption) but asking for sudo password on every startup is inconvenient.

## 🛠️ Solutions

### **Option 1: Automated Setup (Recommended)**
```bash
cd /home/anubix/CODE/zapchat_project/zap_vault
./install/setup-permissions.sh
```

### **Option 2: Manual Sudoers Configuration**
1. Create sudoers file:
```bash
sudo visudo -f /etc/sudoers.d/zap-vault
```

2. Add these lines (replace `anubix` with your username):
```
anubix ALL=(ALL) NOPASSWD: /bin/mount
anubix ALL=(ALL) NOPASSWD: /bin/umount
anubix ALL=(ALL) NOPASSWD: /bin/mkdir
anubix ALL=(ALL) NOPASSWD: /sbin/cryptsetup
anubix ALL=(ALL) NOPASSWD: /sbin/blkid
anubix ALL=(ALL) NOPASSWD: /sbin/lsblk
anubix ALL=(ALL) NOPASSWD: /sbin/mkfs.ext4
anubix ALL=(ALL) NOPASSWD: /usr/bin/shred
anubix ALL=(ALL) NOPASSWD: /usr/bin/timeout
```

### **Option 3: User Groups (Alternative)**
```bash
# Add user to disk and plugdev groups
sudo usermod -a -G disk,plugdev $USER

# Create udev rules
sudo tee /etc/udev/rules.d/99-zap-vault-usb.rules << EOF
SUBSYSTEM=="block", ATTRS{removable}=="1", GROUP="plugdev", MODE="0664"
EOF

# Reload udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger
```

## 🔒 Security Considerations

### **What We're Granting Access To:**
- **Mount/Unmount**: USB drive mounting operations
- **Cryptsetup**: LUKS encryption/decryption
- **Filesystem tools**: Creating encrypted filesystems
- **Block device info**: Reading device information

### **What We're NOT Granting:**
- Full root access
- System file modifications
- Network operations
- Process management

### **Scope Limitation:**
- Permissions are user-specific
- Only specific commands are allowed
- No wildcard sudo access

## 🧪 Testing
After setup, test that the application works without password prompts:

```bash
# Test mount command
sudo mount --help

# Test cryptsetup
sudo cryptsetup --version

# Start ZAP Vault
cd /home/anubix/CODE/zapchat_project/zap_vault
pnpm run tauri dev
```

## 🗑️ Removal
To remove permissions:
```bash
sudo rm /etc/sudoers.d/zap-vault
sudo rm /etc/udev/rules.d/99-zap-vault-usb.rules
sudo rm /etc/polkit-1/rules.d/50-zap-vault.rules
```

## ⚠️ Important Notes
- **Logout/Login Required**: Group changes require session restart
- **User-Specific**: Replace `anubix` with your actual username
- **Minimal Permissions**: Only grants access to necessary USB operations
- **Reversible**: All changes can be easily undone

## 🎯 Recommended Approach
1. Use the automated setup script: `./install/setup-permissions.sh`
2. Choose option 1 (Sudoers configuration) for maximum compatibility
3. Test the application to ensure it works without password prompts
4. If issues persist, try option 4 (All methods) for maximum compatibility
