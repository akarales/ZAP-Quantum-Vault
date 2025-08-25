#!/bin/bash

# Run ZAP Vault with sudo privileges for formatting operations
echo "=== ZAP Vault with Elevated Privileges ==="
echo "This will run the ZAP Vault application with sudo privileges"
echo "to enable USB drive formatting without privilege escalation dialogs."
echo ""

# Check if we're already running as root
if [[ $EUID -eq 0 ]]; then
    echo "Already running as root. Starting ZAP Vault..."
    cd /home/anubix/CODE/zapchat_project/zap_vault
    cargo tauri dev
else
    echo "Requesting sudo privileges..."
    sudo -v  # Refresh sudo timestamp
    
    if [[ $? -eq 0 ]]; then
        echo "Sudo privileges granted. Starting ZAP Vault with elevated privileges..."
        cd /home/anubix/CODE/zapchat_project/zap_vault
        sudo -E cargo tauri dev
    else
        echo "Failed to obtain sudo privileges. Exiting."
        exit 1
    fi
fi
