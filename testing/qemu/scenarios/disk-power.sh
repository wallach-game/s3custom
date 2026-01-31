#!/bin/bash
# Description: Test disk power management (spin down/up)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../scripts/config.sh"

log_info "Test Scenario: Disk Power Management"
echo ""

# Test power management
ssh -p "$VM_SSH_PORT" -o StrictHostKeyChecking=no alpine@localhost << 'EOSSH'
set -e

echo "Testing hdparm commands..."

echo ""
echo "Current power state of vdb:"
sudo hdparm -C /dev/vdb

echo ""
echo "Spinning down vdb..."
sudo hdparm -y /dev/vdb

echo ""
echo "Power state after spin down:"
sudo hdparm -C /dev/vdb

echo ""
echo "Spinning up vdb..."
sudo hdparm -S 0 /dev/vdb
# Trigger a read to spin up
sudo dd if=/dev/vdb of=/dev/null bs=512 count=1 2>/dev/null || true

echo ""
echo "Power state after spin up:"
sudo hdparm -C /dev/vdb

echo ""
echo "Setting idle timeout to 60 seconds..."
sudo hdparm -S 12 /dev/vdb  # 12 * 5 seconds = 60 seconds

echo ""
echo "Current settings:"
sudo hdparm -I /dev/vdb | grep -i "power\|idle" || true

EOSSH

log_success "Power management test complete!"
echo ""
log_info "Verify in the web UI:"
log_info "  1. Navigate to Power section"
log_info "  2. Check power states of disks"
log_info "  3. Try spin down/up controls"
log_info "  4. Set idle timeout"
