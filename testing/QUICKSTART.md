# Quick Start Guide

Get the test environment running in 5 minutes.

## Prerequisites

```bash
# Arch Linux
sudo pacman -S qemu-full openssh socat

# Ubuntu/Debian
sudo apt install qemu-system-x86 qemu-utils openssh-client socat

# Fedora/RHEL
sudo dnf install qemu-kvm qemu-img openssh-clients socat
```

## Installation

### Option 1: One Command (Recommended)

```bash
cd testing/qemu
chmod +x testenv scripts/*.sh scenarios/*.sh
./testenv full
```

Follow the Alpine Linux installation prompts, then the script handles the rest.

### Option 2: Using Makefile

```bash
cd testing/qemu
make install
```

## What Gets Installed

The `full` setup creates:

1. Alpine Linux VM (10GB system disk)
2. 6 virtual disks (1GB, 1GB, 2GB, 2GB, 5GB, 5GB)
3. Host-agent service running in the VM
4. SSH tunnel exposing VM socket to host
5. Everything configured and ready to use

## After Installation

### 1. Create a Clean Snapshot

```bash
# Using testenv
./testenv snapshot create clean-install

# Or using make
make snapshot-create NAME=clean-install
```

### 2. Configure Docker Compose

```bash
# Copy the example override file
cp testing/docker-compose.override.yml.example docker-compose.override.yml
```

The override file points the container to use the test VM socket:

```yaml
services:
  app:
    volumes:
      - /tmp/hostagent-test.sock:/var/run/hostagent.sock
```

### 3. Start the Application

```bash
# From project root
docker compose up -d

# Check logs
docker compose logs -f
```

### 4. Access the Web UI

Open http://localhost:8080 in your browser.

## Daily Usage

### Starting the Test Environment

```bash
cd testing/qemu

# Start VM and tunnel
./testenv start
./testenv tunnel

# Or with make
make dev-start
```

### Running Tests

```bash
# List available tests
./testenv test-list

# Run a specific test
./testenv test raid-create

# Or with make
make test TEST=raid-create
```

### Stopping

```bash
# Stop VM and tunnel
./testenv stop
./scripts/stop-tunnel.sh

# Or with make
make clean
```

### Resetting to Clean State

```bash
# Reset to clean-install snapshot
./testenv reset

# Or with make
make reset
```

## Common Commands

### testenv Commands

```bash
./testenv status          # Show VM and tunnel status
./testenv start           # Start the VM
./testenv stop            # Stop the VM
./testenv ssh             # SSH into the VM
./testenv deploy          # Redeploy host-agent
./testenv tunnel          # Setup SSH tunnel
./testenv reset           # Reset to clean snapshot
./testenv test <name>     # Run a test scenario
```

### Makefile Commands

```bash
make status               # Show status
make start                # Start VM
make stop                 # Stop VM
make ssh                  # SSH into VM
make deploy               # Redeploy host-agent
make tunnel               # Setup tunnel
make reset                # Reset to clean
make test TEST=<name>     # Run test
make test-all             # Run all tests
```

## Troubleshooting

### VM won't start

```bash
# Check status
./testenv status

# Check if KVM is available
ls -l /dev/kvm

# Check system disk exists
ls -l vm-images/system.qcow2
```

### Can't SSH into VM

```bash
# Wait for boot (30-60 seconds after start)
sleep 30

# Test connection
ssh -p 2222 alpine@localhost

# If that fails, check VM is running
./testenv status
```

### Container can't connect to agent

```bash
# Check tunnel is running
./testenv status

# Test tunnel manually
echo '{"cmd":"lsblk","args":["-J"]}' | nc -U /tmp/hostagent-test.sock

# Restart tunnel if needed
./scripts/stop-tunnel.sh
./testenv tunnel

# Restart container
docker compose restart
```

### Agent not responding in VM

```bash
# SSH into VM
./testenv ssh

# Check service
sudo rc-service hostagent-s3custom status

# Restart service
sudo rc-service hostagent-s3custom restart

# Check logs
sudo tail -f /var/log/messages | grep hostagent
```

## File Locations

- VM images: `testing/qemu/vm-images/`
- Scripts: `testing/qemu/scripts/`
- Test scenarios: `testing/qemu/scenarios/`
- Socket on host: `/tmp/hostagent-test.sock`
- Socket in VM: `/var/run/hostagent.sock`
- VM SSH port: `2222`

## Next Steps

- Read the full [testing/README.md](README.md) for detailed documentation
- Create custom test scenarios in `scenarios/`
- Configure VM resources in `scripts/config.sh`
- Run the test scenarios and verify in the web UI

## Tips

1. Always create a `clean-install` snapshot after initial setup
2. Use `./testenv reset` to quickly get back to a clean state
3. Keep the VM and tunnel running during development
4. The tunnel persists across host-agent redeployments
5. Use `./testenv ssh` for quick VM access
6. Check `./testenv status` if something doesn't work

## Example Workflow

```bash
# Day 1: Setup
cd testing/qemu
./testenv full
./testenv snapshot create clean-install

# Day 2+: Development
./testenv start
./testenv tunnel
# ... develop and test ...

# Test RAID functionality
./testenv test raid-create
# ... verify in web UI ...

# Reset and test again
./testenv reset
./testenv test raid-recovery
# ... verify in web UI ...

# Done for the day
./testenv stop
```

That's it! You now have a full test environment for s3custom development.
