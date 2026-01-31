#!/bin/bash
# Setup SSH tunnel to expose VM socket to host

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

TUNNEL_PID_FILE="${VM_IMAGES_DIR}/tunnel.pid"

# Check if tunnel is already running
check_running() {
    if [ -f "$TUNNEL_PID_FILE" ]; then
        local pid=$(cat "$TUNNEL_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            log_error "Tunnel is already running (PID: $pid)"
            log_info "Use stop-tunnel.sh to stop it first"
            exit 1
        else
            log_warn "Stale tunnel PID file found, removing..."
            rm -f "$TUNNEL_PID_FILE"
        fi
    fi
}

# Check if VM is accessible
check_vm() {
    log_info "Checking VM accessibility..."

    if ! timeout 5 ssh -p "$VM_SSH_PORT" -o StrictHostKeyChecking=no -o ConnectTimeout=5 alpine@localhost "echo 'SSH OK'" > /dev/null 2>&1; then
        log_error "Cannot connect to VM via SSH"
        log_info "Make sure the VM is running: ./start-vm.sh"
        exit 1
    fi

    log_success "VM is accessible"
}

# Create SSH tunnel using socat
setup_tunnel() {
    log_info "Setting up SSH tunnel for Unix socket..."

    # Remove old socket if it exists
    if [ -S "$HOSTAGENT_SOCKET_PATH" ]; then
        log_warn "Removing old socket at $HOSTAGENT_SOCKET_PATH"
        rm -f "$HOSTAGENT_SOCKET_PATH"
    fi

    # Create tunnel using SSH and socat
    # This creates a Unix socket on the host that forwards to the VM's Unix socket
    log_info "Creating tunnel: $HOSTAGENT_SOCKET_PATH -> VM:/var/run/hostagent.sock"

    ssh -p "$VM_SSH_PORT" \
        -o StrictHostKeyChecking=no \
        -o ServerAliveInterval=60 \
        -o ServerAliveCountMax=3 \
        -N \
        -L "$HOSTAGENT_SOCKET_PATH:/var/run/hostagent.sock" \
        alpine@localhost &

    local ssh_pid=$!
    echo "$ssh_pid" > "$TUNNEL_PID_FILE"

    # Wait a moment for tunnel to establish
    sleep 2

    # Verify tunnel is running
    if ! ps -p "$ssh_pid" > /dev/null 2>&1; then
        log_error "Tunnel failed to start"
        rm -f "$TUNNEL_PID_FILE"
        exit 1
    fi

    log_success "Tunnel started (PID: $ssh_pid)"
}

# Alternative: Use socat for socket forwarding
setup_socat_tunnel() {
    log_info "Setting up socat tunnel for Unix socket..."

    # Remove old socket if it exists
    if [ -S "$HOSTAGENT_SOCKET_PATH" ]; then
        log_warn "Removing old socket at $HOSTAGENT_SOCKET_PATH"
        rm -f "$HOSTAGENT_SOCKET_PATH"
    fi

    # Create socat relay: Unix socket on host -> SSH -> Unix socket on VM
    socat \
        "UNIX-LISTEN:$HOSTAGENT_SOCKET_PATH,fork,mode=0666" \
        "EXEC:'ssh -p $VM_SSH_PORT -o StrictHostKeyChecking=no alpine@localhost socat STDIO UNIX-CONNECT:/var/run/hostagent.sock'" &

    local socat_pid=$!
    echo "$socat_pid" > "$TUNNEL_PID_FILE"

    # Wait a moment for tunnel to establish
    sleep 2

    # Verify tunnel is running
    if ! ps -p "$socat_pid" > /dev/null 2>&1; then
        log_error "Tunnel failed to start"
        rm -f "$TUNNEL_PID_FILE"
        exit 1
    fi

    log_success "Socat tunnel started (PID: $socat_pid)"
}

# Verify tunnel
verify_tunnel() {
    log_info "Verifying tunnel..."

    # Check if socket exists
    if [ ! -S "$HOSTAGENT_SOCKET_PATH" ]; then
        log_error "Socket not found at $HOSTAGENT_SOCKET_PATH"
        return 1
    fi

    log_success "Socket exists at $HOSTAGENT_SOCKET_PATH"

    # Test communication
    log_info "Testing socket communication..."
    if echo '{"cmd":"lsblk","args":["-J"]}' | nc -U "$HOSTAGENT_SOCKET_PATH" -w 5 | grep -q "ok"; then
        log_success "Socket communication successful!"
        return 0
    else
        log_warn "Socket communication test inconclusive"
        return 1
    fi
}

# Show usage info
show_info() {
    cat << EOF

${GREEN}===================================================================
TUNNEL SETUP SUCCESSFUL
===================================================================${NC}

The host-agent socket is now accessible on the host machine.

Socket Path: $HOSTAGENT_SOCKET_PATH

Test the connection:
  echo '{"cmd":"lsblk","args":["-J"]}' | nc -U $HOSTAGENT_SOCKET_PATH

Docker Compose Configuration:
  Add this to docker-compose.override.yml:

  services:
    app:
      volumes:
        - $HOSTAGENT_SOCKET_PATH:/var/run/hostagent.sock

Stop the tunnel:
  ./stop-tunnel.sh

${GREEN}===================================================================${NC}

EOF
}

# Parse arguments
USE_SOCAT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --socat)
            USE_SOCAT=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Usage: $0 [--socat]"
            exit 1
            ;;
    esac
done

# Check dependencies
if [ "$USE_SOCAT" = "true" ]; then
    if ! command -v socat &> /dev/null; then
        log_error "socat is not installed"
        log_info "Install with: sudo pacman -S socat"
        exit 1
    fi
fi

# Main execution
log_info "Setting up SSH tunnel to VM socket..."
echo ""

check_running
check_vm

if [ "$USE_SOCAT" = "true" ]; then
    setup_socat_tunnel
else
    log_error "SSH Unix socket forwarding (-L with Unix sockets) requires OpenSSH 6.7+"
    log_info "Using socat method instead..."
    USE_SOCAT=true
    setup_socat_tunnel
fi

echo ""
if verify_tunnel; then
    show_info
else
    log_warn "Tunnel created but verification failed"
    log_info "The tunnel may still work. Try testing manually."
    show_info
fi
