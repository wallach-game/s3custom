#!/bin/bash
# Check system requirements for QEMU test environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

ALL_OK=true

echo -e "${BLUE}Checking System Requirements for S3 Custom Test Environment${NC}"
echo ""

# Check operating system
check_os() {
    echo -e "${BLUE}Operating System:${NC}"
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo -e "  ${GREEN}✓${NC} Linux detected"
        echo "    $(uname -sr)"
    else
        echo -e "  ${RED}✗${NC} Not running on Linux"
        echo "    This test environment requires Linux"
        ALL_OK=false
    fi
    echo ""
}

# Check for KVM support
check_kvm() {
    echo -e "${BLUE}KVM Virtualization:${NC}"

    if [ -e /dev/kvm ]; then
        echo -e "  ${GREEN}✓${NC} /dev/kvm exists"

        if [ -r /dev/kvm ] && [ -w /dev/kvm ]; then
            echo -e "  ${GREEN}✓${NC} KVM accessible (read/write permissions)"
        else
            echo -e "  ${YELLOW}!${NC} KVM exists but not accessible"
            echo "    Run: sudo chmod 666 /dev/kvm"
            echo "    Or add user to kvm group: sudo usermod -a -G kvm $USER"
        fi
    else
        echo -e "  ${RED}✗${NC} /dev/kvm not found"
        echo "    KVM may not be enabled in BIOS"
        echo "    Or kernel module not loaded: sudo modprobe kvm kvm_intel  (or kvm_amd)"
        ALL_OK=false
    fi
    echo ""
}

# Check required commands
check_commands() {
    echo -e "${BLUE}Required Commands:${NC}"

    local required=(
        "qemu-system-x86_64:QEMU x86_64 emulator"
        "qemu-img:QEMU disk image utility"
        "ssh:OpenSSH client"
        "scp:Secure copy"
        "socat:Socket relay tool"
        "nc:Netcat (for testing)"
    )

    for item in "${required[@]}"; do
        local cmd="${item%%:*}"
        local desc="${item#*:}"

        if command -v "$cmd" &> /dev/null; then
            echo -e "  ${GREEN}✓${NC} $cmd ($desc)"
            if [ "$cmd" = "qemu-system-x86_64" ]; then
                echo "    Version: $(qemu-system-x86_64 --version | head -1)"
            fi
        else
            echo -e "  ${RED}✗${NC} $cmd not found ($desc)"
            ALL_OK=false
        fi
    done
    echo ""
}

# Check disk space
check_disk_space() {
    echo -e "${BLUE}Disk Space:${NC}"

    local required_gb=30
    local required_kb=$((required_gb * 1024 * 1024))

    ensure_directories

    local available=$(df -k "$VM_IMAGES_DIR" | tail -1 | awk '{print $4}')
    local available_gb=$((available / 1024 / 1024))

    if [ "$available" -gt "$required_kb" ]; then
        echo -e "  ${GREEN}✓${NC} Sufficient space available"
        echo "    Location: $VM_IMAGES_DIR"
        echo "    Available: ${available_gb}GB (required: ${required_gb}GB)"
    else
        echo -e "  ${YELLOW}!${NC} Low disk space"
        echo "    Location: $VM_IMAGES_DIR"
        echo "    Available: ${available_gb}GB (recommended: ${required_gb}GB)"
        echo "    Test environment may still work but with limited disk operations"
    fi
    echo ""
}

# Check memory
check_memory() {
    echo -e "${BLUE}System Memory:${NC}"

    local total_mem=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    local total_mem_gb=$((total_mem / 1024 / 1024))

    local recommended_gb=4
    local recommended_kb=$((recommended_gb * 1024 * 1024))

    if [ "$total_mem" -gt "$recommended_kb" ]; then
        echo -e "  ${GREEN}✓${NC} Sufficient memory"
        echo "    Total: ${total_mem_gb}GB (recommended: ${recommended_gb}GB)"
    else
        echo -e "  ${YELLOW}!${NC} Low memory"
        echo "    Total: ${total_mem_gb}GB (recommended: ${recommended_gb}GB)"
        echo "    Consider reducing VM_MEMORY in config.sh"
    fi

    echo "    VM will use: ${VM_MEMORY}MB"
    echo ""
}

# Check CPU
check_cpu() {
    echo -e "${BLUE}CPU:${NC}"

    local cpu_count=$(nproc)

    if [ "$cpu_count" -ge 2 ]; then
        echo -e "  ${GREEN}✓${NC} CPU cores: $cpu_count"
    else
        echo -e "  ${YELLOW}!${NC} Only 1 CPU core detected"
        echo "    Multi-core recommended for better performance"
    fi

    echo "    VM will use: ${VM_CPUS} cores"
    echo ""
}

# Check network
check_network() {
    echo -e "${BLUE}Network:${NC}"

    # Check if port 2222 is available
    if ss -tuln | grep -q ":${VM_SSH_PORT}"; then
        echo -e "  ${YELLOW}!${NC} Port $VM_SSH_PORT already in use"
        echo "    Change VM_SSH_PORT in config.sh"
    else
        echo -e "  ${GREEN}✓${NC} Port $VM_SSH_PORT available for SSH"
    fi

    # Check internet connectivity (for Alpine download)
    if ping -c 1 dl-cdn.alpinelinux.org &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} Internet connectivity (Alpine download site reachable)"
    else
        echo -e "  ${YELLOW}!${NC} Cannot reach Alpine download site"
        echo "    You may need to download Alpine ISO manually"
    fi
    echo ""
}

# Show installation commands
show_install_commands() {
    echo -e "${BLUE}Installation Commands:${NC}"
    echo ""
    echo "Arch Linux:"
    echo "  sudo pacman -S qemu-full openssh socat"
    echo ""
    echo "Ubuntu/Debian:"
    echo "  sudo apt update"
    echo "  sudo apt install qemu-system-x86 qemu-utils openssh-client socat netcat-openbsd"
    echo ""
    echo "Fedora/RHEL:"
    echo "  sudo dnf install qemu-kvm qemu-img openssh-clients socat nmap-ncat"
    echo ""
    echo "openSUSE:"
    echo "  sudo zypper install qemu-kvm qemu-tools openssh socat netcat-openbsd"
    echo ""
}

# Summary
show_summary() {
    echo ""
    echo "========================================"
    if [ "$ALL_OK" = true ]; then
        echo -e "${GREEN}All requirements met!${NC}"
        echo ""
        echo "You can now run:"
        echo "  ./testenv full"
        echo ""
        echo "Or:"
        echo "  make install"
    else
        echo -e "${RED}Some requirements are missing!${NC}"
        echo ""
        echo "Please install missing dependencies and try again."
        echo ""
        show_install_commands
    fi
    echo "========================================"
}

# Main execution
check_os
check_kvm
check_commands
check_disk_space
check_memory
check_cpu
check_network
show_summary
