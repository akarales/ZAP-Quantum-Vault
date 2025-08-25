# ZAP Quantum Vault - Removable Drive Privileges Setup

This directory contains configuration files to grant the ZAP Quantum Vault application proper privileges for managing removable drives (USB drives, SD cards, etc.) without requiring full root access.

## Quick Setup

Run the automated setup script:

```bash
cd install
./setup-privileges.sh
```

**Important:** Log out and log back in after running the script for changes to take effect.

## What Gets Configured

### 1. PolicyKit Rules (`50-zap-vault-removable.rules`)
- Allows mounting/unmounting removable drives
- Permits formatting USB drives and SD cards
- Enables filesystem operations on removable media
- **Security:** Only applies to removable drives, not system drives

### 2. udev Rules (`99-zap-vault-udev.rules`)
- Sets proper permissions on removable drive devices
- Adds `uaccess` tag for user access
- Configures group ownership to `disk`

### 3. User Group Membership
- Adds current user to `disk` group
- Enables direct access to removable drive devices

## Manual Installation

If you prefer to install manually:

```bash
# Install PolicyKit rules
sudo cp 50-zap-vault-removable.rules /etc/polkit-1/rules.d/
sudo chmod 644 /etc/polkit-1/rules.d/50-zap-vault-removable.rules

# Install udev rules
sudo cp 99-zap-vault-udev.rules /etc/udev/rules.d/
sudo chmod 644 /etc/udev/rules.d/99-zap-vault-udev.rules

# Add user to disk group
sudo usermod -a -G disk $USER

# Reload rules
sudo udevadm control --reload-rules
sudo udevadm trigger
sudo systemctl restart polkit

# Log out and back in
```

## Security Notes

- These rules only grant privileges for **removable drives**
- System drives and fixed storage remain protected
- No full root access is granted to the application
- Uses modern Linux privilege separation (PolicyKit + udev)

## Troubleshooting

If you still get permission errors:

1. **Check group membership:**
   ```bash
   groups $USER
   ```
   Should include `disk`

2. **Verify rules are installed:**
   ```bash
   ls -la /etc/polkit-1/rules.d/50-zap-vault-removable.rules
   ls -la /etc/udev/rules.d/99-zap-vault-udev.rules
   ```

3. **Test with a simple command:**
   ```bash
   pkexec mount /dev/sdX /mnt/test
   ```

4. **Check logs:**
   ```bash
   journalctl -u polkit
   ```

## Uninstalling

To remove the privileges:

```bash
sudo rm /etc/polkit-1/rules.d/50-zap-vault-removable.rules
sudo rm /etc/udev/rules.d/99-zap-vault-udev.rules
sudo gpasswd -d $USER disk
sudo systemctl restart polkit
sudo udevadm control --reload-rules
```
