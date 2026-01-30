# S3 Custom — Host Agent

The host agent is a small Node.js service that runs directly on the host machine (not in a container). It listens on a Unix socket and executes a limited set of whitelisted system commands on behalf of the containerized application.

## Why a Host Agent?

Disk management commands like `smartctl`, `hdparm`, and `mdadm` require root-level access to block devices. Rather than running the entire application container as `--privileged`, the host agent isolates privilege to a single auditable process.

## Whitelisted Commands

| Command | Binary Path | Purpose |
|---------|------------|---------|
| `lsblk` | `/usr/bin/lsblk` | List block devices |
| `smartctl` | `/usr/sbin/smartctl` | SMART disk health data |
| `hdparm` | `/usr/sbin/hdparm` | Disk power management |
| `mdadm` | `/usr/sbin/mdadm` | RAID array management |
| `df` | `/usr/bin/df` | Disk usage |
| `mount` | `/usr/bin/mount` | Mount filesystems |
| `umount` | `/usr/bin/umount` | Unmount filesystems |

Any command not in this list is rejected.

## Protocol

Communication uses newline-delimited JSON (NDJSON) over the Unix socket at `/var/run/hostagent.sock`.

**Request:**
```json
{"cmd": "lsblk", "args": ["-J", "-o", "NAME,SIZE,TYPE"]}
```

**Success response:**
```json
{"ok": true, "stdout": "...", "stderr": ""}
```

**Error response:**
```json
{"ok": false, "error": "Command not whitelisted: rm"}
```

## Installation

```bash
npm install
npm run build
```

### Running with systemd

```bash
sudo cp hostagent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hostagent
```

Check status:
```bash
sudo systemctl status hostagent
journalctl -u hostagent -f
```

### Running manually

```bash
sudo node dist/index.js
```

## Security Notes

- Uses `execFile` instead of `exec` to prevent shell injection
- Arguments are validated against shell metacharacters (`;`, `&`, `|`, `` ` ``, `$`, etc.)
- The socket is created with mode `0660`
- Runs as root (required for disk management commands)
- 30-second timeout on all command executions
