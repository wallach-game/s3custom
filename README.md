# S3 Custom

A self-hosted storage administration platform for managing disks, RAID arrays, power settings, and files through a web-based admin panel.

## Architecture

The system consists of two components:

```
┌──────────────────────────────┐      Unix Socket       ┌──────────────────────┐
│  Container (Docker)          │  ◄──────────────────►   │  Host Agent          │
│                              │  /var/run/hostagent.sock│                      │
│  Express API  ←→  Web UI     │                         │  Executes:           │
│  File ops on /mnt/disks      │                         │  lsblk, smartctl,    │
│  Port 8080                   │                         │  hdparm, mdadm,      │
│                              │                         │  df, mount, umount   │
└──────────────────────────────┘                         └──────────────────────┘
```

- **Host Agent** — Small Node.js service running directly on the host. Listens on a Unix socket and executes a whitelisted set of system commands (smartctl, hdparm, mdadm, lsblk, fdisk, blkid, file, mkdir, ntfs-3g, ddrescue, etc.). Runs as root via systemd.
- **Container App** — Express.js REST API + Web Components admin panel served from Docker. Connects to the host agent through the mounted Unix socket. The container does **not** need `--privileged` since all privileged operations go through the socket.

### Communication Protocol

The host agent uses newline-delimited JSON (NDJSON) over the Unix socket:

```
→  {"cmd": "lsblk", "args": ["-J", "-o", "NAME,SIZE,TYPE,MOUNTPOINT,MODEL"]}
←  {"ok": true, "stdout": "...", "stderr": ""}
```

Only whitelisted commands are accepted. Arguments are validated against shell injection patterns.

## Quick Install

```bash
sudo ./install.sh
```

The install script handles everything:
- Builds the host agent and container app
- Installs and starts the systemd service
- Detects your Node.js path automatically
- Creates `/mnt/disks` if missing
- Builds and starts the Docker container

After install, open **http://localhost:8080**.

## Directory Structure

```
s3custom/
├── package.json              # Container app dependencies
├── tsconfig.json
├── Dockerfile                # Multi-stage build for the container
├── docker-compose.yml        # Container config with socket + volume mounts
├── install.sh                # Automated installation script
├── host-agent/
│   ├── package.json
│   ├── tsconfig.json
│   ├── hostagent.service     # systemd unit template
│   └── src/
│       └── index.ts          # Unix socket server with command whitelist
└── src/
    ├── index.ts              # Express entry point
    ├── socket-client.ts      # NDJSON client for the host agent socket
    ├── routes/
    │   ├── disks.ts          # Disk, RAID, and power endpoints
    │   └── files.ts          # File CRUD endpoints
    ├── services/
    │   ├── disk.service.ts   # Disk listing, SMART status parsing, speed testing
    │   ├── raid.service.ts   # RAID create/status/remove/manage via mdadm
    │   ├── power.service.ts  # hdparm spin up/down, idle timeout
    │   ├── file.service.ts   # File CRUD on /mnt/disks
    │   ├── logging.service.ts # Centralized logging utility
    │   └── anomaly.service.ts # Disk performance anomaly detection
    └── public/
        ├── index.html        # Admin panel shell
        ├── style.css         # Global styles
        ├── app.js            # API client + hash router
        ├── components/
        │   ├── disk-list.js      # Disk overview with SMART stats
        │   ├── raid-manager.js   # RAID array creation/status
        │   ├── power-control.js  # Disk power management
        │   └── file-manager.js   # File browser with upload/delete
        └── shared/
            └── base-component.js # Web Component base class
```

## Manual Setup

If you prefer to set things up step by step instead of using `install.sh`:

### Prerequisites

- Node.js 18+
- Docker and Docker Compose (for the container app)
- Linux host with `smartctl`, `hdparm`, `mdadm`, `lsblk` installed

### 1. Build and Start the Host Agent

```bash
cd host-agent
npm install
npm run build
```

**Option A — Run directly:**

```bash
sudo node dist/index.js
```

**Option B — Install as a systemd service:**

```bash
sudo cp hostagent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hostagent
```

The agent creates a socket at `/var/run/hostagent.sock`.

> **Note:** The systemd service file expects Node.js at a standard path. If you use a version manager (nvm, mise, fnm), the install script handles this automatically. For manual setup, edit the `ExecStart` and `Environment=PATH` lines in the service file.

### 2. Start the Container App

```bash
docker compose up -d --build
```

This will:
- Build the container image (Node 20 Alpine, multi-stage)
- Mount `/mnt/disks` for file operations
- Mount `/var/run/hostagent.sock` for disk commands
- Expose the admin panel on port **8080**

Open **http://localhost:8080** to access the admin panel.

### Development (without Docker)

```bash
npm install
npm run build
node dist/index.js
```

Or with ts-node:

```bash
npm run dev
```

## Admin Panel

The web UI is built with vanilla Web Components (no framework, no build step). Four sections accessible from the sidebar:

- **Disks** — Overview of all block devices with SMART health status, temperature, and power-on hours. Now includes a disk speed test with anomaly detection for individual disks.
- **RAID** — View active mdadm arrays, create new arrays by selecting a RAID level and member devices. You can now also fail, remove, and add individual disks to existing RAID arrays, or clone a single disk to a new RAID 1 array.
- **Power** — Per-disk power state monitoring, spin down/wake controls, and configurable idle timeouts via hdparm.
- **Files** — Directory browser for `/mnt/disks` with breadcrumb navigation, file upload, folder creation, and delete.

The sidebar footer shows a live connection indicator for the host agent.

## API Reference

### Disks

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/disks` | List all disks with SMART status |
| `GET` | `/api/disks/examine/:disk` | Examine disk for partitions, RAID metadata, and filesystem types |
| `POST` | `/api/disks/recover` | Mount a disk in read-only recovery mode |
| `POST` | `/api/disks/clone` | Clone a disk to an image file or another device |
| `GET` | `/api/disks/:disk/speed` | Test disk read speed and check for anomalies |
| `GET` | `/api/disks/raid` | Get all RAID array statuses |
| `POST` | `/api/disks/raid` | Create a RAID array |
| `POST` | `/api/disks/raid/clone` | Clone a disk to a new degraded RAID 1 array |
| `DELETE` | `/api/disks/raid/:device` | Stop and remove a RAID array |
| `POST` | `/api/disks/raid/:device/fail` | Mark a disk as faulty in a RAID array |
| `POST` | `/api/disks/raid/:device/remove` | Remove a disk from a RAID array |
| `POST` | `/api/disks/raid/:device/add` | Add a disk (e.g., a spare) to a RAID array |
| `POST` | `/api/disks/power` | Control disk power (spin up/down/timeout) |
| `GET` | `/api/disks/power/:disk` | Get disk power state |

#### `GET /api/disks`

Returns an array of disks with SMART health data.

```json
[
  {
    "name": "sda",
    "size": "1.8T",
    "type": "disk",
    "mountpoint": null,
    "model": "WDC WD2003FZEX",
    "smart": {
      "healthy": true,
      "temperature": 34,
      "powerOnHours": 12450
    }
  }
]
```

#### `GET /api/disks/:disk/speed`

Tests the read speed of a disk and returns the result, including if an anomaly was detected.

```json
{
  "disk": "sda",
  "speed": 123.45,
  "isAnomaly": false
}
```

#### `POST /api/disks/raid`

Create a new RAID array.

```json
{
  "level": "1",
  "devices": ["sdb", "sdc"]
}
```

Valid levels: `0`, `1`, `5`, `6`, `10`.

#### `POST /api/disks/raid/clone`

Clones an existing disk to a new degraded RAID 1 array. The original disk's data is preserved.

```json
{
  "disk": "sdb"
}
```

#### `POST /api/disks/raid/:device/fail`

Marks a specified disk as faulty within a RAID array.

```json
{
  "disk": "sdc"
}
```

#### `POST /api/disks/raid/:device/remove`

Removes a specified disk from a RAID array.

```json
{
  "disk": "sdc"
}
```

#### `POST /api/disks/raid/:device/add`

Adds a specified disk (e.g., a spare) to a RAID array.

```json
{
  "disk": "sde"
}
```

#### `POST /api/disks/power`

```json
{
  "disk": "sda",
  "action": "spindown"
}
```

Actions: `spindown`, `spinup`, `timeout` (requires `value` in seconds).
### Files

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/files?path=/` | List directory contents |
| `POST` | `/api/files` | Upload a file (multipart form, max 100MB) |
| `POST` | `/api/files/mkdir` | Create a directory |
| `PUT` | `/api/files` | Update file content |
| `DELETE` | `/api/files?path=/somefile` | Delete a file or directory |

#### `GET /api/files?path=/`

```json
[
  {
    "name": "backups",
    "path": "/backups",
    "isDirectory": true,
    "size": 4096,
    "modified": "2025-03-15T10:30:00.000Z"
  }
]
```

#### `POST /api/files` (upload)

Multipart form with fields:
- `file` — the file to upload
- `path` — destination directory (default `/`)

#### `PUT /api/files` (update)

```json
{
  "path": "/notes.txt",
  "content": "updated content"
}
```

All file paths are resolved relative to `/mnt/disks` and validated against path traversal.

## Security

- **Command whitelist** — The host agent only executes `lsblk`, `smartctl`, `hdparm`, `mdadm`, `df`, `mount`, and `umount`. All other commands are rejected.
- **Argument validation** — Arguments containing shell metacharacters (`;`, `&`, `|`, `` ` ``, `$`, `(`, `)`, `{`, `}`) are rejected.
- **execFile** — Commands are executed with `execFile` (not `exec`), preventing shell interpretation.
- **Path traversal prevention** — All file operations validate that resolved paths stay within `/mnt/disks`. Leading slashes are stripped from user input before resolution.
- **No auth** — The service assumes a trusted network. Add a reverse proxy with authentication if exposed beyond localhost.
- **No `--privileged`** — The Docker container runs unprivileged. All privileged operations are handled by the host agent.
- **Socket permissions** — The Unix socket is created with mode `0666` for container access. Restrict as needed for your environment.
- **Request timeout** — All host agent commands have a 30-second execution timeout.

## Configuration

Environment variables for the container:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `HOSTAGENT_SOCKET` | `/var/run/hostagent.sock` | Path to the host agent Unix socket |
| `FILES_ROOT` | `/mnt/disks` | Root directory for file operations |

The host agent also accepts `HOSTAGENT_SOCKET` to override its listen path.

## Management

```bash
# Host agent
sudo systemctl status hostagent
sudo systemctl restart hostagent
journalctl -u hostagent -f

# Container app
docker compose logs -f
docker compose restart
docker compose down && docker compose up -d --build
```

## License

ISC
