#!/bin/bash
# cleanup-luks.sh - ZAP Quantum Vault LUKS and Loop Device Cleanup Script

set -e

echo "=== ZAP Quantum Vault LUKS and Loop Device Cleanup ==="
echo "This script will clean up orphaned LUKS mappings and loop devices"
echo

# Function to safely close LUKS mappings
cleanup_luks_mappings() {
    echo "1. Checking for LUKS mappings..."
    
    if [ -d "/dev/mapper" ]; then
        # Find LUKS mappings (exclude control and system mappings)
        mappers=$(ls /dev/mapper/ 2>/dev/null | grep -E "(luks_|test|vault|encrypted)" || true)
        
        if [ -n "$mappers" ]; then
            echo "Found LUKS mappings to clean up:"
            for mapper in $mappers; do
                echo "  - $mapper"
                
                # Check if mounted first
                mount_point=$(mount | grep "/dev/mapper/$mapper" | awk '{print $3}' || true)
                if [ -n "$mount_point" ]; then
                    echo "    Unmounting from: $mount_point"
                    sudo umount "$mount_point" 2>/dev/null || echo "    Warning: Failed to unmount $mount_point"
                fi
                
                # Close LUKS mapping
                echo "    Closing LUKS mapping: $mapper"
                sudo cryptsetup luksClose "$mapper" 2>/dev/null || echo "    Warning: Failed to close $mapper"
            done
        else
            echo "No LUKS mappings found to clean up"
        fi
    fi
}

# Function to clean up test loop devices
cleanup_test_loops() {
    echo
    echo "2. Checking for test loop devices..."
    
    # Find loop devices with test files
    test_loops=$(losetup -a | grep -E "(test|tmp)" | cut -d: -f1 || true)
    
    if [ -n "$test_loops" ]; then
        echo "Found test loop devices to clean up:"
        for loop in $test_loops; do
            echo "  - $loop"
            sudo losetup -d "$loop" 2>/dev/null || echo "    Warning: Failed to detach $loop"
        done
    else
        echo "No test loop devices found"
    fi
}

# Function to clean up orphaned mount points
cleanup_mount_points() {
    echo
    echo "3. Cleaning up orphaned mount points..."
    
    # Remove empty directories in /media (but not /media itself)
    if [ -d "/media" ]; then
        empty_dirs=$(find /media -mindepth 1 -type d -empty 2>/dev/null || true)
        if [ -n "$empty_dirs" ]; then
            echo "Removing empty mount points:"
            echo "$empty_dirs" | while read -r dir; do
                echo "  - $dir"
                sudo rmdir "$dir" 2>/dev/null || echo "    Warning: Failed to remove $dir"
            done
        else
            echo "No empty mount points found"
        fi
    fi
}

# Function to clean up test files
cleanup_test_files() {
    echo
    echo "4. Cleaning up test files..."
    
    test_files="/tmp/test_usb.img /tmp/test*.img"
    for file in $test_files; do
        if [ -f "$file" ]; then
            echo "  Removing: $file"
            sudo rm -f "$file"
        fi
    done
}

# Function to show final state
show_final_state() {
    echo
    echo "=== Final System State ==="
    
    echo "Remaining LUKS mappings:"
    ls -la /dev/mapper/ 2>/dev/null | grep -v "control\|total" || echo "  None"
    
    echo
    echo "Remaining loop devices (excluding system snaps):"
    losetup -a | grep -v "/var/lib/snapd" || echo "  None"
    
    echo
    echo "Active mounts in /media:"
    mount | grep "/media/" || echo "  None"
}

# Main execution
echo "Starting cleanup process..."
echo

# Check if running as root or with sudo access
if [ "$EUID" -eq 0 ]; then
    echo "Running as root - proceeding with cleanup"
elif sudo -n true 2>/dev/null; then
    echo "Sudo access confirmed - proceeding with cleanup"
else
    echo "Error: This script requires sudo access"
    echo "Please run: sudo $0"
    exit 1
fi

echo

# Execute cleanup steps
cleanup_luks_mappings
cleanup_test_loops
cleanup_mount_points
cleanup_test_files

echo
echo "=== Cleanup Complete ==="
show_final_state

echo
echo "If you still see persistent devices in the disk utility, they may be:"
echo "1. System-level artifacts that require a reboot to clear"
echo "2. Devices managed by other applications"
echo "3. Hardware-level issues requiring physical device removal"
