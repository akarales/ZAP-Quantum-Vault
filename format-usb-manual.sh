#!/bin/bash

# Manual USB Drive Formatting Script for ZAP Vault
# This script handles the formatting process outside the app when kernel locks occur

set -e

DEVICE="$1"
LABEL="${2:-ZAP_VAULT}"

if [ -z "$DEVICE" ]; then
    echo "Usage: $0 <device> [label]"
    echo "Example: $0 /dev/sde ZAP_VAULT"
    exit 1
fi

echo "🔄 Starting manual USB drive formatting for $DEVICE..."

# Step 1: Force unmount everything
echo "📤 Unmounting all partitions..."
sudo umount ${DEVICE}* 2>/dev/null || true
sudo umount /media/*/USB* 2>/dev/null || true
sudo umount /media/*/${LABEL}* 2>/dev/null || true

# Step 2: Kill any processes using the device
echo "🔪 Killing processes using the device..."
sudo fuser -km ${DEVICE}* 2>/dev/null || true

# Step 3: Clear all filesystem signatures
echo "🧹 Clearing filesystem signatures..."
sudo wipefs -af ${DEVICE}

# Step 4: Zero out the beginning of the device
echo "💾 Zeroing device sectors..."
sudo dd if=/dev/zero of=${DEVICE} bs=1M count=10 conv=fsync 2>/dev/null

# Step 5: Create new partition table
echo "📋 Creating new partition table..."
sudo parted ${DEVICE} --script mklabel msdos
sudo parted ${DEVICE} --script mkpart primary ext4 0% 100%

# Step 6: Inform kernel of changes
echo "🔄 Updating kernel partition table..."
sudo partprobe ${DEVICE}
sleep 2

# Step 7: Format the first partition
echo "💿 Formatting ${DEVICE}1 with ext4..."
sudo mkfs.ext4 -F -L ${LABEL} ${DEVICE}1

# Step 8: Verify the formatting
echo "✅ Verifying filesystem..."
sudo fsck.ext4 -f ${DEVICE}1

echo "🎉 USB drive formatting completed successfully!"
echo "📁 Device: ${DEVICE}1"
echo "🏷️  Label: ${LABEL}"
echo "📊 Filesystem: ext4"

# Step 9: Mount to test
MOUNT_POINT="/media/${USER}/${LABEL}"
echo "🔗 Testing mount at ${MOUNT_POINT}..."
sudo mkdir -p ${MOUNT_POINT}
sudo mount ${DEVICE}1 ${MOUNT_POINT}
sudo chown ${USER}:${USER} ${MOUNT_POINT}

echo "✨ Drive is ready for use at ${MOUNT_POINT}"
