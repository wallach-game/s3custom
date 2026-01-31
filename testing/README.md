# S3 Custom Test Environment

Complete QEMU/KVM-based testing environment for s3custom development and testing. This environment provides a full Alpine Linux VM with virtual disks for RAID testing, all accessible from the containerized application.

## Features

- **Automated VM Setup**: One-command setup of Alpine Linux test VM
- **Virtual Disks**: 6 configurable virtual disks (1GB-5GB) for RAID testing
- **Host Agent**: Automatically deploys and runs the host-agent in the VM
- **Socket Tunneling**: SSH tunnel exposes VM Unix socket to host
- **Snapshot Management**: Create/restore VM snapshots for repeatable tests
- **Test Scenarios**: Pre-built test scripts for common operations
- **Integration**: Docker Compose override for easy container integration

## Quick Start

### Prerequisites

```bash
# Arch Linux
sudo pacman -S qemu-full openssh socat

# Other distros
# Install qemu-system-x86_64, qemu-img, openssh, socat
```

### One-Command Setup

```bash
cd testing/qemu
chmod +x testenv scripts/*.sh scenarios/*.sh
./testenv full
```

This will:
1. Download Alpine Linux ISO
2. Guide you through VM installation
3. Create 6 virtual test disks
4. Deploy the host-agent to the VM
5. Setup SSH tunnel for socket access

### Manual Setup (Step by Step)

If you prefer to understand each step:

```bash
# 1. Create the VM
./testenv setup

# Follow the Alpine installation prompts:
#   - Login as root (no password)
#   - Run: setup-alpine
#   - Configure as prompted (see detailed instructions below)
#   - After install, reboot and configure user/packages

# 2. Create virtual disks
./testenv create-disks

# 3. Start the VM
./testenv start

# 4. Deploy host-agent
./testenv deploy

# 5. Setup socket tunnel
./testenv tunnel

# 6. Create a clean snapshot
./testenv snapshot create clean-install
```

## VM Installation Guide

When you run `./testenv setup`, the VM will boot from Alpine ISO. Follow these steps:

1. **Login**: `root` (no password)

2. **Run setup**:
   ```
   setup-alpine
   ```

3. **Configuration**:
   - Keyboard: `us us`
   - Hostname: `s3custom-test`
   - Network: `eth0`, `dhcp`, no manual config, no wireless
   - Root password: (choose a password)
   - Timezone: `UTC`
   - Proxy: `none`
   - NTP: `chrony`
   - APK mirror: `1` (or `f` for fastest)
   - SSH server: `openssh`
   - Disk: `vda`
   - Mode: `sys`

4. **After installation, reboot**:
   ```
   reboot
   ```

5. **Post-install setup** (login as root):
   ```bash
   # Install required packages
   apk update
   apk add mdadm smartmontools hdparm ddrescue e2fsprogs xfsprogs ntfs-3g nodejs npm sudo

   # Create user
   adduser alpine
   adduser alpine wheel

   # Configure sudo
   echo '%wheel ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/wheel

   # Allow root SSH (for testing only)
   sed -i 's/#PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config
   /etc/init.d/sshd restart

   # Shutdown
   poweroff
   ```

6. **Back on host**, start the VM with test disks:
   ```bash
   ./testenv start
   ```

## Usage

### Control Commands

```bash
# View status
./testenv status

# Start/stop VM
./testenv start
./testenv stop

# SSH into VM
./testenv ssh

# Manage tunnel
./testenv tunnel        # Start tunnel
./scripts/stop-tunnel.sh    # Stop tunnel

# Redeploy agent
./testenv deploy
```

### Snapshot Management

```bash
# List snapshots
./testenv snapshot list

# Create snapshot (VM must be stopped)
./testenv stop
./testenv snapshot create my-snapshot
./testenv start

# Restore snapshot
./testenv stop
./testenv snapshot restore clean-install
./testenv start
./testenv tunnel

# Delete snapshot
./testenv snapshot delete old-snapshot
```

### Quick Reset

```bash
# Reset to clean-install snapshot
./testenv reset
```

This stops the VM, restores the `clean-install` snapshot, and restarts everything.

## Test Scenarios

Pre-built test scenarios are in `scenarios/`:

```bash
# List available tests
./testenv test-list

# Run a test
./testenv test raid-create
./testenv test raid-recovery
./testenv test disk-power
./testenv test disk-smart
```

### Available Scenarios

- **raid-create**: Create RAID 1 and RAID 5 arrays
- **raid-recovery**: Test RAID recovery by failing and replacing a disk
- **disk-power**: Test disk spin up/down and idle timeout
- **disk-smart**: Test SMART disk monitoring

### Creating Custom Scenarios

Create a new `.sh` file in `scenarios/`:

```bash
#!/bin/bash
# Description: My custom test

set -e
source "$(dirname "$0")/../scripts/config.sh"

log_info "Running my custom test..."

ssh -p "$VM_SSH_PORT" -o StrictHostKeyChecking=no alpine@localhost << 'EOSSH'
# Your test commands here
lsblk
cat /proc/mdstat
EOSSH

log_success "Test complete!"
```

Make it executable:
```bash
chmod +x scenarios/my-test.sh
```

Run it:
```bash
./testenv test my-test
```

## Docker Integration

### Update Docker Compose

Create `docker-compose.override.yml` in the project root:

```yaml
services:
  app:
    volumes:
      # Use test VM socket instead of host socket
      - /tmp/hostagent-test.sock:/var/run/hostagent.sock
    environment:
      - HOSTAGENT_SOCKET=/var/run/hostagent.sock
```

### Start the Application

```bash
# Make sure VM and tunnel are running
cd testing/qemu
./testenv status

# If not running:
./testenv start
./testenv tunnel

# Start the app
cd ../..
docker compose up -d

# Access the UI
open http://localhost:8080
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Host Machine                                                │
│                                                             │
│  ┌──────────────┐                    ┌──────────────────┐  │
│  │  Container   │                    │  SSH Tunnel      │  │
│  │              │                    │  (socat)         │  │
│  │  App + UI    │◄──────────────────►│                  │  │
│  │              │  /tmp/hostagent-   │  localhost:2222  │  │
│  │  Port 8080   │  test.sock         └────────┬─────────┘  │
│  └──────────────┘                             │            │
│                                                │            │
│  ┌─────────────────────────────────────────────┼──────────┐ │
│  │ QEMU VM (Alpine Linux)                     │          │ │
│  │                                             ▼          │ │
│  │  ┌──────────────┐         ┌──────────────────────┐   │ │
│  │  │ Host Agent   │         │  SSH Server          │   │ │
│  │  │              │         │  Port 22             │   │ │
│  │  │ /var/run/    │         └──────────────────────┘   │ │
│  │  │ hostagent    │                                     │ │
│  │  │ .sock        │         ┌──────────────────────┐   │ │
│  │  └──────┬───────┘         │  mdadm, smartctl,    │   │ │
│  │         │                 │  hdparm, etc.        │   │ │
│  │         │                 └──────────────────────┘   │ │
│  │         ▼                                            │ │
│  │  ┌─────────────────────────────────────────────┐    │ │
│  │  │ Virtual Disks (qcow2)                       │    │ │
│  │  │  vdb (1GB)  vdc (1GB)  vdd (2GB)           │    │ │
│  │  │  vde (2GB)  vdf (5GB)  vdg (5GB)           │    │ │
│  │  └─────────────────────────────────────────────┘    │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

Edit `scripts/config.sh` to customize:

```bash
# VM Resources
export VM_MEMORY="2048"      # MB
export VM_CPUS="2"

# Ports
export VM_SSH_PORT="2222"

# Disk Configuration
export DISK_COUNT="6"
# Disk sizes in config.sh DISK_SIZES array

# Socket Path
export HOSTAGENT_SOCKET_PATH="/tmp/hostagent-test.sock"
```

## Troubleshooting

### VM won't start

```bash
# Check if KVM is available
ls -l /dev/kvm

# Check if already running
./testenv status

# Check system disk exists
ls -l vm-images/system.qcow2
```

### SSH connection fails

```bash
# Wait for boot (30-60 seconds)
sleep 30

# Test connection
ssh -p 2222 alpine@localhost

# Check VM is running
./testenv status

# Try with password auth if key fails
ssh -p 2222 -o PreferredAuthentications=password alpine@localhost
```

### Socket tunnel not working

```bash
# Check tunnel is running
./testenv status

# Check socat is installed
which socat

# Restart tunnel
./scripts/stop-tunnel.sh
./testenv tunnel

# Test tunnel manually
echo '{"cmd":"lsblk","args":["-J"]}' | nc -U /tmp/hostagent-test.sock
```

### Agent not responding

```bash
# SSH into VM
./testenv ssh

# Check service status
sudo rc-service hostagent-s3custom status

# Check logs
sudo tail -f /var/log/messages | grep hostagent

# Restart service
sudo rc-service hostagent-s3custom restart

# Check socket exists
ls -l /var/run/hostagent.sock

# Test socket directly
echo '{"cmd":"lsblk","args":["-J"]}' | sudo nc -U /var/run/hostagent.sock
```

### Container can't connect

```bash
# Verify tunnel is running
./testenv status

# Check socket permissions
ls -l /tmp/hostagent-test.sock

# Test from host
echo '{"cmd":"lsblk","args":["-J"]}' | nc -U /tmp/hostagent-test.sock

# Check docker-compose.override.yml
cat ../docker-compose.override.yml

# Restart container
docker compose restart
docker compose logs -f
```

### Disk performance issues

Virtual disks use qcow2 format which can be slower. For better performance:

```bash
# Stop VM
./testenv stop

# Convert to raw format (edit config.sh first)
# Set DISK_FORMAT="raw"
# Then recreate disks:
rm vm-images/disk*.qcow2
./testenv create-disks

# Restart
./testenv start
```

## File Structure

```
testing/
├── README.md                 # This file
├── qemu/
│   ├── testenv               # Master control script
│   ├── scripts/
│   │   ├── config.sh         # Configuration
│   │   ├── create-disks.sh   # Create virtual disks
│   │   ├── setup-vm.sh       # Initial VM setup
│   │   ├── start-vm.sh       # Start VM
│   │   ├── stop-vm.sh        # Stop VM
│   │   ├── deploy-agent.sh   # Deploy host-agent
│   │   ├── setup-tunnel.sh   # Setup SSH tunnel
│   │   ├── stop-tunnel.sh    # Stop SSH tunnel
│   │   └── snapshot.sh       # Snapshot management
│   ├── scenarios/
│   │   ├── raid-create.sh    # RAID creation test
│   │   ├── raid-recovery.sh  # RAID recovery test
│   │   ├── disk-power.sh     # Power management test
│   │   └── disk-smart.sh     # SMART monitoring test
│   ├── vm-images/            # VM and disk images (gitignored)
│   │   ├── system.qcow2
│   │   ├── disk0.qcow2
│   │   ├── disk1.qcow2
│   │   └── ...
│   └── cloud-init/           # Cloud-init files (generated)
```

## Tips

### Performance

- Use `qcow2` for space efficiency and snapshot support
- Use `raw` for better disk performance
- Allocate more CPUs/RAM in `config.sh` for better performance

### Workflow

1. Create a `clean-install` snapshot after initial setup
2. Run tests
3. Reset to `clean-install` between tests
4. Create scenario-specific snapshots for complex tests

### Development

- Keep the VM running during development
- Use `./testenv deploy` to redeploy agent changes
- The tunnel stays active across agent redeployments
- Use `./testenv ssh` for quick VM access

### CI/CD Integration

The environment can be automated for CI:

```bash
# Headless mode
./testenv start --headless

# Wait for SSH
timeout 60 bash -c 'until ssh -p 2222 alpine@localhost exit; do sleep 1; done'

# Run tests
./testenv test raid-create

# Cleanup
./testenv clean
```

## Advanced Usage

### Custom Disk Configuration

Edit `scripts/config.sh`:

```bash
export DISK_COUNT="8"
declare -A DISK_SIZES
DISK_SIZES[0]="500M"
DISK_SIZES[1]="1G"
# ... add more
```

### Bridge Networking

For better network performance, use bridge networking:

1. Create a bridge on the host
2. Edit `start-vm.sh` to use `-netdev bridge` instead of `-netdev user`
3. Configure static IP in VM

### VNC Access

The VM starts with VNC on `:0` (port 5900):

```bash
vncviewer localhost:5900
```

Or use a VNC client to connect to `localhost:5900`.

## Security Notes

- This is a **development/testing environment only**
- The VM is accessible via SSH on port 2222 with key-based auth
- The socket tunnel has no authentication
- Do not expose this environment to untrusted networks
- The VM has sudo access without password (for testing convenience)

## License

ISC (same as main project)
