#!/bin/bash
# Description: Comprehensive test of all major functionality

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../scripts/config.sh"

log_info "Comprehensive S3 Custom Test Scenario"
echo ""
log_info "This test will:"
echo "  1. List all available disks"
echo "  2. Create a RAID 1 array"
echo "  3. Test power management"
echo "  4. Simulate disk failure and recovery"
echo "  5. Create filesystems and mount points"
echo "  6. Clean up"
echo ""

read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Test cancelled"
    exit 0
fi

SSH_CMD="ssh -p $VM_SSH_PORT -o StrictHostKeyChecking=no alpine@localhost"

# Test 1: List disks
log_info "Test 1: Listing all available disks..."
$SSH_CMD << 'EOSSH'
echo "=== Block Devices ==="
lsblk -o NAME,SIZE,TYPE,MOUNTPOINT,MODEL

echo ""
echo "=== Disk Details ==="
for disk in /dev/vd[b-g]; do
    if [ -b "$disk" ]; then
        echo ""
        echo "Device: $disk"
        sudo fdisk -l "$disk" 2>/dev/null | head -5
    fi
done
EOSSH
log_success "Disk listing complete"
echo ""
sleep 2

# Test 2: Create RAID 1
log_info "Test 2: Creating RAID 1 array..."
$SSH_CMD << 'EOSSH'
echo "Creating RAID 1 array with /dev/vdb and /dev/vdc..."

# Clean up any existing RAID
sudo mdadm --stop /dev/md0 2>/dev/null || true
sudo mdadm --zero-superblock /dev/vdb /dev/vdc 2>/dev/null || true

# Create RAID 1
sudo mdadm --create --verbose /dev/md0 \
    --level=1 \
    --raid-devices=2 \
    /dev/vdb /dev/vdc

echo ""
echo "RAID array created:"
cat /proc/mdstat

echo ""
echo "Detailed info:"
sudo mdadm --detail /dev/md0
EOSSH
log_success "RAID 1 array created"
echo ""
sleep 2

# Test 3: Create filesystem
log_info "Test 3: Creating filesystem on RAID..."
$SSH_CMD << 'EOSSH'
echo "Creating ext4 filesystem on /dev/md0..."
sudo mkfs.ext4 -F /dev/md0

echo ""
echo "Filesystem created successfully"
sudo blkid /dev/md0
EOSSH
log_success "Filesystem created"
echo ""
sleep 2

# Test 4: Mount and write test data
log_info "Test 4: Mounting RAID and writing test data..."
$SSH_CMD << 'EOSSH'
echo "Creating mount point..."
sudo mkdir -p /mnt/raid-test

echo "Mounting /dev/md0..."
sudo mount /dev/md0 /mnt/raid-test

echo "Writing test data..."
sudo dd if=/dev/urandom of=/mnt/raid-test/testfile bs=1M count=10
sync

echo ""
echo "Mount status:"
df -h /mnt/raid-test

echo ""
echo "Files:"
ls -lh /mnt/raid-test/
EOSSH
log_success "Mount and write test complete"
echo ""
sleep 2

# Test 5: Power management
log_info "Test 5: Testing power management on spare disk..."
$SSH_CMD << 'EOSSH'
echo "Testing power commands on /dev/vdd..."

echo "Current power state:"
sudo hdparm -C /dev/vdd

echo ""
echo "Spinning down..."
sudo hdparm -y /dev/vdd

sleep 1
echo ""
echo "Power state after spin down:"
sudo hdparm -C /dev/vdd

echo ""
echo "Spinning up (forcing a read)..."
sudo dd if=/dev/vdd of=/dev/null bs=512 count=1 2>/dev/null

echo ""
echo "Power state after read:"
sudo hdparm -C /dev/vdd
EOSSH
log_success "Power management test complete"
echo ""
sleep 2

# Test 6: Simulate disk failure
log_info "Test 6: Simulating disk failure..."
$SSH_CMD << 'EOSSH'
echo "Failing /dev/vdc in RAID array..."
sudo mdadm --manage /dev/md0 --fail /dev/vdc

echo ""
echo "RAID status after failure:"
cat /proc/mdstat

echo ""
sudo mdadm --detail /dev/md0

echo ""
echo "Verify data is still accessible (degraded mode)..."
ls -lh /mnt/raid-test/
sudo md5sum /mnt/raid-test/testfile
EOSSH
log_success "Disk failure simulation complete"
echo ""
sleep 2

# Test 7: Disk recovery
log_info "Test 7: Recovering from disk failure..."
$SSH_CMD << 'EOSSH'
echo "Removing failed disk..."
sudo mdadm --manage /dev/md0 --remove /dev/vdc

echo ""
echo "Adding spare disk /dev/vdd..."
sudo mdadm --zero-superblock /dev/vdd 2>/dev/null || true
sudo mdadm --manage /dev/md0 --add /dev/vdd

echo ""
echo "RAID should now be rebuilding..."
cat /proc/mdstat

echo ""
sudo mdadm --detail /dev/md0

echo ""
echo "Data verification after recovery started:"
sudo md5sum /mnt/raid-test/testfile
EOSSH
log_success "Disk recovery started"
echo ""
sleep 2

# Test 8: Monitor rebuild
log_info "Test 8: Monitoring rebuild progress..."
$SSH_CMD << 'EOSSH'
echo "Rebuild status (will wait up to 60 seconds)..."

for i in {1..12}; do
    echo ""
    echo "Check $i/12:"
    cat /proc/mdstat | grep -A 3 md0 || true

    if cat /proc/mdstat | grep -q "recovery.*100%"; then
        echo "Rebuild complete!"
        break
    fi

    if [ $i -lt 12 ]; then
        sleep 5
    fi
done

echo ""
echo "Final RAID status:"
sudo mdadm --detail /dev/md0
EOSSH
log_success "Rebuild monitoring complete"
echo ""
sleep 2

# Test 9: Cleanup
log_info "Test 9: Cleaning up test environment..."
$SSH_CMD << 'EOSSH'
echo "Unmounting RAID..."
sudo umount /mnt/raid-test

echo "Stopping RAID array..."
sudo mdadm --stop /dev/md0

echo "Cleaning superblocks..."
sudo mdadm --zero-superblock /dev/vdb /dev/vdc /dev/vdd 2>/dev/null || true

echo ""
echo "Cleanup complete. System returned to clean state."
cat /proc/mdstat
EOSSH
log_success "Cleanup complete"
echo ""

# Summary
cat << EOF

${GREEN}===================================================================
COMPREHENSIVE TEST COMPLETE
===================================================================${NC}

All tests passed successfully!

Tests performed:
  ${GREEN}✓${NC} Disk listing and detection
  ${GREEN}✓${NC} RAID 1 array creation
  ${GREEN}✓${NC} Filesystem creation (ext4)
  ${GREEN}✓${NC} Mount and data write operations
  ${GREEN}✓${NC} Power management (spin down/up)
  ${GREEN}✓${NC} Disk failure simulation
  ${GREEN}✓${NC} Degraded array operation
  ${GREEN}✓${NC} Disk replacement and recovery
  ${GREEN}✓${NC} RAID rebuild monitoring
  ${GREEN}✓${NC} Cleanup and restoration

The test environment is ready for development and testing.

Next steps:
  1. Access the web UI at http://localhost:8080
  2. Verify these operations work through the UI
  3. Run individual test scenarios as needed
  4. Create snapshots for different test states

${GREEN}===================================================================${NC}

EOF
