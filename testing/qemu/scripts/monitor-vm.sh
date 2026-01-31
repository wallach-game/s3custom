#!/bin/bash
# Monitor VM status and logs in real-time

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

show_usage() {
    cat << EOF
Usage: $0 [option]

Options:
  status      Show current status (default)
  logs        Tail VM logs (requires SSH access)
  resources   Monitor VM resource usage
  raid        Monitor RAID sync status
  agent       Monitor host-agent logs
  all         Show everything

Examples:
  $0 status
  $0 logs
  $0 raid
EOF
}

show_status() {
    echo -e "${BLUE}=== VM Status ===${NC}"
    local pid_file="${VM_IMAGES_DIR}/${VM_NAME}.pid"

    if [ -f "$pid_file" ] && ps -p "$(cat "$pid_file")" > /dev/null 2>&1; then
        local pid=$(cat "$pid_file")
        echo -e "Status: ${GREEN}Running${NC}"
        echo "PID: $pid"

        # Get process info
        ps -p "$pid" -o pid,ppid,%cpu,%mem,vsz,rss,comm --no-headers | awk '{
            printf "CPU: %s%%\n", $3
            printf "Memory: %s%% (%s KB)\n", $4, $6
            printf "Virtual Size: %s KB\n", $5
        }'

        # Check SSH connectivity
        if timeout 2 bash -c "echo > /dev/tcp/localhost/$VM_SSH_PORT" 2>/dev/null; then
            echo -e "SSH: ${GREEN}Accessible${NC} (port $VM_SSH_PORT)"
        else
            echo -e "SSH: ${YELLOW}Not ready${NC} (may still be booting)"
        fi
    else
        echo -e "Status: ${RED}Stopped${NC}"
    fi

    echo ""
    echo -e "${BLUE}=== Tunnel Status ===${NC}"
    local tunnel_pid_file="${VM_IMAGES_DIR}/tunnel.pid"

    if [ -f "$tunnel_pid_file" ] && ps -p "$(cat "$tunnel_pid_file")" > /dev/null 2>&1; then
        echo -e "Status: ${GREEN}Running${NC}"
        echo "Socket: $HOSTAGENT_SOCKET_PATH"

        if [ -S "$HOSTAGENT_SOCKET_PATH" ]; then
            echo -e "Socket File: ${GREEN}Exists${NC}"

            # Test socket
            if echo '{"cmd":"lsblk","args":["-J"]}' | timeout 2 nc -U "$HOSTAGENT_SOCKET_PATH" 2>/dev/null | grep -q "ok"; then
                echo -e "Socket Test: ${GREEN}OK${NC}"
            else
                echo -e "Socket Test: ${YELLOW}Failed${NC}"
            fi
        else
            echo -e "Socket File: ${RED}Missing${NC}"
        fi
    else
        echo -e "Status: ${RED}Stopped${NC}"
    fi
}

show_logs() {
    log_info "Connecting to VM logs..."
    ssh -p "$VM_SSH_PORT" -o StrictHostKeyChecking=no alpine@localhost \
        "sudo tail -f /var/log/messages"
}

show_resources() {
    log_info "VM Resource Usage (updating every 2 seconds, Ctrl+C to stop)"
    echo ""

    while true; do
        clear
        echo -e "${BLUE}=== VM Resource Monitor ===${NC}"
        echo "Time: $(date)"
        echo ""

        # VM process resources
        local pid_file="${VM_IMAGES_DIR}/${VM_NAME}.pid"
        if [ -f "$pid_file" ] && ps -p "$(cat "$pid_file")" > /dev/null 2>&1; then
            local pid=$(cat "$pid_file")

            echo -e "${GREEN}QEMU Process:${NC}"
            ps -p "$pid" -o pid,%cpu,%mem,vsz,rss,cmd --no-headers | awk '{
                printf "  PID: %s\n", $1
                printf "  CPU: %s%%\n", $2
                printf "  Memory: %s%% (%s KB RSS)\n", $3, $5
                printf "  Virtual Size: %s KB\n", $4
            }'

            # Guest resources (if accessible)
            if timeout 2 bash -c "echo > /dev/tcp/localhost/$VM_SSH_PORT" 2>/dev/null; then
                echo ""
                echo -e "${GREEN}Guest System:${NC}"
                ssh -p "$VM_SSH_PORT" -o StrictHostKeyChecking=no alpine@localhost << 'EOSSH' 2>/dev/null || true
free -h | awk 'NR==2 {printf "  Memory: %s / %s (Used: %s)\n", $3, $2, $3}'
df -h / | awk 'NR==2 {printf "  Disk: %s / %s (Used: %s)\n", $3, $2, $5}'
uptime | awk '{printf "  Load Average: %s %s %s\n", $(NF-2), $(NF-1), $NF}'
EOSSH
            fi
        else
            echo -e "${RED}VM not running${NC}"
            break
        fi

        sleep 2
    done
}

show_raid() {
    log_info "RAID Sync Status (updating every 5 seconds, Ctrl+C to stop)"
    echo ""

    while true; do
        clear
        echo -e "${BLUE}=== RAID Status ===${NC}"
        echo "Time: $(date)"
        echo ""

        if timeout 2 bash -c "echo > /dev/tcp/localhost/$VM_SSH_PORT" 2>/dev/null; then
            ssh -p "$VM_SSH_PORT" -o StrictHostKeyChecking=no alpine@localhost << 'EOSSH' 2>/dev/null || {
                echo "Failed to retrieve RAID status"
                break
            }

if [ -f /proc/mdstat ]; then
    cat /proc/mdstat
else
    echo "No RAID arrays found or mdadm not configured"
fi

EOSSH
        else
            echo -e "${RED}VM not accessible${NC}"
            break
        fi

        sleep 5
    done
}

show_agent() {
    log_info "Host Agent Logs (live tail, Ctrl+C to stop)"
    echo ""

    ssh -p "$VM_SSH_PORT" -o StrictHostKeyChecking=no alpine@localhost \
        "sudo tail -f /var/log/messages | grep -i hostagent --line-buffered"
}

show_all() {
    clear
    echo -e "${BLUE}=== Complete VM Status ===${NC}"
    echo ""

    show_status

    echo ""
    echo -e "${BLUE}=== Disk Usage ===${NC}"
    if [ -d "$VM_IMAGES_DIR" ]; then
        du -sh "$VM_IMAGES_DIR"/* 2>/dev/null | sort -h || echo "No images found"
    fi

    echo ""
    echo -e "${BLUE}=== Snapshots ===${NC}"
    if [ -f "${VM_IMAGES_DIR}/system.qcow2" ]; then
        qemu-img snapshot -l "${VM_IMAGES_DIR}/system.qcow2" || echo "No snapshots"
    else
        echo "System disk not found"
    fi

    if timeout 2 bash -c "echo > /dev/tcp/localhost/$VM_SSH_PORT" 2>/dev/null; then
        echo ""
        echo -e "${BLUE}=== Guest Info ===${NC}"
        ssh -p "$VM_SSH_PORT" -o StrictHostKeyChecking=no alpine@localhost << 'EOSSH' 2>/dev/null || true
echo "Hostname: $(hostname)"
echo "Uptime: $(uptime -p)"
echo "Kernel: $(uname -r)"
echo ""
echo "Memory:"
free -h
echo ""
echo "Disk:"
df -h
echo ""
echo "RAID:"
cat /proc/mdstat 2>/dev/null || echo "No RAID arrays"
EOSSH
    fi
}

# Main execution
MODE="${1:-status}"

case $MODE in
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    resources)
        show_resources
        ;;
    raid)
        show_raid
        ;;
    agent)
        show_agent
        ;;
    all)
        show_all
        ;;
    -h|--help)
        show_usage
        ;;
    *)
        log_error "Unknown option: $MODE"
        show_usage
        exit 1
        ;;
esac
