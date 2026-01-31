# S3 Custom - Project Context

## Architecture
Two-component system: Host Agent + Container App communicating over Unix socket (NDJSON protocol).

- **Host Agent** (`host-agent/`) — Node.js service running on host as root via systemd. Listens on `/var/run/hostagent.sock`. Executes whitelisted commands only: `lsblk`, `smartctl`, `hdparm`, `mdadm`, `df`, `mount`, `umount`, `fdisk`, `blkid`, `file`, `mkdir`, `ntfs-3g`, `ddrescue`.
- **Container App** (`src/`) — Express.js REST API + vanilla Web Components admin panel. Runs in Docker on port 8080. Connects to host agent via mounted socket. No `--privileged` needed.

## Key Paths
- Install dir: `/opt/s3custom` (symlinked from `/home/jirka/Documents/s3custom`)
- Socket: `/var/run/hostagent.sock` (chmod 660 - owner+group only)
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
- `GET /health` — health check endpoint (verifies host agent connectivity)
- `GET /api/disks` — list disks with SMART status
- `GET /api/disks/examine/:disk` — examine disk metadata (partitions, RAID, filesystem)
- `POST /api/disks/recover` — mount disk in read-only recovery mode
- `POST /api/disks/clone` — clone disk to image or another device
- `GET/POST/DELETE /api/disks/raid` — RAID management (mdadm)
- `POST /api/disks/power`, `GET /api/disks/power/:disk` — hdparm power control
- `GET/POST/PUT/DELETE /api/files` — file CRUD on /mnt/disks

**SMART Analytics & Life Expectancy (NEW):**
- `POST /api/disks/smart-history` — save SMART history entry (auto-tracking)
- `GET /api/disks/smart-history/:disk` — retrieve SMART history for graphing
- `GET /api/disks/life-expectancy/:disk` — calculate disk life expectancy prediction

**Disk Rotation Power Management (NEW):**
- `GET /api/disks/rotation/status` — get rotation state and schedule
- `POST /api/disks/rotation/enable` — enable rotation with optional config
- `POST /api/disks/rotation/disable` — disable rotation scheduler
- `PUT /api/disks/rotation/config` — update rotation settings
- `GET /api/disks/rotation/stats` — get rotation stats and disk states

## Security Model
- Command whitelist with arg validation (expanded dangerous character patterns: `;&|` ` $(){}*?[]<>\n\r'"\`)
- Input size limits (4096 bytes per arg, 20 args max) to prevent DoS
- `execFile` not `exec` — no shell interpretation
- Path traversal prevention in file service with symlink resolution (`fs.realpathSync`)
- Mount path validation in recovery service (whitelist pattern: `/mnt/recovery*`)
- Socket permissions hardened (0o660 - owner+group only)
- Error message sanitization (prevents information leakage)
- No auth (trusted network assumption)

## Known Issues / Notes
- `smartctl` and `hdparm` not installed on dev machine — SMART/power queries return errors but don't crash
- RAID functionality uses real `mdadm` on host block devices, not container-level
- File service strips leading slashes from user paths before `path.resolve` to avoid absolute path bypass
- Install script: `sudo ./install.sh` — handles host agent build, systemd setup, docker build

## Recent Improvements (2026-01-31)
**Security Hardening:**
- Socket permissions tightened from 0o666 to 0o660 (prevents unauthorized local access)
- Symlink resolution added to file service path validation (prevents symlink escape attacks)
- Dangerous character validation expanded from 8 to 16 patterns
- Input size limits enforced (4096 bytes/arg, 20 args max) to prevent DoS
- Mount path whitelist validation added to recovery service

**Reliability Enhancements:**
- Retry logic with exponential backoff added to socket client (3 attempts: 1s, 2s, 4s)
- Health check endpoint implemented for container orchestration
- Request timeout configured (30 minutes for long operations)
- Error logging improved across all 19 route handlers (full stack traces logged, generic messages returned)

**Files Modified:** 7 (host-agent/src/index.ts, src/services/file.service.ts, src/services/recovery.service.ts, src/socket-client.ts, src/index.ts, src/routes/disks.ts, src/routes/files.ts)

## New Features (2026-01-31 - Analytics & Rotation)

**Part 1: Disk Analytics & Life Expectancy Prediction**

*Backend Services:*
- `smart-history.service.ts` — stores historical SMART data in JSON files (data/smart-history/), max 1000 entries per disk
- `life-expectancy.service.ts` — calculates remaining disk lifetime based on:
  - Power-on hours vs typical 5-year lifespan (43,800 hours)
  - Reallocated sector count (critical indicator)
  - Current pending sector count
  - Temperature patterns (optimal: 35°C, max safe: 50°C, critical: 60°C)
  - Read/write error rates
  - Historical trend analysis (requires 10+ history entries for high confidence)
- Returns estimation with confidence level (high/medium/low) and detailed factor scores

*Frontend Component:*
- `disk-analytics.js` — comprehensive analytics dashboard with:
  - Disk age distribution bar chart
  - Temperature overview with color zones (green <40°C, yellow <50°C, red ≥50°C)
  - Power-on hours comparison
  - Health status pie chart
  - Per-disk detailed analysis (select from dropdown):
    - Life expectancy prediction with warnings
    - Factor score breakdown (power-on hours, reallocated sectors, temperature, error rate, trend)
    - Historical temperature and power-on hours trend charts
- All charts rendered with vanilla JavaScript canvas (no external libraries)

**Part 2: Intelligent Disk Rotation Power Management**

*Backend Service:*
- `disk-rotation.service.ts` — automated power rotation scheduler:
  - Detects when 3+ disks are connected
  - Configurable rotation interval (default: 4 hours)
  - Keeps 1 of every 3 disks active (configurable)
  - Round-robin rotation strategy to distribute wear evenly
  - Excludes system disks (those mounted outside /mnt/)
  - Tracks power state per disk and total power savings
  - Persists config and state to JSON files (data/rotation-config.json, data/rotation-state.json)
  - Auto-initializes on app startup if previously enabled

*Configuration Options:*
```json
{
  "enabled": true,
  "rotationIntervalMinutes": 240,
  "disksPerRotation": 1,
  "excludedDisks": ["sda"],
  "minIdleMinutesBeforeSpin": 5
}
```

*Frontend Component:*
- `disk-rotation.js` — rotation control panel with:
  - Toggle to enable/disable rotation
  - Slider for rotation interval (1-24 hours)
  - Disk exclusion configuration
  - Real-time rotation statistics (total managed, active, standby, power savings)
  - Next rotation countdown
  - Visual disk power state indicators (green pulse = active, gray = standby)
  - Rotation cycle timeline visualization

*Integration:*
- Disk list cards now show rotation status badges (Active/Standby) when rotation is enabled
- Navigation menu includes new "Analytics" and "Rotation" sections
- Activity logger tracks all rotation events

**Data Storage:**
- Historical SMART data: `data/smart-history/{disk}.json` (auto-created)
- Rotation config: `data/rotation-config.json`
- Rotation state: `data/rotation-state.json`

**Usage Notes:**
- SMART history must be manually populated by periodically calling `POST /api/disks/smart-history`
- Life expectancy calculations require SMART data (smartctl must be installed on host)
- Rotation service uses hdparm commands (requires hdparm installed and root access via host agent)
- Rotation respects RAID member disks and system disks automatically
- Power savings are calculated based on standby time accumulation

**Files Added:** 5 new files
- Backend: `src/services/smart-history.service.ts`, `src/services/life-expectancy.service.ts`, `src/services/disk-rotation.service.ts`
- Frontend: `src/public/components/disk-analytics.js`, `src/public/components/disk-rotation.js`

**Files Modified:** 4 files
- `src/index.ts` — added rotation service initialization
- `src/routes/disks.ts` — added 8 new API endpoints
- `src/public/index.html` — added navigation links and component imports
- `src/public/app.js` — added routes for analytics and rotation
- `src/public/components/disk-list.js` — added rotation status badges

See `IMPLEMENTATION_SUMMARY.md` and `CHANGES_QUICK_REFERENCE.md` for detailed implementation notes.
