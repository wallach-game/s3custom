#!/bin/bash
# Start the QEMU VM with virtual disks attached

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

check_linux
ensure_directories

SYSTEM_DISK="${VM_IMAGES_DIR}/system.qcow2"
PID_FILE="${VM_IMAGES_DIR}/${VM_NAME}.pid"
MONITOR_SOCKET="${VM_IMAGES_DIR}/${VM_NAME}.monitor"

# Check if VM is already running
check_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            log_error "VM is already running (PID: $pid)"
            log_info "Use stop-vm.sh to stop it first"
            exit 1
        else
            log_warn "Stale PID file found, removing..."
            rm -f "$PID_FILE"
        fi
    fi
}

# Check if system disk exists
check_system_disk() {
    if [ ! -f "$SYSTEM_DISK" ]; then
        log_error "System disk not found at $SYSTEM_DISK"
        log_info "Run setup-vm.sh first to create the VM"
        exit 1
    fi
}

# Build QEMU command with all disks
build_qemu_command() {
    local cmd="qemu-system-x86_64"
    local args=(
        "-name" "$VM_NAME"
        "-machine" "q35,accel=kvm"
        "-cpu" "host"
        "-smp" "$VM_CPUS"
        "-m" "$VM_MEMORY"
        "-drive" "file=$SYSTEM_DISK,format=qcow2,if=virtio,index=0"
    )

    # Add test disks
    local disk_index=1
    for i in $(seq 0 $((DISK_COUNT - 1))); do
        local disk_path="${VM_IMAGES_DIR}/disk${i}.${DISK_FORMAT}"
        if [ -f "$disk_path" ]; then
            args+=(
                "-drive" "file=${disk_path},format=${DISK_FORMAT},if=virtio,index=${disk_index}"
            )
            ((disk_index++))
        else
            log_warn "Disk $i not found at $disk_path, skipping"
        fi
    done

    # Network with SSH port forwarding
    args+=(
        "-netdev" "user,id=net0,hostfwd=tcp::${VM_SSH_PORT}-:22,hostfwd=tcp::${VM_HOSTAGENT_PORT}-:9999"
        "-device" "virtio-net-pci,netdev=net0"
    )

    # Monitor socket for control
    args+=(
        "-qmp" "unix:${MONITOR_SOCKET},server,nowait"
        "-pidfile" "$PID_FILE"
    )

    # Display options
    if [ "${HEADLESS:-false}" = "true" ]; then
        args+=("-nographic")
    else
        args+=(
            "-vga" "virtio"
            "-display" "gtk,gl=on"
        )
    fi

    # Boot from disk
    args+=("-boot" "order=c")

    echo "$cmd ${args[@]}"
}

# Start the VM
start_vm() {
    local cmd=$(build_qemu_command)

    log_info "Starting VM with configuration:"
    log_info "  Name: $VM_NAME"
    log_info "  Memory: ${VM_MEMORY}M"
    log_info "  CPUs: $VM_CPUS"
    log_info "  SSH Port: $VM_SSH_PORT"
    log_info "  Test Disks: $DISK_COUNT"
    echo ""

    if [ "${FOREGROUND:-false}" = "true" ]; then
        log_info "Starting in foreground mode..."
        eval "$cmd"
    else
        log_info "Starting in background mode..."
        eval "$cmd" &
        local vm_pid=$!
        echo "$vm_pid" > "$PID_FILE"

        sleep 2
        if ps -p "$vm_pid" > /dev/null 2>&1; then
            log_success "VM started successfully (PID: $vm_pid)"
        else
            log_error "VM failed to start"
            rm -f "$PID_FILE"
            exit 1
        fi
    fi

    echo ""
    log_info "VM Access Information:"
    log_info "  SSH: ssh -p $VM_SSH_PORT alpine@localhost"
    log_info "  Host Agent Port: $VM_HOSTAGENT_PORT (forwarded to VM port 9999)"
    log_info "  Monitor Socket: $MONITOR_SOCKET"
    echo ""
    log_info "Waiting for VM to boot (this may take 30-60 seconds)..."
    log_info "Test SSH connection with: ssh -p $VM_SSH_PORT alpine@localhost"
}

# Wait for SSH to be available
wait_for_ssh() {
    log_info "Waiting for SSH to become available..."
    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if timeout 1 bash -c "echo > /dev/tcp/localhost/$VM_SSH_PORT" 2>/dev/null; then
            log_success "SSH is available!"
            return 0
        fi
        ((attempt++))
        echo -n "."
        sleep 2
    done

    echo ""
    log_warn "SSH connection timeout. VM may still be booting."
    log_info "Try connecting manually: ssh -p $VM_SSH_PORT alpine@localhost"
    return 1
}

# Parse command line arguments
FOREGROUND=false
HEADLESS=false
WAIT_SSH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--foreground)
            FOREGROUND=true
            shift
            ;;
        -h|--headless)
            HEADLESS=true
            shift
            ;;
        -w|--wait)
            WAIT_SSH=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Usage: $0 [-f|--foreground] [-h|--headless] [-w|--wait]"
            exit 1
            ;;
    esac
done

# Main execution
check_running
check_system_disk
start_vm

if [ "$WAIT_SSH" = "true" ] && [ "$FOREGROUND" = "false" ]; then
    wait_for_ssh
fi

log_success "VM startup complete!"
