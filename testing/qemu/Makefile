# Makefile for QEMU test environment management

.PHONY: help setup start stop status deploy tunnel ssh clean reset \
        create-disks snapshot-list snapshot-create snapshot-restore \
        test test-list full install

# Default target
help:
	@echo "S3 Custom QEMU Test Environment"
	@echo ""
	@echo "Quick Start:"
	@echo "  make install     - Install and setup everything (first time)"
	@echo "  make start       - Start the VM"
	@echo "  make tunnel      - Setup SSH tunnel"
	@echo "  make stop        - Stop the VM"
	@echo ""
	@echo "Targets:"
	@echo "  setup            - Create and install VM"
	@echo "  start            - Start the test VM"
	@echo "  stop             - Stop the test VM"
	@echo "  status           - Show VM and tunnel status"
	@echo "  deploy           - Deploy host-agent to VM"
	@echo "  tunnel           - Setup SSH tunnel for socket"
	@echo "  ssh              - SSH into the VM"
	@echo "  reset            - Reset to clean snapshot"
	@echo "  clean            - Stop everything and cleanup"
	@echo ""
	@echo "Disk Management:"
	@echo "  create-disks     - Create virtual test disks"
	@echo "  snapshot-list    - List all snapshots"
	@echo "  snapshot-create NAME=<name>"
	@echo "                   - Create a snapshot"
	@echo "  snapshot-restore NAME=<name>"
	@echo "                   - Restore a snapshot"
	@echo ""
	@echo "Testing:"
	@echo "  test-list        - List available test scenarios"
	@echo "  test TEST=<name> - Run a test scenario"
	@echo ""
	@echo "Examples:"
	@echo "  make install"
	@echo "  make snapshot-create NAME=clean-install"
	@echo "  make test TEST=raid-create"
	@echo "  make reset"

# Install everything (first time setup)
install: full

# Full setup
full:
	@echo "Starting full setup..."
	@./testenv full

# Setup VM
setup:
	@./testenv setup

# Create virtual disks
create-disks:
	@./testenv create-disks

# Start VM
start:
	@./testenv start

# Stop VM
stop:
	@./testenv stop

# Show status
status:
	@./testenv status

# Deploy host-agent
deploy:
	@./testenv deploy

# Setup tunnel
tunnel:
	@./testenv tunnel

# SSH into VM
ssh:
	@./testenv ssh

# Clean shutdown
clean:
	@./testenv clean

# Reset to clean state
reset:
	@./testenv reset

# Snapshot management
snapshot-list:
	@./testenv snapshot list

snapshot-create:
ifndef NAME
	@echo "Error: NAME not specified"
	@echo "Usage: make snapshot-create NAME=<snapshot-name>"
	@exit 1
endif
	@./testenv stop
	@./testenv snapshot create $(NAME)
	@./testenv start

snapshot-restore:
ifndef NAME
	@echo "Error: NAME not specified"
	@echo "Usage: make snapshot-restore NAME=<snapshot-name>"
	@exit 1
endif
	@./testenv stop
	@./testenv snapshot restore $(NAME)
	@./testenv start

# Test scenarios
test-list:
	@./testenv test-list

test:
ifndef TEST
	@echo "Error: TEST not specified"
	@echo "Usage: make test TEST=<scenario-name>"
	@echo ""
	@./testenv test-list
	@exit 1
endif
	@./testenv test $(TEST)

# Quick test sequence
test-all:
	@echo "Running all test scenarios..."
	@./testenv test raid-create
	@echo ""
	@echo "Waiting 5 seconds..."
	@sleep 5
	@./testenv test raid-recovery
	@echo ""
	@echo "Waiting 5 seconds..."
	@sleep 5
	@./testenv test disk-power
	@echo ""
	@echo "Waiting 5 seconds..."
	@sleep 5
	@./testenv test disk-smart
	@echo ""
	@echo "All tests complete!"

# Development workflow helpers
dev-start: start tunnel
	@echo "Development environment ready!"
	@echo "Access VM: make ssh"
	@echo "Socket: /tmp/hostagent-test.sock"

dev-restart: stop start tunnel
	@echo "Development environment restarted!"

dev-clean: clean
	@echo "Development environment stopped"
