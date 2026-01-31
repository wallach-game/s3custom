#!/bin/bash
# Configuration file for QEMU/KVM test environment

# Paths
export TESTING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export SCRIPTS_DIR="${TESTING_DIR}/scripts"
export VM_IMAGES_DIR="${TESTING_DIR}/vm-images"
export CLOUD_INIT_DIR="${TESTING_DIR}/cloud-init"
export SCENARIOS_DIR="${TESTING_DIR}/scenarios"

# VM Configuration
export VM_NAME="s3custom-test"
export VM_MEMORY="2048"  # MB
export VM_CPUS="2"
export VM_DISK_SIZE="10G"  # Main system disk

# Network Configuration
export VM_SSH_PORT="2222"
export VM_HOSTAGENT_PORT="9999"
export BRIDGE_NAME="br0"  # For bridge networking (optional)

# Virtual Disks Configuration (for RAID testing)
export DISK_COUNT="6"
declare -A DISK_SIZES
DISK_SIZES[0]="1G"
DISK_SIZES[1]="1G"
DISK_SIZES[2]="2G"
DISK_SIZES[3]="2G"
DISK_SIZES[4]="5G"
DISK_SIZES[5]="5G"
export DISK_SIZES

# Disk format: raw or qcow2
export DISK_FORMAT="qcow2"

# Alpine Linux Configuration
export ALPINE_VERSION="3.19"
export ALPINE_ARCH="x86_64"
export ALPINE_VARIANT="virt"  # Virtual optimized variant
export ALPINE_ISO_URL="https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/${ALPINE_ARCH}/alpine-virt-${ALPINE_VERSION}.1-${ALPINE_ARCH}.iso"

# Host Agent Configuration
export HOSTAGENT_SOCKET_PATH="/tmp/hostagent-test.sock"
export HOSTAGENT_PORT="9999"  # For SSH tunnel

# Colors for output
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on Linux
check_linux() {
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        log_error "This script must be run on Linux"
        exit 1
    fi
}

# Check for required commands
check_dependencies() {
    local deps=("qemu-system-x86_64" "qemu-img" "ssh" "scp")
    local missing=()

    for cmd in "${deps[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing+=("$cmd")
        fi
    done

    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Missing required dependencies: ${missing[*]}"
        log_info "Install with: sudo pacman -S qemu-full openssh"
        return 1
    fi

    return 0
}

# Create necessary directories
ensure_directories() {
    mkdir -p "$VM_IMAGES_DIR"
    mkdir -p "$CLOUD_INIT_DIR"
    mkdir -p "$SCENARIOS_DIR"
    mkdir -p "$SCRIPTS_DIR"
}
