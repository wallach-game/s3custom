#!/bin/bash
# Description: Test RAID array creation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../scripts/config.sh"

log_info "Test Scenario: RAID Array Creation"
echo ""

# Connect to VM and create RAID arrays
ssh -p "$VM_SSH_PORT" -o StrictHostKeyChecking=no alpine@localhost << 'EOSSH'
set -e

echo "Available disks:"
lsblk -o NAME,SIZE,TYPE | grep disk

echo ""
echo "Creating RAID 1 array with vdb and vdc..."
sudo mdadm --create --verbose /dev/md0 --level=1 --raid-devices=2 /dev/vdb /dev/vdc

echo ""
echo "Creating RAID 5 array with vdd, vde, vdf..."
sudo mdadm --create --verbose /dev/md1 --level=5 --raid-devices=3 /dev/vdd /dev/vde /dev/vdf

echo ""
echo "Waiting for RAID sync..."
sleep 5

echo ""
echo "RAID status:"
cat /proc/mdstat

echo ""
echo "Detailed RAID info:"
sudo mdadm --detail /dev/md0
sudo mdadm --detail /dev/md1

EOSSH

log_success "RAID arrays created successfully!"
echo ""
log_info "Verify in the web UI:"
log_info "  1. Navigate to RAID section"
log_info "  2. You should see md0 (RAID 1) and md1 (RAID 5)"
log_info "  3. Check sync status"
