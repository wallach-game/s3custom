#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/s3custom"
SERVICE_NAME="hostagent"
SOCKET_PATH="/var/run/hostagent.sock"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[x]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[*]${NC} $1"; }

# --- Pre-flight checks ---

if [ "$EUID" -ne 0 ]; then
  err "This script must be run as root (sudo ./install.sh)"
fi

command -v node >/dev/null 2>&1 || err "Node.js is required but not found. Install Node.js 20+ first."
command -v npm >/dev/null 2>&1  || err "npm is required but not found."
command -v docker >/dev/null 2>&1 || warn "Docker not found. Container app won't be available."

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  err "Node.js 18+ required (found v$(node -v))"
fi

NODE_BIN=$(which node)
info "Using Node.js at: $NODE_BIN ($(node -v))"

# --- Determine source directory ---

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$SCRIPT_DIR" = "$INSTALL_DIR" ]; then
  info "Already running from $INSTALL_DIR"
else
  log "Installing to $INSTALL_DIR..."
  mkdir -p "$INSTALL_DIR"
  rsync -a --exclude='node_modules' --exclude='dist' --exclude='.git' "$SCRIPT_DIR/" "$INSTALL_DIR/"
fi

# --- Build host agent ---

log "Building host agent..."
cd "$INSTALL_DIR/host-agent"
npm install --production=false 2>&1 | tail -1
npx tsc
log "Host agent built successfully."

# --- Build container app ---

log "Building container app..."
cd "$INSTALL_DIR"
npm install --production=false 2>&1 | tail -1
npx tsc
log "Container app built successfully."

# --- Install systemd service ---

log "Installing systemd service..."

cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=S3 Custom Host Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/env node ${INSTALL_DIR}/host-agent/dist/index.js
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:$(dirname "$NODE_BIN")
Restart=on-failure
RestartSec=5
User=root
Group=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

sleep 1
if systemctl is-active --quiet "$SERVICE_NAME"; then
  log "Host agent is running."
else
  warn "Host agent failed to start. Check: journalctl -u $SERVICE_NAME"
fi

# --- Create data directory ---

if [ ! -d /mnt/disks ]; then
  log "Creating /mnt/disks directory..."
  mkdir -p /mnt/disks
fi

# --- Docker setup ---

if command -v docker >/dev/null 2>&1; then
  log "Building Docker image..."
  cd "$INSTALL_DIR"

  if command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1; then
    docker compose down 2>/dev/null || true
    docker compose up -d --build
    log "Container app started on port 8080."
  else
    warn "docker compose not available. Building image only..."
    docker build -t s3custom .
    info "Run manually: docker run -d -p 8080:8080 -v /mnt/disks:/mnt/disks -v /var/run/hostagent.sock:/var/run/hostagent.sock s3custom"
  fi
else
  warn "Docker not installed. Skipping container build."
  info "You can run the app directly: cd $INSTALL_DIR && node dist/index.js"
fi

# --- Summary ---

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  S3 Custom installed successfully${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Install dir:    ${BLUE}$INSTALL_DIR${NC}"
echo -e "  Host agent:     ${BLUE}systemctl status $SERVICE_NAME${NC}"
echo -e "  Agent socket:   ${BLUE}$SOCKET_PATH${NC}"
echo -e "  Admin panel:    ${BLUE}http://localhost:8080${NC}"
echo -e "  Data directory: ${BLUE}/mnt/disks${NC}"
echo ""
echo -e "  Logs:           journalctl -u $SERVICE_NAME -f"
echo -e "  Restart agent:  systemctl restart $SERVICE_NAME"
echo -e "  Restart app:    cd $INSTALL_DIR && docker compose restart"
echo ""
