#!/bin/bash

# ZAP Quantum Vault - Encryption Dependencies Test Script
# This script checks and installs required dependencies for LUKS encryption

set -e

echo "🔐 ZAP Quantum Vault - Encryption Dependencies Test"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if command exists
check_command() {
    local cmd=$1
    local description=$2
    
    if command -v "$cmd" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $description ($cmd) - Available"
        return 0
    else
        echo -e "${RED}✗${NC} $description ($cmd) - Missing"
        return 1
    fi
}

# Function to install missing packages
install_packages() {
    echo -e "\n${YELLOW}Installing missing packages...${NC}"
    
    # Detect package manager
    if command -v apt-get &> /dev/null; then
        echo "Using apt-get (Debian/Ubuntu)..."
        sudo apt-get update
        sudo apt-get install -y cryptsetup cryptsetup-bin lvm2 parted util-linux
    elif command -v yum &> /dev/null; then
        echo "Using yum (RHEL/CentOS)..."
        sudo yum install -y cryptsetup parted util-linux-ng
    elif command -v dnf &> /dev/null; then
        echo "Using dnf (Fedora)..."
        sudo dnf install -y cryptsetup parted util-linux
    elif command -v pacman &> /dev/null; then
        echo "Using pacman (Arch Linux)..."
        sudo pacman -S --noconfirm cryptsetup parted util-linux
    else
        echo -e "${RED}Error: No supported package manager found${NC}"
        echo "Please install cryptsetup manually for your distribution"
        exit 1
    fi
}

# Function to test LUKS operations on a loop device
test_luks_operations() {
    echo -e "\n${BLUE}Testing LUKS operations...${NC}"
    
    # Create a test file (10MB)
    local test_file="/tmp/luks_test.img"
    local loop_device=""
    local test_password="test123456"
    
    echo "Creating test image file..."
    dd if=/dev/zero of="$test_file" bs=1M count=10 2>/dev/null
    
    # Setup loop device
    echo "Setting up loop device..."
    loop_device=$(sudo losetup --find --show "$test_file")
    echo "Using loop device: $loop_device"
    
    # Cleanup function
    cleanup_test() {
        echo "Cleaning up test environment..."
        if [ -n "$loop_device" ]; then
            sudo cryptsetup luksClose luks_test 2>/dev/null || true
            sudo losetup -d "$loop_device" 2>/dev/null || true
        fi
        rm -f "$test_file"
    }
    
    # Set trap for cleanup
    trap cleanup_test EXIT
    
    try_luks_format() {
        echo "Testing LUKS format..."
        echo -n "$test_password" | sudo cryptsetup luksFormat \
            --type luks2 \
            --cipher aes-xts-plain64 \
            --key-size 512 \
            --hash sha256 \
            --iter-time 2000 \
            --batch-mode \
            "$loop_device"
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓${NC} LUKS format successful"
        else
            echo -e "${RED}✗${NC} LUKS format failed"
            return 1
        fi
    }
    
    try_luks_open() {
        echo "Testing LUKS open..."
        echo -n "$test_password" | sudo cryptsetup luksOpen "$loop_device" luks_test
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓${NC} LUKS open successful"
            echo "Encrypted device available at: /dev/mapper/luks_test"
        else
            echo -e "${RED}✗${NC} LUKS open failed"
            return 1
        fi
    }
    
    try_filesystem_format() {
        echo "Testing filesystem creation on encrypted device..."
        sudo mkfs.ext4 -F /dev/mapper/luks_test
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓${NC} Filesystem creation successful"
        else
            echo -e "${RED}✗${NC} Filesystem creation failed"
            return 1
        fi
    }
    
    try_mount_test() {
        echo "Testing mount/unmount operations..."
        local mount_point="/tmp/luks_test_mount"
        
        sudo mkdir -p "$mount_point"
        sudo mount /dev/mapper/luks_test "$mount_point"
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓${NC} Mount successful"
            
            # Test write operation
            echo "test data" | sudo tee "$mount_point/test.txt" > /dev/null
            if [ -f "$mount_point/test.txt" ]; then
                echo -e "${GREEN}✓${NC} Write test successful"
            else
                echo -e "${RED}✗${NC} Write test failed"
            fi
            
            # Unmount
            sudo umount "$mount_point"
            sudo rmdir "$mount_point"
            echo -e "${GREEN}✓${NC} Unmount successful"
        else
            echo -e "${RED}✗${NC} Mount failed"
            return 1
        fi
    }
    
    try_luks_close() {
        echo "Testing LUKS close..."
        sudo cryptsetup luksClose luks_test
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓${NC} LUKS close successful"
        else
            echo -e "${RED}✗${NC} LUKS close failed"
            return 1
        fi
    }
    
    # Run all tests
    if try_luks_format && try_luks_open && try_filesystem_format && try_mount_test && try_luks_close; then
        echo -e "\n${GREEN}🎉 All LUKS tests passed!${NC}"
        return 0
    else
        echo -e "\n${RED}❌ Some LUKS tests failed${NC}"
        return 1
    fi
}

# Main execution
echo -e "\n${BLUE}Checking system dependencies...${NC}"

missing_deps=0

# Check essential commands
check_command "sudo" "Sudo privileges" || ((missing_deps++))
check_command "cryptsetup" "LUKS encryption" || ((missing_deps++))
check_command "parted" "Disk partitioning" || ((missing_deps++))
check_command "mkfs.ext4" "Ext4 filesystem" || ((missing_deps++))
check_command "mount" "Mount operations" || ((missing_deps++))
check_command "umount" "Unmount operations" || ((missing_deps++))
check_command "findmnt" "Mount detection" || ((missing_deps++))
check_command "lsblk" "Block device listing" || ((missing_deps++))
check_command "wipefs" "Filesystem signature clearing" || ((missing_deps++))
check_command "fuser" "Process detection" || ((missing_deps++))

if [ $missing_deps -gt 0 ]; then
    echo -e "\n${YELLOW}Found $missing_deps missing dependencies${NC}"
    read -p "Install missing packages? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        install_packages
        echo -e "\n${GREEN}Dependencies installed successfully!${NC}"
    else
        echo -e "${YELLOW}Skipping installation. Some features may not work.${NC}"
    fi
else
    echo -e "\n${GREEN}All dependencies are available!${NC}"
fi

# Test LUKS operations
echo -e "\n${BLUE}Would you like to test LUKS encryption operations?${NC}"
read -p "Run LUKS tests? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if test_luks_operations; then
        echo -e "\n${GREEN}✅ System is ready for ZAP Quantum Vault encryption!${NC}"
    else
        echo -e "\n${RED}⚠️  LUKS testing failed. Please check system configuration.${NC}"
        exit 1
    fi
else
    echo -e "\n${YELLOW}Skipping LUKS tests.${NC}"
fi

echo -e "\n${BLUE}Dependency check complete!${NC}"
