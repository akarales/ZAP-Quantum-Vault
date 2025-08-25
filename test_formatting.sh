#!/bin/bash

# ZAP Vault USB Drive Formatting Test Script
# This script tests the USB drive formatting functionality

set -e  # Exit on any error

echo "=== ZAP Vault USB Drive Formatting Test ==="
echo "Date: $(date)"
echo "User: $(whoami)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}[$(date '+%H:%M:%S')] ${message}${NC}"
}

# Function to check if command exists
check_command() {
    if ! command -v "$1" &> /dev/null; then
        print_status $RED "ERROR: Required command '$1' not found"
        exit 1
    fi
}

# Function to detect USB drives
detect_usb_drives() {
    print_status $BLUE "Detecting USB drives..."
    
    # Find removable drives
    local usb_drives=()
    for device in /dev/sd*; do
        if [[ -b "$device" ]] && [[ ! "$device" =~ [0-9]$ ]]; then
            # Check if it's removable
            local removable_file="/sys/block/$(basename $device)/removable"
            if [[ -f "$removable_file" ]] && [[ $(cat "$removable_file") == "1" ]]; then
                usb_drives+=("$device")
            fi
        fi
    done
    
    if [[ ${#usb_drives[@]} -eq 0 ]]; then
        print_status $YELLOW "No USB drives detected"
        return 1
    fi
    
    print_status $GREEN "Found USB drives: ${usb_drives[*]}"
    echo "${usb_drives[0]}"  # Return first USB drive
}

# Function to check current mount status
check_mount_status() {
    local device=$1
    print_status $BLUE "Checking mount status for $device..."
    
    # Check all partitions of the device
    for partition in ${device}*; do
        if [[ -b "$partition" ]]; then
            local mount_point=$(findmnt -rno TARGET "$partition" 2>/dev/null || echo "")
            if [[ -n "$mount_point" ]]; then
                print_status $YELLOW "Partition $partition is mounted at: $mount_point"
            else
                print_status $GREEN "Partition $partition is not mounted"
            fi
        fi
    done
}

# Function to test unmounting
test_unmount() {
    local device=$1
    print_status $BLUE "Testing unmount functionality for $device..."
    
    # Try to unmount all partitions
    for partition in ${device}*; do
        if [[ -b "$partition" ]]; then
            local mount_point=$(findmnt -rno TARGET "$partition" 2>/dev/null || echo "")
            if [[ -n "$mount_point" ]]; then
                print_status $YELLOW "Attempting to unmount $partition from $mount_point..."
                
                # Try different unmount strategies
                if umount "$partition" 2>/dev/null; then
                    print_status $GREEN "Successfully unmounted $partition"
                elif umount -f "$partition" 2>/dev/null; then
                    print_status $GREEN "Force unmounted $partition"
                elif umount -l "$partition" 2>/dev/null; then
                    print_status $GREEN "Lazy unmounted $partition"
                else
                    print_status $RED "Failed to unmount $partition"
                    return 1
                fi
            fi
        fi
    done
    
    return 0
}

# Function to test process killing
test_process_killing() {
    local device=$1
    print_status $BLUE "Testing process killing for $device..."
    
    # Check for processes using the device
    if fuser "$device" 2>/dev/null; then
        print_status $YELLOW "Processes found using $device"
        fuser -v "$device" 2>/dev/null || true
        
        # Kill processes (in test mode, just show what would be killed)
        print_status $YELLOW "Would kill processes using: fuser -km $device"
    else
        print_status $GREEN "No processes using $device"
    fi
}

# Function to test filesystem clearing
test_filesystem_clearing() {
    local device=$1
    print_status $BLUE "Testing filesystem clearing for $device..."
    
    # Show current filesystem signatures
    print_status $YELLOW "Current filesystem signatures:"
    wipefs -n "$device" 2>/dev/null || print_status $GREEN "No filesystem signatures found"
    
    print_status $YELLOW "Would clear signatures using: wipefs -af $device"
}

# Function to simulate partitioning
test_partitioning() {
    local device=$1
    print_status $BLUE "Testing partitioning simulation for $device..."
    
    # Show current partition table
    print_status $YELLOW "Current partition table:"
    parted "$device" print 2>/dev/null || print_status $YELLOW "No partition table found"
    
    print_status $YELLOW "Would create partition table using:"
    echo "  parted $device --script mklabel msdos"
    echo "  parted $device --script mkpart primary ext4 0% 100%"
}

# Function to simulate formatting
test_formatting() {
    local device=$1
    local partition="${device}1"
    print_status $BLUE "Testing formatting simulation for $partition..."
    
    # Check if partition exists
    if [[ -b "$partition" ]]; then
        print_status $GREEN "Partition $partition exists"
        
        # Show current filesystem
        local fstype=$(blkid -o value -s TYPE "$partition" 2>/dev/null || echo "unknown")
        print_status $YELLOW "Current filesystem: $fstype"
        
        print_status $YELLOW "Would format using: mkfs.ext4 -F -L ZAP_VAULT $partition"
    else
        print_status $YELLOW "Partition $partition does not exist (would be created)"
    fi
}

# Function to run comprehensive test
run_comprehensive_test() {
    local device=$1
    
    print_status $BLUE "=== COMPREHENSIVE FORMATTING TEST ==="
    print_status $BLUE "Device: $device"
    echo ""
    
    # Test each step
    check_mount_status "$device"
    echo ""
    
    test_unmount "$device"
    echo ""
    
    test_process_killing "$device"
    echo ""
    
    test_filesystem_clearing "$device"
    echo ""
    
    test_partitioning "$device"
    echo ""
    
    test_formatting "$device"
    echo ""
    
    print_status $GREEN "=== TEST COMPLETED ==="
}

# Main execution
main() {
    print_status $GREEN "Starting ZAP Vault formatting test..."
    echo ""
    
    # Check required commands
    print_status $BLUE "Checking system requirements..."
    local required_commands=("parted" "mkfs.ext4" "wipefs" "fuser" "findmnt" "blkid")
    for cmd in "${required_commands[@]}"; do
        check_command "$cmd"
    done
    print_status $GREEN "All required commands found"
    echo ""
    
    # Detect USB drives
    local usb_device
    if usb_device=$(detect_usb_drives); then
        echo ""
        
        # Ask for confirmation
        read -p "Test formatting functionality on $usb_device? (y/N): " -n 1 -r
        echo ""
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            run_comprehensive_test "$usb_device"
        else
            print_status $YELLOW "Test cancelled by user"
        fi
    else
        print_status $RED "No USB drives found for testing"
        exit 1
    fi
}

# Run main function
main "$@"
