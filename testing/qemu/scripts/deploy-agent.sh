#!/bin/bash
# Deploy host-agent to the test VM

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
HOST_AGENT_DIR="$PROJECT_ROOT/host-agent"
TEMP_DIR="/tmp/s3custom-deploy-$$"

cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Check if VM is accessible via SSH
check_ssh() {
    log_info "Testing SSH connection to VM..."

    if ! timeout 5 ssh -p "$VM_SSH_PORT" -o StrictHostKeyChecking=no -o ConnectTimeout=5 alpine@localhost "echo 'SSH OK'" > /dev/null 2>&1; then
        log_error "Cannot connect to VM via SSH"
        log_info "Make sure the VM is running: ./start-vm.sh"
        log_info "Try manual connection: ssh -p $VM_SSH_PORT alpine@localhost"
        exit 1
    fi

    log_success "SSH connection successful"
}

# Build host-agent locally
build_agent() {
    log_info "Building host-agent locally..."

    if [ ! -d "$HOST_AGENT_DIR" ]; then
        log_error "Host agent directory not found: $HOST_AGENT_DIR"
        exit 1
    fi

    cd "$HOST_AGENT_DIR"

    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        npm install
    fi

    log_info "Compiling TypeScript..."
    npm run build

    if [ ! -f "dist/index.js" ]; then
        log_error "Build failed - dist/index.js not found"
        exit 1
    fi

    log_success "Host agent built successfully"
}

# Create deployment package
create_package() {
    log_info "Creating deployment package..."

    mkdir -p "$TEMP_DIR/host-agent"

    # Copy built files
    cp -r "$HOST_AGENT_DIR/dist" "$TEMP_DIR/host-agent/"
    cp "$HOST_AGENT_DIR/package.json" "$TEMP_DIR/host-agent/"
    cp "$HOST_AGENT_DIR/package-lock.json" "$TEMP_DIR/host-agent/"

    # Create systemd service file
    cat > "$TEMP_DIR/host-agent/hostagent.service" << 'EOF'
[Unit]
Description=S3 Custom Host Agent (Test)
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node /opt/s3custom-agent/dist/index.js
WorkingDirectory=/opt/s3custom-agent
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment="HOSTAGENT_SOCKET=/var/run/hostagent.sock"

[Install]
WantedBy=multi-user.target
EOF

    # Create installation script
    cat > "$TEMP_DIR/host-agent/install.sh" << 'EOF'
#!/bin/sh
set -e

echo "Installing host-agent..."

# Create directory
sudo mkdir -p /opt/s3custom-agent

# Copy files
sudo cp -r dist package.json package-lock.json /opt/s3custom-agent/

# Install systemd service
sudo cp hostagent.service /etc/init.d/hostagent-s3custom

# Create OpenRC service (Alpine uses OpenRC, not systemd)
sudo tee /etc/init.d/hostagent-s3custom > /dev/null << 'OPENRC'
#!/sbin/openrc-run

name="S3 Custom Host Agent"
description="Host agent for S3 Custom storage management"

command="/usr/bin/node"
command_args="/opt/s3custom-agent/dist/index.js"
command_background="yes"
pidfile="/run/hostagent.pid"

depend() {
    need net
    after firewall
}

start_pre() {
    export HOSTAGENT_SOCKET=/var/run/hostagent.sock
}
OPENRC

sudo chmod +x /etc/init.d/hostagent-s3custom

# Enable and start service
sudo rc-update add hostagent-s3custom default
sudo rc-service hostagent-s3custom start

echo "Host agent installed and started!"
echo "Socket: /var/run/hostagent.sock"
echo "Check status: sudo rc-service hostagent-s3custom status"
echo "View logs: sudo tail -f /var/log/messages"
EOF

    chmod +x "$TEMP_DIR/host-agent/install.sh"

    # Create tarball
    cd "$TEMP_DIR"
    tar czf "host-agent-deploy.tar.gz" host-agent/

    log_success "Deployment package created"
}

# Deploy to VM
deploy_to_vm() {
    log_info "Deploying to VM..."

    local ssh_opts="-p $VM_SSH_PORT -o StrictHostKeyChecking=no"
    local scp_opts="-P $VM_SSH_PORT -o StrictHostKeyChecking=no"

    # Upload package
    log_info "Uploading package..."
    scp $scp_opts "$TEMP_DIR/host-agent-deploy.tar.gz" alpine@localhost:/tmp/

    # Extract and install
    log_info "Installing on VM..."
    ssh $ssh_opts alpine@localhost << 'EOSSH'
set -e
cd /tmp
tar xzf host-agent-deploy.tar.gz
cd host-agent
chmod +x install.sh
./install.sh
EOSSH

    log_success "Deployment complete!"
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."

    local ssh_opts="-p $VM_SSH_PORT -o StrictHostKeyChecking=no"

    # Check if service is running
    if ssh $ssh_opts alpine@localhost "sudo rc-service hostagent-s3custom status" | grep -q "started"; then
        log_success "Host agent service is running"
    else
        log_error "Host agent service is not running"
        return 1
    fi

    # Check if socket exists
    if ssh $ssh_opts alpine@localhost "test -S /var/run/hostagent.sock"; then
        log_success "Socket /var/run/hostagent.sock exists"
    else
        log_error "Socket not found"
        return 1
    fi

    # Test socket communication
    log_info "Testing socket communication..."
    if ssh $ssh_opts alpine@localhost 'echo "{\"cmd\":\"lsblk\",\"args\":[\"-J\"]}" | sudo nc -U /var/run/hostagent.sock' | grep -q "ok"; then
        log_success "Socket communication successful"
    else
        log_warn "Socket communication test inconclusive"
    fi

    return 0
}

# Show connection info
show_info() {
    cat << EOF

${GREEN}===================================================================
DEPLOYMENT SUCCESSFUL
===================================================================${NC}

The host-agent is now running in the test VM.

Connection Information:
  VM SSH:     ssh -p $VM_SSH_PORT alpine@localhost
  Socket:     /var/run/hostagent.sock (inside VM)

Service Management (on VM):
  Status:     sudo rc-service hostagent-s3custom status
  Start:      sudo rc-service hostagent-s3custom start
  Stop:       sudo rc-service hostagent-s3custom stop
  Restart:    sudo rc-service hostagent-s3custom restart
  Logs:       sudo tail -f /var/log/messages | grep hostagent

Testing the Socket:
  On VM:      echo '{"cmd":"lsblk","args":["-J"]}' | sudo nc -U /var/run/hostagent.sock

Next Steps:
  1. Setup SSH tunnel: ./setup-tunnel.sh
  2. Update docker-compose.override.yml to use tunnel
  3. Start the container app

${GREEN}===================================================================${NC}

EOF
}

# Main execution
log_info "Deploying host-agent to test VM..."
echo ""

check_ssh
build_agent
create_package
deploy_to_vm

echo ""
if verify_installation; then
    show_info
else
    log_error "Installation verification failed"
    log_info "Check VM logs: ssh -p $VM_SSH_PORT alpine@localhost 'sudo tail -100 /var/log/messages'"
    exit 1
fi
