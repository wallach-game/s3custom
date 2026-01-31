#!/bin/bash
# Create virtual disk images for RAID testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

check_linux
check_dependencies
ensure_directories

create_disk() {
    local disk_num=$1
    local disk_size=$2
    local disk_path="${VM_IMAGES_DIR}/disk${disk_num}.${DISK_FORMAT}"

    if [ -f "$disk_path" ]; then
        log_warn "Disk ${disk_num} already exists at $disk_path"
        read -p "Overwrite? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Skipping disk ${disk_num}"
            return
        fi
        rm -f "$disk_path"
    fi

    log_info "Creating disk ${disk_num} with size ${disk_size}..."

    if [ "$DISK_FORMAT" = "qcow2" ]; then
        qemu-img create -f qcow2 "$disk_path" "$disk_size"
    else
        qemu-img create -f raw "$disk_path" "$disk_size"
    fi

    log_success "Created $disk_path"
}

# Main execution
log_info "Creating ${DISK_COUNT} virtual disks for RAID testing..."
echo "Format: ${DISK_FORMAT}"
echo "Location: ${VM_IMAGES_DIR}"
echo ""

for i in $(seq 0 $((DISK_COUNT - 1))); do
    size="${DISK_SIZES[$i]}"
    create_disk "$i" "$size"
done

log_success "All disks created successfully!"
echo ""
log_info "Disk inventory:"
ls -lh "${VM_IMAGES_DIR}/"*.${DISK_FORMAT} 2>/dev/null || log_warn "No disks found"
