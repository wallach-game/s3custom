#!/bin/bash
# Snapshot management for test VM

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

SYSTEM_DISK="${VM_IMAGES_DIR}/system.qcow2"

# List snapshots
list_snapshots() {
    log_info "Snapshots for $SYSTEM_DISK:"
    qemu-img snapshot -l "$SYSTEM_DISK"

    echo ""
    log_info "Snapshots for test disks:"
    for i in $(seq 0 $((DISK_COUNT - 1))); do
        local disk_path="${VM_IMAGES_DIR}/disk${i}.${DISK_FORMAT}"
        if [ -f "$disk_path" ] && [ "$DISK_FORMAT" = "qcow2" ]; then
            echo ""
            echo "Disk $i:"
            qemu-img snapshot -l "$disk_path" || echo "  No snapshots"
        fi
    done
}

# Create snapshot
create_snapshot() {
    local snapshot_name=$1

    if [ -z "$snapshot_name" ]; then
        log_error "Snapshot name required"
        echo "Usage: $0 create <snapshot-name>"
        exit 1
    fi

    # Check if VM is running
    local pid_file="${VM_IMAGES_DIR}/${VM_NAME}.pid"
    if [ -f "$pid_file" ] && ps -p "$(cat "$pid_file")" > /dev/null 2>&1; then
        log_error "Cannot create snapshot while VM is running"
        log_info "Stop the VM first: ./stop-vm.sh"
        exit 1
    fi

    log_info "Creating snapshot '$snapshot_name'..."

    # Snapshot system disk
    log_info "  Snapshotting system disk..."
    qemu-img snapshot -c "$snapshot_name" "$SYSTEM_DISK"

    # Snapshot test disks
    for i in $(seq 0 $((DISK_COUNT - 1))); do
        local disk_path="${VM_IMAGES_DIR}/disk${i}.${DISK_FORMAT}"
        if [ -f "$disk_path" ] && [ "$DISK_FORMAT" = "qcow2" ]; then
            log_info "  Snapshotting disk $i..."
            qemu-img snapshot -c "$snapshot_name" "$disk_path"
        fi
    done

    log_success "Snapshot '$snapshot_name' created successfully"
}

# Restore snapshot
restore_snapshot() {
    local snapshot_name=$1

    if [ -z "$snapshot_name" ]; then
        log_error "Snapshot name required"
        echo "Usage: $0 restore <snapshot-name>"
        exit 1
    fi

    # Check if VM is running
    local pid_file="${VM_IMAGES_DIR}/${VM_NAME}.pid"
    if [ -f "$pid_file" ] && ps -p "$(cat "$pid_file")" > /dev/null 2>&1; then
        log_error "Cannot restore snapshot while VM is running"
        log_info "Stop the VM first: ./stop-vm.sh"
        exit 1
    fi

    log_warn "Restoring snapshot '$snapshot_name'..."
    log_warn "This will discard all changes since the snapshot was created!"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi

    # Restore system disk
    log_info "  Restoring system disk..."
    qemu-img snapshot -a "$snapshot_name" "$SYSTEM_DISK"

    # Restore test disks
    for i in $(seq 0 $((DISK_COUNT - 1))); do
        local disk_path="${VM_IMAGES_DIR}/disk${i}.${DISK_FORMAT}"
        if [ -f "$disk_path" ] && [ "$DISK_FORMAT" = "qcow2" ]; then
            log_info "  Restoring disk $i..."
            qemu-img snapshot -a "$snapshot_name" "$disk_path"
        fi
    done

    log_success "Snapshot '$snapshot_name' restored successfully"
}

# Delete snapshot
delete_snapshot() {
    local snapshot_name=$1

    if [ -z "$snapshot_name" ]; then
        log_error "Snapshot name required"
        echo "Usage: $0 delete <snapshot-name>"
        exit 1
    fi

    log_warn "Deleting snapshot '$snapshot_name'..."
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Delete cancelled"
        exit 0
    fi

    # Delete from system disk
    log_info "  Deleting from system disk..."
    qemu-img snapshot -d "$snapshot_name" "$SYSTEM_DISK"

    # Delete from test disks
    for i in $(seq 0 $((DISK_COUNT - 1))); do
        local disk_path="${VM_IMAGES_DIR}/disk${i}.${DISK_FORMAT}"
        if [ -f "$disk_path" ] && [ "$DISK_FORMAT" = "qcow2" ]; then
            log_info "  Deleting from disk $i..."
            qemu-img snapshot -d "$snapshot_name" "$disk_path" 2>/dev/null || true
        fi
    done

    log_success "Snapshot '$snapshot_name' deleted successfully"
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 <command> [arguments]

Commands:
  list                    List all snapshots
  create <name>           Create a new snapshot
  restore <name>          Restore to a snapshot
  delete <name>           Delete a snapshot

Examples:
  $0 list
  $0 create clean-install
  $0 restore clean-install
  $0 delete old-snapshot

Note: VM must be stopped to create, restore, or delete snapshots.
      Only qcow2 format disks support snapshots.
EOF
}

# Main execution
if [ $# -eq 0 ]; then
    show_usage
    exit 1
fi

command=$1
shift

case $command in
    list)
        list_snapshots
        ;;
    create)
        create_snapshot "$@"
        ;;
    restore)
        restore_snapshot "$@"
        ;;
    delete)
        delete_snapshot "$@"
        ;;
    *)
        log_error "Unknown command: $command"
        show_usage
        exit 1
        ;;
esac
