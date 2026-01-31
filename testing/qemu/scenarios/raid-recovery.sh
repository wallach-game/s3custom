#!/bin/bash
# Description: Test RAID recovery by failing a disk

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../scripts/config.sh"

log_info "Test Scenario: RAID Recovery"
echo ""

# Test RAID recovery
ssh -p "$VM_SSH_PORT" -o StrictHostKeyChecking=no alpine@localhost << 'EOSSH'
set -e

echo "Current RAID status:"
cat /proc/mdstat

echo ""
echo "Failing disk vdc in RAID array md0..."
sudo mdadm --manage /dev/md0 --fail /dev/vdc

echo ""
echo "RAID status after failure:"
cat /proc/mdstat
sudo mdadm --detail /dev/md0

echo ""
echo "Removing failed disk..."
sudo mdadm --manage /dev/md0 --remove /dev/vdc

echo ""
echo "Simulating disk replacement - adding vdg (spare disk)..."
# First, zero out the spare disk
sudo dd if=/dev/zero of=/dev/vdg bs=1M count=10 2>/dev/null || true

sudo mdadm --manage /dev/md0 --add /dev/vdg

echo ""
echo "RAID should now be rebuilding..."
sleep 3

echo ""
echo "Rebuild status:"
cat /proc/mdstat
sudo mdadm --detail /dev/md0

echo ""
echo "Monitor rebuild progress with: watch cat /proc/mdstat"

EOSSH

log_success "RAID recovery test complete!"
echo ""
log_info "Verify in the web UI:"
log_info "  1. Check RAID status - should show rebuilding"
log_info "  2. One disk should be marked as failed"
log_info "  3. New disk should be added and syncing"
