#!/bin/bash

echo "=== USB Mount Detection Debug Script ==="
echo "Timestamp: $(date)"
echo

echo "=== 1. Check for LUKS encrypted mappings ==="
echo "Running: sudo dmsetup ls --target crypt"
sudo dmsetup ls --target crypt
echo

echo "=== 2. Check mount output for encrypted device ==="
echo "Running: mount | grep zap_quantum_vault"
mount | grep zap_quantum_vault
echo

echo "=== 3. Check all mounts containing 'mapper' ==="
echo "Running: mount | grep mapper"
mount | grep mapper
echo

echo "=== 4. Check /proc/mounts for encrypted device ==="
echo "Running: cat /proc/mounts | grep zap_quantum_vault"
cat /proc/mounts | grep zap_quantum_vault
echo

echo "=== 5. Check lsblk for device hierarchy ==="
echo "Running: lsblk | grep -A5 -B5 zap_quantum_vault"
lsblk | grep -A5 -B5 zap_quantum_vault || echo "No matches in lsblk"
echo

echo "=== 6. Check cryptsetup status ==="
echo "Running: sudo cryptsetup status zap_quantum_vault_encrypted"
sudo cryptsetup status zap_quantum_vault_encrypted
echo

echo "=== 7. Check if mount point exists and what's mounted there ==="
echo "Running: ls -la /media/ZAP_Quantum_Vault/"
ls -la /media/ZAP_Quantum_Vault/ 2>/dev/null || echo "Mount point not accessible"
echo

echo "=== 8. Find the original USB device ==="
echo "Running: lsblk -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE"
lsblk -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE
echo

echo "=== 9. Check USB devices specifically ==="
echo "Running: lsusb"
lsusb
echo

echo "=== 10. Check block device info ==="
echo "Running: sudo blkid | grep LUKS"
sudo blkid | grep LUKS
echo

echo "=== Debug script completed ==="
