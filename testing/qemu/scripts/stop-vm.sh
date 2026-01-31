#!/bin/bash
# Stop the running QEMU VM

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

PID_FILE="${VM_IMAGES_DIR}/${VM_NAME}.pid"
MONITOR_SOCKET="${VM_IMAGES_DIR}/${VM_NAME}.monitor"

# Check if VM is running
check_running() {
    if [ ! -f "$PID_FILE" ]; then
        log_error "VM is not running (no PID file found)"
        exit 1
    fi

    local pid=$(cat "$PID_FILE")
    if ! ps -p "$pid" > /dev/null 2>&1; then
        log_warn "VM is not running (PID $pid not found)"
        rm -f "$PID_FILE"
        exit 1
    fi

    echo "$pid"
}

# Graceful shutdown via ACPI
graceful_shutdown() {
    local pid=$1

    log_info "Sending ACPI shutdown signal to VM..."

    if [ -S "$MONITOR_SOCKET" ]; then
        echo '{"execute":"qmp_capabilities"}{"execute":"system_powerdown"}' | \
            socat - "UNIX-CONNECT:$MONITOR_SOCKET" > /dev/null 2>&1 || true
    else
        log_warn "Monitor socket not found, using SIGTERM"
        kill -TERM "$pid"
    fi

    # Wait for graceful shutdown (max 30 seconds)
    local timeout=30
    local elapsed=0

    while [ $elapsed -lt $timeout ]; do
        if ! ps -p "$pid" > /dev/null 2>&1; then
            log_success "VM shut down gracefully"
            rm -f "$PID_FILE" "$MONITOR_SOCKET"
            return 0
        fi
        sleep 1
        ((elapsed++))
        echo -n "."
    done

    echo ""
    log_warn "Graceful shutdown timeout"
    return 1
}

# Force shutdown
force_shutdown() {
    local pid=$1

    log_warn "Forcing VM shutdown..."
    kill -KILL "$pid" 2>/dev/null || true

    sleep 1

    if ! ps -p "$pid" > /dev/null 2>&1; then
        log_success "VM terminated"
        rm -f "$PID_FILE" "$MONITOR_SOCKET"
        return 0
    else
        log_error "Failed to terminate VM"
        return 1
    fi
}

# Parse arguments
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Usage: $0 [-f|--force]"
            exit 1
            ;;
    esac
done

# Main execution
pid=$(check_running)

log_info "Stopping VM (PID: $pid)..."

if [ "$FORCE" = "true" ]; then
    force_shutdown "$pid"
else
    if ! graceful_shutdown "$pid"; then
        read -p "Graceful shutdown failed. Force kill? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            force_shutdown "$pid"
        else
            log_info "VM still running. Use --force to kill."
            exit 1
        fi
    fi
fi

log_success "VM stopped successfully"
