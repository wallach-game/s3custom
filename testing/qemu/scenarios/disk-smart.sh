#!/bin/bash
# Description: Test SMART disk monitoring

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../scripts/config.sh"

log_info "Test Scenario: SMART Disk Monitoring"
echo ""

# Test SMART commands
ssh -p "$VM_SSH_PORT" -o StrictHostKeyChecking=no alpine@localhost << 'EOSSH'
set -e

echo "Testing smartctl commands..."

echo ""
echo "SMART capability check for vdb:"
sudo smartctl -i /dev/vdb || echo "Note: Virtual disks may not support SMART"

echo ""
echo "Health status:"
sudo smartctl -H /dev/vdb || echo "Note: Virtual disks may not support SMART"

echo ""
echo "All SMART attributes:"
sudo smartctl -A /dev/vdb || echo "Note: Virtual disks may not support SMART"

echo ""
echo "Full SMART info:"
sudo smartctl -a /dev/vdb || echo "Note: Virtual disks may not support SMART"

echo ""
echo "Testing with all available disks..."
for disk in /dev/vd[b-g]; do
    if [ -b "$disk" ]; then
        echo ""
        echo "=== $disk ==="
        sudo smartctl -i "$disk" 2>&1 | head -5 || echo "SMART not supported"
    fi
done

EOSSH

log_success "SMART test complete!"
echo ""
log_warn "Note: Virtual disks typically don't support SMART attributes"
log_info "The web UI should handle this gracefully and show appropriate messages"
echo ""
log_info "Verify in the web UI:"
log_info "  1. Navigate to Disks section"
log_info "  2. Check if SMART status is displayed"
log_info "  3. Verify error handling for unsupported disks"
