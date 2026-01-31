# Testing Environment Index

Complete reference for the s3custom QEMU/KVM testing environment.

## Quick Links

- **Get Started**: [QUICKSTART.md](QUICKSTART.md) - 5-minute setup guide
- **Full Documentation**: [README.md](README.md) - Comprehensive documentation
- **Summary**: [TESTING_ENVIRONMENT_SUMMARY.md](TESTING_ENVIRONMENT_SUMMARY.md) - Overview and architecture
- **Docker Integration**: [docker-compose.override.yml.example](docker-compose.override.yml.example) - Container configuration

## File Reference

### Documentation (4 files)

| File | Purpose |
|------|---------|
| [INDEX.md](INDEX.md) | This file - complete reference |
| [QUICKSTART.md](QUICKSTART.md) | Quick 5-minute setup guide |
| [README.md](README.md) | Full documentation (architecture, usage, troubleshooting) |
| [TESTING_ENVIRONMENT_SUMMARY.md](TESTING_ENVIRONMENT_SUMMARY.md) | Overview, features, and benefits |

### Control Scripts (2 files)

| File | Purpose |
|------|---------|
| [qemu/testenv](qemu/testenv) | Master control script - main interface |
| [qemu/Makefile](qemu/Makefile) | Make-based workflow automation |

### Core Scripts (11 files)

Located in `qemu/scripts/`:

| Script | Purpose | Usage |
|--------|---------|-------|
| [config.sh](qemu/scripts/config.sh) | Central configuration | Sourced by all scripts |
| [check-requirements.sh](qemu/scripts/check-requirements.sh) | System validation | `./check-requirements.sh` |
| [create-disks.sh](qemu/scripts/create-disks.sh) | Create virtual disks | `./testenv create-disks` |
| [setup-vm.sh](qemu/scripts/setup-vm.sh) | Initial VM setup | `./testenv setup` |
| [start-vm.sh](qemu/scripts/start-vm.sh) | Start VM | `./testenv start` |
| [stop-vm.sh](qemu/scripts/stop-vm.sh) | Stop VM | `./testenv stop` |
| [deploy-agent.sh](qemu/scripts/deploy-agent.sh) | Deploy host-agent | `./testenv deploy` |
| [setup-tunnel.sh](qemu/scripts/setup-tunnel.sh) | Setup SSH tunnel | `./testenv tunnel` |
| [stop-tunnel.sh](qemu/scripts/stop-tunnel.sh) | Stop tunnel | `./scripts/stop-tunnel.sh` |
| [snapshot.sh](qemu/scripts/snapshot.sh) | Snapshot management | `./testenv snapshot <cmd>` |
| [monitor-vm.sh](qemu/scripts/monitor-vm.sh) | VM monitoring | `./scripts/monitor-vm.sh <mode>` |

### Test Scenarios (5 files)

Located in `qemu/scenarios/`:

| Scenario | Description | Usage |
|----------|-------------|-------|
| [raid-create.sh](qemu/scenarios/raid-create.sh) | Create RAID 1 and RAID 5 arrays | `./testenv test raid-create` |
| [raid-recovery.sh](qemu/scenarios/raid-recovery.sh) | Test disk failure and recovery | `./testenv test raid-recovery` |
| [disk-power.sh](qemu/scenarios/disk-power.sh) | Test power management | `./testenv test disk-power` |
| [disk-smart.sh](qemu/scenarios/disk-smart.sh) | Test SMART monitoring | `./testenv test disk-smart` |
| [full-test.sh](qemu/scenarios/full-test.sh) | Comprehensive test suite | `./testenv test full-test` |

### Configuration Files (2 files)

| File | Purpose |
|------|---------|
| [.gitignore](.gitignore) | Ignore VM images and runtime files |
| [docker-compose.override.yml.example](docker-compose.override.yml.example) | Docker integration template |

## Command Reference

### Master Control (testenv)

```bash
# Setup and Management
./testenv full              # Complete first-time setup
./testenv setup             # Create VM (manual install)
./testenv start             # Start the VM
./testenv stop              # Stop the VM
./testenv status            # Show status
./testenv clean             # Stop everything

# Agent and Network
./testenv deploy            # Deploy host-agent to VM
./testenv tunnel            # Setup SSH tunnel
./testenv ssh               # SSH into VM

# State Management
./testenv reset             # Reset to clean-install snapshot
./testenv snapshot list     # List snapshots
./testenv snapshot create NAME    # Create snapshot
./testenv snapshot restore NAME   # Restore snapshot

# Disk Management
./testenv create-disks      # Create virtual disks

# Testing
./testenv test-list         # List test scenarios
./testenv test SCENARIO     # Run a test scenario
```

### Makefile Targets

```bash
# Quick Commands
make install                # Full setup (alias for full)
make start                  # Start VM
make stop                   # Stop VM
make status                 # Show status
make clean                  # Stop everything

# Development
make dev-start              # Start VM + tunnel
make dev-restart            # Restart VM + tunnel
make dev-clean              # Stop everything

# Testing
make test TEST=name         # Run specific test
make test-all               # Run all tests
make test-list              # List tests

# Snapshots
make snapshot-list          # List snapshots
make snapshot-create NAME=x # Create snapshot
make snapshot-restore NAME=x # Restore snapshot

# Other
make deploy                 # Deploy agent
make tunnel                 # Setup tunnel
make ssh                    # SSH to VM
make reset                  # Reset to clean state
```

### Direct Script Usage

```bash
# Check system requirements
cd qemu/scripts
./check-requirements.sh

# Monitor VM
./monitor-vm.sh status      # Show status
./monitor-vm.sh logs        # Tail VM logs
./monitor-vm.sh resources   # Monitor resources
./monitor-vm.sh raid        # Watch RAID sync
./monitor-vm.sh agent       # Tail agent logs
./monitor-vm.sh all         # Show everything

# Manual snapshot management
./snapshot.sh list
./snapshot.sh create my-snapshot
./snapshot.sh restore my-snapshot
./snapshot.sh delete my-snapshot
```

## Configuration Reference

Edit `qemu/scripts/config.sh`:

### VM Resources
```bash
VM_NAME="s3custom-test"     # VM name
VM_MEMORY="2048"            # Memory in MB
VM_CPUS="2"                 # CPU cores
VM_DISK_SIZE="10G"          # System disk size
```

### Network
```bash
VM_SSH_PORT="2222"          # SSH port on host
VM_HOSTAGENT_PORT="9999"    # Agent port (for reference)
HOSTAGENT_SOCKET_PATH="/tmp/hostagent-test.sock"
```

### Disks
```bash
DISK_COUNT="6"              # Number of test disks
DISK_FORMAT="qcow2"         # qcow2 or raw

# Individual disk sizes
DISK_SIZES[0]="1G"
DISK_SIZES[1]="1G"
DISK_SIZES[2]="2G"
DISK_SIZES[3]="2G"
DISK_SIZES[4]="5G"
DISK_SIZES[5]="5G"
```

### Alpine Linux
```bash
ALPINE_VERSION="3.19"       # Alpine version
ALPINE_ARCH="x86_64"        # Architecture
ALPINE_VARIANT="virt"       # Virtual optimized
```

## Workflow Examples

### First Time Setup

```bash
cd testing/qemu

# Check system
./scripts/check-requirements.sh

# Full setup (one command)
./testenv full

# Or step by step
./testenv setup             # Install Alpine (manual)
./testenv create-disks      # Create test disks
./testenv start             # Start VM
./testenv deploy            # Deploy agent
./testenv tunnel            # Setup tunnel

# Create clean snapshot
./testenv snapshot create clean-install
```

### Daily Development

```bash
# Start environment
make dev-start              # Or: ./testenv start && ./testenv tunnel

# Work on code...

# Test
make test TEST=raid-create

# Reset and test again
make reset
make test TEST=raid-recovery

# Stop
make stop
```

### Testing Cycle

```bash
# Start clean
./testenv start
./testenv tunnel

# Run tests
./testenv test full-test

# If something breaks, reset
./testenv reset

# Try again
./testenv test raid-create
```

### Snapshot Workflow

```bash
# Create experimental snapshot
./testenv stop
./testenv snapshot create experiment-1
./testenv start

# Experiment...

# If experiment fails, restore
./testenv stop
./testenv snapshot restore clean-install
./testenv start

# If experiment succeeds, keep it
./testenv stop
./testenv snapshot create working-state
./testenv start
```

## Troubleshooting Quick Reference

### VM Won't Start
```bash
./testenv status            # Check status
ls -l /dev/kvm             # Verify KVM
ls -l qemu/vm-images/      # Check disk exists
```

### Can't SSH
```bash
# Wait for boot
sleep 30
ssh -p 2222 alpine@localhost

# Check VM
./testenv status
```

### Tunnel Issues
```bash
# Restart tunnel
./scripts/stop-tunnel.sh
./testenv tunnel

# Test
echo '{"cmd":"lsblk","args":["-J"]}' | nc -U /tmp/hostagent-test.sock
```

### Agent Not Responding
```bash
# SSH to VM
./testenv ssh

# Check service
sudo rc-service hostagent-s3custom status
sudo rc-service hostagent-s3custom restart

# Check logs
sudo tail -f /var/log/messages | grep hostagent
```

### Container Can't Connect
```bash
# Check tunnel
./testenv status

# Test socket
echo '{"cmd":"lsblk","args":["-J"]}' | nc -U /tmp/hostagent-test.sock

# Check override file
cat ../docker-compose.override.yml

# Restart container
docker compose restart
```

## File Locations

### On Host
- Project: `/home/jirka/Documents/s3custom_report/s3custom/`
- Testing: `/home/jirka/Documents/s3custom_report/s3custom/testing/`
- VM Images: `testing/qemu/vm-images/`
- Socket: `/tmp/hostagent-test.sock`

### In VM
- Agent: `/opt/s3custom-agent/`
- Socket: `/var/run/hostagent.sock`
- Service: `/etc/init.d/hostagent-s3custom`

### Network
- VM SSH: `localhost:2222`
- Web UI: `http://localhost:8080`

## Statistics

### Files Created
- Documentation: 4 files
- Scripts: 13 files
- Scenarios: 5 files
- Configuration: 2 files
- **Total: 24 files**

### Lines of Code
- Shell scripts: ~2,500 lines
- Documentation: ~1,500 lines
- **Total: ~4,000 lines**

### Capabilities
- VM setup: Automated
- Disk creation: 6 disks configurable
- RAID levels: 0, 1, 5, 6, 10
- Test scenarios: 5 pre-built
- Snapshot states: Unlimited

## Getting Help

1. Read the documentation in order:
   - [QUICKSTART.md](QUICKSTART.md) - Quick start
   - [README.md](README.md) - Full docs
   - [TESTING_ENVIRONMENT_SUMMARY.md](TESTING_ENVIRONMENT_SUMMARY.md) - Overview

2. Check status and logs:
   ```bash
   ./testenv status
   ./scripts/monitor-vm.sh all
   ```

3. Review troubleshooting section in README.md

4. Check script source code (well commented)

## Next Steps

1. **First Time Users**: Start with [QUICKSTART.md](QUICKSTART.md)
2. **Developers**: Read [README.md](README.md) sections on Docker Integration and Testing
3. **Advanced Users**: Review [TESTING_ENVIRONMENT_SUMMARY.md](TESTING_ENVIRONMENT_SUMMARY.md) for architecture
4. **Everyone**: Run `./scripts/check-requirements.sh` before starting

## License

ISC (same as main project)

---

**Environment Version**: 1.0
**Created**: 2026-01-31
**Compatibility**: Alpine Linux 3.19, QEMU/KVM on Linux
