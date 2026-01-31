#!/bin/bash
# Setup Alpine Linux VM for host-agent testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

check_linux
check_dependencies
ensure_directories

SYSTEM_DISK="${VM_IMAGES_DIR}/system.qcow2"
ALPINE_ISO="${VM_IMAGES_DIR}/alpine-virt-${ALPINE_VERSION}.1-${ALPINE_ARCH}.iso"

download_alpine() {
    if [ -f "$ALPINE_ISO" ]; then
        log_info "Alpine ISO already exists at $ALPINE_ISO"
        return
    fi

    log_info "Downloading Alpine Linux ${ALPINE_VERSION}..."
    wget -O "$ALPINE_ISO" "$ALPINE_ISO_URL"
    log_success "Downloaded Alpine ISO"
}

create_system_disk() {
    if [ -f "$SYSTEM_DISK" ]; then
        log_warn "System disk already exists at $SYSTEM_DISK"
        read -p "Recreate? This will destroy the VM! (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Keeping existing system disk"
            return
        fi
        rm -f "$SYSTEM_DISK"
    fi

    log_info "Creating system disk (${VM_DISK_SIZE})..."
    qemu-img create -f qcow2 "$SYSTEM_DISK" "$VM_DISK_SIZE"
    log_success "Created system disk"
}

create_cloud_init() {
    log_info "Creating cloud-init configuration..."

    # Create user-data
    cat > "${CLOUD_INIT_DIR}/user-data" << 'EOF'
#cloud-config
users:
  - name: alpine
    groups: wheel
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/ash
    ssh_authorized_keys:
      - ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC... # Will be replaced

packages:
  - mdadm
  - smartmontools
  - hdparm
  - ddrescue
  - e2fsprogs
  - xfsprogs
  - ntfs-3g
  - nodejs
  - npm

runcmd:
  - apk update
  - apk add mdadm smartmontools hdparm ddrescue e2fsprogs xfsprogs ntfs-3g nodejs npm
  - rc-update add mdadm boot
  - rc-update add sshd default
  - /etc/init.d/sshd start
  - echo "Setup complete"
EOF

    # Create meta-data
    cat > "${CLOUD_INIT_DIR}/meta-data" << EOF
instance-id: s3custom-test-vm
local-hostname: ${VM_NAME}
EOF

    log_success "Cloud-init files created"
}

create_answer_file() {
    log_info "Creating Alpine setup answer file..."

    cat > "${CLOUD_INIT_DIR}/answers" << 'EOF'
# Alpine Linux answer file for automated installation
KEYMAPOPTS="us us"
HOSTNAMEOPTS="-n s3custom-test"
INTERFACESOPTS="auto lo
iface lo inet loopback

auto eth0
iface eth0 inet dhcp
"
TIMEZONEOPTS="-z UTC"
PROXYOPTS="none"
APKREPOSOPTS="-1"
SSHDOPTS="-c openssh"
NTPOPTS="-c chrony"
DISKOPTS="-m sys /dev/vda"
EOF

    log_success "Answer file created"
}

show_manual_instructions() {
    cat << 'EOF'

===================================================================
MANUAL VM SETUP INSTRUCTIONS
===================================================================

The VM will now boot from the Alpine ISO. Follow these steps:

1. Login as 'root' (no password)

2. Run setup-alpine:
   # setup-alpine

3. Follow prompts:
   - Keyboard: us us
   - Hostname: s3custom-test
   - Network: eth0, dhcp, no manual config
   - Root password: (set a password)
   - Timezone: UTC
   - Proxy: none
   - NTP: chrony
   - APK mirror: 1 (or f for fastest)
   - SSH server: openssh
   - Disk: vda
   - Mode: sys

4. After installation, reboot:
   # reboot

5. After reboot, login as root and setup:
   # apk update
   # apk add mdadm smartmontools hdparm ddrescue e2fsprogs xfsprogs ntfs-3g nodejs npm sudo
   # adduser alpine
   # adduser alpine wheel
   # echo '%wheel ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/wheel
   # sed -i 's/#PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config
   # /etc/init.d/sshd restart

6. Shutdown the VM:
   # poweroff

7. Run the start-vm.sh script to start with the test disks

===================================================================

Press Enter to launch the VM...
EOF
    read
}

launch_installer() {
    log_info "Launching Alpine installer VM..."
    log_warn "This will open a QEMU window for manual installation"

    show_manual_instructions

    qemu-system-x86_64 \
        -name "$VM_NAME-installer" \
        -machine q35,accel=kvm \
        -cpu host \
        -smp "$VM_CPUS" \
        -m "$VM_MEMORY" \
        -cdrom "$ALPINE_ISO" \
        -drive file="$SYSTEM_DISK",format=qcow2,if=virtio \
        -netdev user,id=net0 \
        -device virtio-net-pci,netdev=net0 \
        -boot order=d \
        -vnc :0

    log_success "Installation complete!"
    log_info "The VM has been shut down. Use start-vm.sh to launch with test disks."
}

# Main execution
log_info "Setting up Alpine Linux VM for s3custom testing..."
echo ""

download_alpine
create_system_disk
create_cloud_init
create_answer_file

log_info "Setup preparation complete!"
echo ""
log_warn "Note: Alpine Linux requires manual installation through the console."
log_info "The VM will boot from ISO and you'll need to run 'setup-alpine' manually."
echo ""

read -p "Launch installer now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    launch_installer
else
    log_info "Skipped installer launch. Run this script again when ready."
    log_info "Or manually launch with: qemu-system-x86_64 -cdrom $ALPINE_ISO -drive file=$SYSTEM_DISK ..."
fi
