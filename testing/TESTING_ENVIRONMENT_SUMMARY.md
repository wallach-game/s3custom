# Testing Environment Summary

This document provides an overview of the complete QEMU/KVM testing environment for s3custom.

## What Was Created

A comprehensive, automated testing environment with:

- **Virtual Machine**: Alpine Linux-based test VM with all required tools
- **Virtual Disks**: 6 configurable disks for RAID testing (1GB-5GB)
- **Host Agent**: Automated deployment of host-agent into the VM
- **Network Tunnel**: SSH-based Unix socket forwarding
- **Snapshot System**: Full VM state management
- **Test Scenarios**: Pre-built test scripts for common operations
- **Automation**: One-command setup and management

## Directory Structure

```
testing/
├── README.md                          # Comprehensive documentation
├── QUICKSTART.md                      # 5-minute quick start guide
├── TESTING_ENVIRONMENT_SUMMARY.md     # This file
├── .gitignore                         # Ignore VM images and runtime files
├── docker-compose.override.yml.example # Docker integration example
│
└── qemu/
    ├── testenv                        # Master control script
    ├── Makefile                       # Make-based workflow
    │
    ├── scripts/
    │   ├── config.sh                  # Central configuration
    │   ├── check-requirements.sh      # System requirements checker
    │   ├── create-disks.sh            # Virtual disk creation
    │   ├── setup-vm.sh                # VM initial setup
    │   ├── start-vm.sh                # Start VM with disks
    │   ├── stop-vm.sh                 # Stop VM gracefully
    │   ├── deploy-agent.sh            # Deploy host-agent to VM
    │   ├── setup-tunnel.sh            # Create SSH tunnel
    │   ├── stop-tunnel.sh             # Stop SSH tunnel
    │   ├── snapshot.sh                # Snapshot management
    │   └── monitor-vm.sh              # VM monitoring tools
    │
    ├── scenarios/
    │   ├── raid-create.sh             # RAID array creation test
    │   ├── raid-recovery.sh           # RAID recovery test
    │   ├── disk-power.sh              # Power management test
    │   ├── disk-smart.sh              # SMART monitoring test
    │   └── full-test.sh               # Comprehensive test suite
    │
    ├── vm-images/                     # VM and disk images (gitignored)
    │   ├── system.qcow2               # Main VM disk (created)
    │   ├── disk0.qcow2 - disk5.qcow2  # Test disks (created)
    │   └── alpine-virt-*.iso          # Alpine ISO (downloaded)
    │
    └── cloud-init/                    # Cloud-init configs (generated)
        ├── user-data
        ├── meta-data
        └── answers
```

## Key Features

### 1. Automation Scripts (scripts/)

**config.sh** - Central configuration
- VM resources (CPU, memory, disk sizes)
- Network configuration (ports)
- Paths and environment settings
- Color-coded logging functions

**check-requirements.sh** - System validation
- Checks for KVM support
- Verifies required commands
- Validates disk space and memory
- Tests network connectivity
- Shows installation commands

**create-disks.sh** - Virtual disk management
- Creates 6 configurable virtual disks
- Supports qcow2 and raw formats
- Interactive overwrite protection
- Size validation

**setup-vm.sh** - VM installation
- Downloads Alpine Linux ISO
- Creates system disk
- Guides through manual installation
- Generates cloud-init configs

**start-vm.sh** - VM launcher
- Attaches all virtual disks
- Configures networking with port forwarding
- Supports headless/graphical modes
- Creates PID and monitor files
- Background/foreground operation

**stop-vm.sh** - VM shutdown
- Graceful ACPI shutdown
- Force kill option
- Cleanup of PID and socket files

**deploy-agent.sh** - Agent deployment
- Builds host-agent locally
- Creates deployment package
- Uploads to VM via SSH
- Installs as OpenRC service
- Verifies installation

**setup-tunnel.sh** - Socket tunneling
- Creates SSH tunnel for Unix socket
- Uses socat for socket forwarding
- Tests connectivity
- Handles existing tunnels

**stop-tunnel.sh** - Tunnel cleanup
- Stops SSH tunnel gracefully
- Removes socket files
- Cleans up PID files

**snapshot.sh** - State management
- List snapshots across all disks
- Create consistent snapshots
- Restore to previous states
- Delete old snapshots

**monitor-vm.sh** - Monitoring tools
- Real-time VM status
- Resource usage monitoring
- RAID sync progress
- Agent log tailing
- Guest system information

### 2. Master Control (testenv)

Single command interface for all operations:

```bash
./testenv full          # Complete setup
./testenv start         # Start VM
./testenv stop          # Stop VM
./testenv status        # Show status
./testenv deploy        # Deploy agent
./testenv tunnel        # Setup tunnel
./testenv ssh           # SSH to VM
./testenv reset         # Reset to snapshot
./testenv test <name>   # Run test scenario
```

### 3. Test Scenarios (scenarios/)

**raid-create.sh** - RAID Creation
- Creates RAID 1 array (2 disks)
- Creates RAID 5 array (3 disks)
- Shows status and details
- Verification instructions

**raid-recovery.sh** - RAID Recovery
- Simulates disk failure
- Tests degraded operation
- Replaces failed disk
- Monitors rebuild process

**disk-power.sh** - Power Management
- Tests spin down/up commands
- Sets idle timeouts
- Verifies power states
- hdparm functionality

**disk-smart.sh** - SMART Monitoring
- Tests smartctl commands
- Handles unsupported disks
- Shows error handling
- All disk iteration

**full-test.sh** - Comprehensive Suite
- Disk detection
- RAID creation
- Filesystem operations
- Power management
- Failure simulation
- Recovery testing
- Complete cleanup

### 4. Makefile Targets

Simple make-based workflow:

```bash
make install            # Full setup
make start              # Start VM
make stop               # Stop VM
make status             # Show status
make deploy             # Deploy agent
make tunnel             # Setup tunnel
make ssh                # SSH to VM
make reset              # Reset state
make test TEST=name     # Run test
make test-all           # Run all tests
```

### 5. Docker Integration

**docker-compose.override.yml.example**
- Points container to test socket
- Environment variables
- Labels for identification
- Copy to project root to use

## Configuration Options

All configurable in `scripts/config.sh`:

### VM Resources
```bash
VM_MEMORY="2048"        # MB
VM_CPUS="2"             # CPU cores
VM_DISK_SIZE="10G"      # System disk
```

### Network
```bash
VM_SSH_PORT="2222"              # SSH port
VM_HOSTAGENT_PORT="9999"        # Agent port
HOSTAGENT_SOCKET_PATH="/tmp/hostagent-test.sock"
```

### Disks
```bash
DISK_COUNT="6"          # Number of test disks
DISK_FORMAT="qcow2"     # qcow2 or raw
DISK_SIZES[0]="1G"      # Individual sizes
DISK_SIZES[1]="1G"
DISK_SIZES[2]="2G"
DISK_SIZES[3]="2G"
DISK_SIZES[4]="5G"
DISK_SIZES[5]="5G"
```

## Usage Workflows

### First Time Setup

```bash
cd testing/qemu
./scripts/check-requirements.sh  # Verify system
./testenv full                   # Complete setup
./testenv snapshot create clean-install
```

### Daily Development

```bash
./testenv start
./testenv tunnel
# ... develop and test ...
./testenv stop
```

### Testing Cycle

```bash
./testenv start
./testenv tunnel
./testenv test raid-create      # Test
./testenv reset                 # Reset
./testenv test raid-recovery    # Test
./testenv reset                 # Reset
```

### Snapshot Management

```bash
./testenv stop
./testenv snapshot create before-experiment
./testenv start
# ... experiment ...
./testenv stop
./testenv snapshot restore before-experiment
./testenv start
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Host Machine (Arch Linux)                                  │
│                                                             │
│  ┌──────────────────┐          ┌──────────────────┐        │
│  │ Docker Container │          │  socat Tunnel    │        │
│  │                  │          │                  │        │
│  │  s3custom App    │◄────────►│  SSH Relay       │        │
│  │  Port 8080       │  Unix    │  Port 2222       │        │
│  └──────────────────┘  Socket  └────────┬─────────┘        │
│                                          │                  │
│  /tmp/hostagent-test.sock               │                  │
│                                          │                  │
│  ┌──────────────────────────────────────┼────────────────┐ │
│  │ QEMU/KVM VM (Alpine Linux)           │                │ │
│  │                                       ▼                │ │
│  │  ┌────────────────────────────────────────┐           │ │
│  │  │ Host Agent (OpenRC Service)            │           │ │
│  │  │ /var/run/hostagent.sock                │           │ │
│  │  └───┬────────────────────────────────────┘           │ │
│  │      │                                                 │ │
│  │      ▼                                                 │ │
│  │  ┌────────────────────────────────────────┐           │ │
│  │  │ System Tools                           │           │ │
│  │  │ mdadm, smartctl, hdparm, ddrescue      │           │ │
│  │  └───┬────────────────────────────────────┘           │ │
│  │      │                                                 │ │
│  │      ▼                                                 │ │
│  │  ┌────────────────────────────────────────┐           │ │
│  │  │ Virtual Disks (qcow2)                  │           │ │
│  │  │                                        │           │ │
│  │  │ vda: System (10GB)                     │           │ │
│  │  │ vdb: Test disk 0 (1GB)                 │           │ │
│  │  │ vdc: Test disk 1 (1GB)                 │           │ │
│  │  │ vdd: Test disk 2 (2GB)                 │           │ │
│  │  │ vde: Test disk 3 (2GB)                 │           │ │
│  │  │ vdf: Test disk 4 (5GB)                 │           │ │
│  │  │ vdg: Test disk 5 (5GB)                 │           │ │
│  │  └────────────────────────────────────────┘           │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Benefits

1. **Isolated Testing** - No risk to host system
2. **Reproducible** - Snapshots ensure consistent state
3. **Fast Reset** - Return to clean state in seconds
4. **Safe Experimentation** - Test destructive operations safely
5. **Realistic** - Real mdadm, real filesystems, real tools
6. **Automated** - One command to setup everything
7. **Well Documented** - Comprehensive guides and help
8. **Flexible** - Easy to customize and extend

## Limitations

- Virtual disks don't support SMART attributes (handled gracefully)
- Slower than bare metal (acceptable for testing)
- Requires KVM support (most modern Linux systems)
- Network forwarding adds slight latency (negligible)

## Testing Capabilities

### What You Can Test

- Disk detection and enumeration
- RAID array creation (0, 1, 5, 6, 10)
- RAID rebuild and recovery
- Disk failure simulation
- Power management (spin down/up)
- Mount/unmount operations
- Filesystem creation
- Disk cloning
- Recovery mode operations
- File operations on mounted disks
- API endpoints
- Web UI functionality

### What Requires Workarounds

- SMART monitoring (virtual disks don't have SMART)
  - Application should handle gracefully
  - Test error handling
- Physical disk hotplug
  - Use snapshot restore to simulate
- Real hardware-specific features
  - Focus on software logic testing

## Next Steps

1. Review [QUICKSTART.md](QUICKSTART.md) for quick setup
2. Read [README.md](README.md) for detailed documentation
3. Run `./scripts/check-requirements.sh` to verify system
4. Execute `./testenv full` for complete setup
5. Create scenarios for your specific test cases
6. Integrate with CI/CD if needed

## Support

For issues or questions:
1. Check the troubleshooting section in README.md
2. Run `./testenv status` to diagnose
3. Check logs with `./scripts/monitor-vm.sh logs`
4. Review the script source code (heavily commented)

## License

ISC (same as main project)
