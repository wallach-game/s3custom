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

- **Host Agent** — Small Node.js service running directly on the host. Listens on a Unix socket and executes a whitelisted set of system commands (smartctl, hdparm, mdadm, lsblk, etc.). Runs as root via systemd.
- **Container App** — Express.js REST API + Web Components admin panel served from Docker. Connects to the host agent through the mounted Unix socket. The container does **not** need `--privileged` since all privileged operations go through the socket.

### Communication Protocol

The host agent uses newline-delimited JSON (NDJSON) over the Unix socket:

```
→  {"cmd": "lsblk", "args": ["-J", "-o", "NAME,SIZE,TYPE,MOUNTPOINT,MODEL"]}
←  {"ok": true, "stdout": "...", "stderr": ""}
```

Only whitelisted commands are accepted. Arguments are validated against shell injection patterns.

## Directory Structure

```
s3custom/
├── package.json              # Container app dependencies
├── tsconfig.json
├── Dockerfile                # Multi-stage build for the container
├── docker-compose.yml        # Container config with socket + volume mounts
├── host-agent/
│   ├── package.json
│   ├── tsconfig.json
│   ├── hostagent.service     # systemd unit file
│   └── src/
│       └── index.ts          # Unix socket server with command whitelist
└── src/
    ├── index.ts              # Express entry point
    ├── socket-client.ts      # NDJSON client for the host agent socket
    ├── routes/
    │   ├── disks.ts          # Disk, RAID, and power endpoints
    │   └── files.ts          # File CRUD endpoints
    ├── services/
    │   ├── disk.service.ts   # Disk listing, SMART status parsing
    │   ├── raid.service.ts   # RAID create/status/remove via mdadm
    │   ├── power.service.ts  # hdparm spin up/down, idle timeout
    │   └── file.service.ts   # File CRUD on /mnt/disks
    └── public/
        ├── index.html        # Admin panel shell
        ├── style.css         # Global styles
        ├── app.js            # API client + hash router
        ├── components/
        │   ├── disk-list.js
        │   ├── raid-manager.js
        │   ├── power-control.js
        │   └── file-manager.js
        └── shared/
            └── base-component.js
```

## Setup

### Prerequisites

- Node.js 20+
- Docker and Docker Compose (for the container app)
- Linux host with `smartctl`, `hdparm`, `mdadm`, `lsblk` installed

### 1. Install and Start the Host Agent

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
# Edit ExecStart path in the unit file if your install location differs
sudo systemctl daemon-reload
sudo systemctl enable --now hostagent
```

The agent creates a socket at `/var/run/hostagent.sock`.

### 2. Start the Container App

```bash
docker compose up -d
```

This will:
- Build the container image
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

## API Reference

### Disks

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/disks` | List all disks with SMART status |
| `GET` | `/api/disks/raid` | Get all RAID array statuses |
| `POST` | `/api/disks/raid` | Create a RAID array |
| `DELETE` | `/api/disks/raid/:device` | Stop and remove a RAID array |
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

#### `POST /api/disks/raid`

Create a new RAID array.

```json
{
  "level": "1",
  "devices": ["sdb", "sdc"]
}
```

Valid levels: `0`, `1`, `5`, `6`, `10`.

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
| `POST` | `/api/files` | Upload a file (multipart form) |
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
- **Path traversal prevention** — All file operations validate that resolved paths stay within `/mnt/disks`.
- **No auth** — The service assumes a trusted network. Add a reverse proxy with authentication if exposed beyond localhost.
- **No `--privileged`** — The Docker container runs unprivileged. All privileged operations are handled by the host agent.

## Configuration

Environment variables for the container:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `HOSTAGENT_SOCKET` | `/var/run/hostagent.sock` | Path to the host agent Unix socket |
| `FILES_ROOT` | `/mnt/disks` | Root directory for file operations |

## License

ISC
