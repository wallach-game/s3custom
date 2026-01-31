#!/bin/bash
# Stop the SSH tunnel

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

TUNNEL_PID_FILE="${VM_IMAGES_DIR}/tunnel.pid"

# Check if tunnel is running
check_running() {
    if [ ! -f "$TUNNEL_PID_FILE" ]; then
        log_error "Tunnel is not running (no PID file found)"
        exit 1
    fi

    local pid=$(cat "$TUNNEL_PID_FILE")
    if ! ps -p "$pid" > /dev/null 2>&1; then
        log_warn "Tunnel is not running (PID $pid not found)"
        rm -f "$TUNNEL_PID_FILE"
        exit 1
    fi

    echo "$pid"
}

# Stop tunnel
stop_tunnel() {
    local pid=$1

    log_info "Stopping tunnel (PID: $pid)..."

    kill "$pid" 2>/dev/null || true

    # Wait for process to die
    local timeout=5
    local elapsed=0

    while [ $elapsed -lt $timeout ]; do
        if ! ps -p "$pid" > /dev/null 2>&1; then
            log_success "Tunnel stopped"
            rm -f "$TUNNEL_PID_FILE"

            # Clean up socket
            if [ -S "$HOSTAGENT_SOCKET_PATH" ]; then
                rm -f "$HOSTAGENT_SOCKET_PATH"
                log_info "Removed socket at $HOSTAGENT_SOCKET_PATH"
            fi

            return 0
        fi
        sleep 1
        ((elapsed++))
    done

    log_warn "Tunnel did not stop gracefully, forcing..."
    kill -9 "$pid" 2>/dev/null || true
    rm -f "$TUNNEL_PID_FILE" "$HOSTAGENT_SOCKET_PATH"
    log_success "Tunnel terminated"
}

# Main execution
pid=$(check_running)
stop_tunnel "$pid"
