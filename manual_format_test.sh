#!/bin/bash

# Manual USB drive formatting test
# This will actually format the drive (destructive!)

set -e

DEVICE="/dev/sde"
PARTITION="${DEVICE}1"

echo "=== MANUAL USB DRIVE FORMAT TEST ==="
echo "Device: $DEVICE"
echo "Partition: $PARTITION"
echo ""

# Confirm with user
read -p "This will DESTROY all data on $DEVICE. Continue? (yes/NO): " confirm
if [[ "$confirm" != "yes" ]]; then
    echo "Aborted."
    exit 1
fi

echo "Starting format process..."

# Step 1: Unmount everything
echo "1. Unmounting partitions..."
sudo umount ${DEVICE}* 2>/dev/null || true
sudo umount /media/*/ZAP_VAULT 2>/dev/null || true

# Step 2: Kill processes
echo "2. Killing processes using device..."
sudo fuser -km $DEVICE 2>/dev/null || true

# Step 3: Clear signatures
echo "3. Clearing filesystem signatures..."
sudo wipefs -af $DEVICE

# Step 4: Zero device
echo "4. Zeroing first sectors..."
sudo dd if=/dev/zero of=$DEVICE bs=1M count=10 conv=fsync

# Step 5: Create partition table
echo "5. Creating partition table..."
sudo parted $DEVICE --script mklabel msdos
sudo parted $DEVICE --script mkpart primary ext4 0% 100%

# Step 6: Update kernel
echo "6. Updating kernel partition table..."
sudo partprobe $DEVICE
sleep 2

# Step 7: Format partition
echo "7. Formatting partition..."
sudo mkfs.ext4 -F -L ZAP_VAULT $PARTITION

# Step 8: Verify filesystem
echo "8. Verifying filesystem..."
sudo fsck.ext4 -f -y $PARTITION

echo ""
echo "=== FORMAT COMPLETED SUCCESSFULLY ==="
echo "Device: $DEVICE"
echo "Partition: $PARTITION"
echo "Label: ZAP_VAULT"
