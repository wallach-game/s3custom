# S3 Custom - Project Context

## Architecture
Two-component system: Host Agent + Container App communicating over Unix socket (NDJSON protocol).

- **Host Agent** (`host-agent/`) — Node.js service running on host as root via systemd. Listens on `/var/run/hostagent.sock`. Executes whitelisted commands only: `lsblk`, `smartctl`, `hdparm`, `mdadm`, `df`, `mount`, `umount`, `fdisk`, `blkid`, `file`, `mkdir`, `ntfs-3g`, `ddrescue`.
- **Container App** (`src/`) — Express.js REST API + vanilla Web Components admin panel. Runs in Docker on port 8080. Connects to host agent via mounted socket. No `--privileged` needed.

## Key Paths
- Install dir: `/opt/s3custom` (symlinked from `/home/jirka/Documents/s3custom`)
- Socket: `/var/run/hostagent.sock` (chmod 666)
- Data: `/mnt/disks` (mounted into container)
- Systemd service: `hostagent` (`/etc/systemd/system/hostagent.service`)

## Build Commands
```bash
# Host agent
cd host-agent && npm install && npm run build

# Container app
npm install && npm run build

# Docker
docker compose up -d --build
```

## Node.js Path
Node is installed via mise at `/home/jirka/.local/share/mise/installs/node/25.2.1/bin/node`. The systemd service uses `/usr/bin/env node` with PATH including the mise bin dir.

## Tech Stack
- TypeScript (ES2022, commonjs) for backend
- Express.js with multer for file uploads
- Vanilla Web Components with Shadow DOM for frontend (no build step)
- NDJSON over Unix socket for host agent protocol

## API Routes
- `GET /api/disks` — list disks with SMART status
- `GET /api/disks/examine/:disk` — examine disk metadata (partitions, RAID, filesystem)
- `POST /api/disks/recover` — mount disk in read-only recovery mode
- `POST /api/disks/clone` — clone disk to image or another device
- `GET/POST/DELETE /api/disks/raid` — RAID management (mdadm)
- `POST /api/disks/power`, `GET /api/disks/power/:disk` — hdparm power control
- `GET/POST/PUT/DELETE /api/files` — file CRUD on /mnt/disks

## Security Model
- Command whitelist with arg validation (no shell metacharacters)
- `execFile` not `exec` — no shell interpretation
- Path traversal prevention in file service (all paths resolved relative to FILES_ROOT)
- No auth (trusted network assumption)

## Known Issues / Notes
- `smartctl` and `hdparm` not installed on dev machine — SMART/power queries return errors but don't crash
- RAID functionality uses real `mdadm` on host block devices, not container-level
- File service strips leading slashes from user paths before `path.resolve` to avoid absolute path bypass
- Install script: `sudo ./install.sh` — handles host agent build, systemd setup, docker build
