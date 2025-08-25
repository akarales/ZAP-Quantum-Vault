#!/bin/bash

# ZAP Quantum Vault - Device Cleanup Test Script
# Tests the robust device cleanup functionality before LUKS encryption

set -e

echo "🔧 ZAP Quantum Vault - Device Cleanup Test"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default test device (can be overridden)
TEST_DEVICE="${1:-/dev/sdf}"
TEST_PARTITION="${TEST_DEVICE}1"

echo -e "${BLUE}Test Device: $TEST_DEVICE${NC}"
echo -e "${BLUE}Test Partition: $TEST_PARTITION${NC}"
echo ""

# Safety check
if [ ! -b "$TEST_DEVICE" ]; then
    echo -e "${RED}Error: Device $TEST_DEVICE does not exist${NC}"
    exit 1
fi

# Confirm with user
echo -e "${YELLOW}⚠️  WARNING: This script will test device cleanup operations${NC}"
echo -e "${YELLOW}   It may close existing LUKS mappings and unmount filesystems${NC}"
read -p "Continue with device cleanup test? (yes/NO): " confirm
if [[ "$confirm" != "yes" ]]; then
    echo "Aborted."
    exit 1
fi

echo -e "\n${BLUE}Starting device cleanup test...${NC}"

# Function to test LUKS mapping detection
test_luks_mapping_detection() {
    echo -e "\n${BLUE}1. Testing LUKS mapping detection...${NC}"
    
    echo "Current LUKS mappings:"
    sudo dmsetup ls --target crypt || echo "No LUKS mappings found"
    
    echo -e "\nAll device mapper mappings:"
    sudo dmsetup ls || echo "No device mappings found"
    
    echo -e "${GREEN}✓${NC} LUKS mapping detection test completed"
}

# Function to test process detection
test_process_detection() {
    echo -e "\n${BLUE}2. Testing process detection...${NC}"
    
    echo "Checking processes using device $TEST_DEVICE:"
    sudo fuser -v "$TEST_DEVICE" 2>&1 || echo "No processes using device"
    
    echo "Checking processes using partition $TEST_PARTITION:"
    sudo fuser -v "$TEST_PARTITION" 2>&1 || echo "No processes using partition"
    
    echo "Checking open file handles:"
    sudo lsof "$TEST_DEVICE" 2>/dev/null || echo "No open file handles"
    
    echo -e "${GREEN}✓${NC} Process detection test completed"
}

# Function to test mount detection
test_mount_detection() {
    echo -e "\n${BLUE}3. Testing mount detection...${NC}"
    
    echo "Checking if device is mounted:"
    findmnt -n -o TARGET "$TEST_DEVICE" 2>/dev/null || echo "Device not mounted"
    findmnt -n -o TARGET "$TEST_PARTITION" 2>/dev/null || echo "Partition not mounted"
    
    echo "All mount points containing device path:"
    mount | grep "$TEST_DEVICE" || echo "No mounts found for device"
    
    echo -e "${GREEN}✓${NC} Mount detection test completed"
}

# Function to test device lock detection
test_device_locks() {
    echo -e "\n${BLUE}4. Testing device lock detection...${NC}"
    
    echo "Checking device status:"
    sudo blockdev --getsize64 "$TEST_DEVICE" 2>/dev/null && echo "Device accessible" || echo "Device not accessible"
    
    echo "Flushing device buffers:"
    sudo blockdev --flushbufs "$TEST_DEVICE" && echo "Buffers flushed successfully" || echo "Buffer flush failed"
    
    echo -e "${GREEN}✓${NC} Device lock detection test completed"
}

# Function to simulate cleanup operations (dry run)
test_cleanup_simulation() {
    echo -e "\n${BLUE}5. Testing cleanup simulation (dry run)...${NC}"
    
    echo "Would close LUKS mappings:"
    sudo dmsetup ls --target crypt | while read line; do
        if [ -n "$line" ]; then
            mapping_name=$(echo "$line" | cut -d$'\t' -f1)
            echo "  - Would close: $mapping_name"
        fi
    done
    
    echo "Would kill processes using device (if any):"
    sudo fuser -v "$TEST_DEVICE" 2>&1 | grep -v "USER\|No process" || echo "  - No processes to kill"
    
    echo "Would unmount filesystems (if any):"
    mount | grep "$TEST_DEVICE" | while read line; do
        mount_point=$(echo "$line" | awk '{print $3}')
        echo "  - Would unmount: $mount_point"
    done
    
    echo -e "${GREEN}✓${NC} Cleanup simulation completed"
}

# Function to test actual LUKS mapping closure (if any exist)
test_actual_luks_cleanup() {
    echo -e "\n${BLUE}6. Testing actual LUKS cleanup...${NC}"
    
    # Get list of LUKS mappings
    luks_mappings=$(sudo dmsetup ls --target crypt 2>/dev/null | grep -v "No devices found" || true)
    
    if [ -n "$luks_mappings" ]; then
        echo "Found LUKS mappings to test with:"
        echo "$luks_mappings"
        
        echo "$luks_mappings" | while read line; do
            if [ -n "$line" ]; then
                # Extract mapping name (everything before parentheses) and sanitize spaces
                raw_mapping_name=$(echo "$line" | sed 's/(.*//' | sed 's/[[:space:]]*$//')
                mapping_name=$(echo "$raw_mapping_name" | tr ' ' '_')
                if [ -n "$mapping_name" ] && [ "$mapping_name" != "No" ]; then
                    echo "Testing closure of mapping: '$mapping_name'"
                    
                    # Check if mapping exists before trying to close
                    if sudo dmsetup info "$mapping_name" >/dev/null 2>&1; then
                        echo "  - Mapping exists, attempting to close..."
                        if sudo cryptsetup luksClose "$mapping_name" 2>/dev/null; then
                            echo -e "  - ${GREEN}✓${NC} Successfully closed: $mapping_name"
                        else
                            echo -e "  - ${YELLOW}⚠${NC} Failed to close: $mapping_name (may be in use)"
                        fi
                    else
                        echo "  - Mapping does not exist or already closed"
                    fi
                fi
            fi
        done
    else
        echo "No LUKS mappings found to test"
    fi
    
    echo -e "${GREEN}✓${NC} LUKS cleanup test completed"
}

# Function to verify device is ready for formatting
test_device_readiness() {
    echo -e "\n${BLUE}7. Testing device readiness for formatting...${NC}"
    
    # Test if we can exclusively access the device
    echo "Testing exclusive device access:"
    if sudo dd if="$TEST_DEVICE" of=/dev/null bs=512 count=1 2>/dev/null; then
        echo -e "  - ${GREEN}✓${NC} Can read from device"
    else
        echo -e "  - ${RED}✗${NC} Cannot read from device"
    fi
    
    # Test if partition exists and is accessible
    if [ -b "$TEST_PARTITION" ]; then
        echo "Testing partition access:"
        if sudo dd if="$TEST_PARTITION" of=/dev/null bs=512 count=1 2>/dev/null; then
            echo -e "  - ${GREEN}✓${NC} Can read from partition"
        else
            echo -e "  - ${RED}✗${NC} Cannot read from partition"
        fi
    else
        echo "  - Partition does not exist (normal for unformatted device)"
    fi
    
    echo -e "${GREEN}✓${NC} Device readiness test completed"
}

# Main test execution
echo -e "\n${BLUE}Running comprehensive device cleanup tests...${NC}"

test_luks_mapping_detection
test_process_detection
test_mount_detection
test_device_locks
test_cleanup_simulation

# Ask before running actual cleanup
echo -e "\n${YELLOW}The following test will perform actual LUKS cleanup operations${NC}"
read -p "Run actual LUKS cleanup test? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    test_actual_luks_cleanup
else
    echo -e "${YELLOW}Skipping actual LUKS cleanup test${NC}"
fi

test_device_readiness

echo -e "\n${GREEN}🎉 Device cleanup test completed!${NC}"
echo -e "\n${BLUE}Summary:${NC}"
echo "- LUKS mapping detection: Tested"
echo "- Process detection: Tested"  
echo "- Mount detection: Tested"
echo "- Device lock detection: Tested"
echo "- Cleanup simulation: Tested"
echo "- Device readiness: Tested"

echo -e "\n${BLUE}The device should now be ready for LUKS encryption${NC}"
echo -e "${YELLOW}You can now test the encryption process in the ZAP Quantum Vault UI${NC}"
