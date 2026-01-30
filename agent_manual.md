Perfect — we can design a **full manual/spec for a “Host Agent” system** that meets all your requirements. I’ll outline it in a clear structure so a developer can implement it. This will include architecture, endpoints, disk control features, RAID, UNIX socket communication, and admin panel design.

---

# **Host Agent Manual – Node.js/TypeScript Docker Container**

### **1. Overview**

The Host Agent is a **Dockerized Node.js/TypeScript application** that provides:

* CRUD operations on files.
* Full **disk management**: list disks, mount points, SMART status, disk health.
* **Software RAID management**: RAID 0, 1, 10.
* Disk power control: spin up/down, set timeouts.
* Communication with host OS through **mounted volumes** and **Unix socket**.
* Admin web interface to view disks and manage storage.
* Example scripts to extend functionality.

---

### **2. Architecture**

```
[Host OS]
   ├─ Physical disks (/dev/sd*)
   ├─ Mounted folders for container (e.g., /mnt/disks/*)
   └─ Unix socket: /var/run/hostagent.sock

[Docker Container]
   ├─ Node.js/TypeScript Host Agent
   │   ├─ REST API for admin panel
   │   ├─ UNIX socket communication with host
   │   └─ Disk controller module
   └─ Admin panel (React or similar)
```

* Disks are exposed to the container as **mounted folders**.
* Container talks to host system through **Unix socket** using **Node.js `net` module**.
* Admin page uses REST endpoints served by the container.

---

### **3. Docker Setup**

```yaml
version: "3.9"
services:
  host-agent:
    image: host-agent:latest
    container_name: host-agent
    privileged: true           # needed for disk commands, RAID, smartctl
    volumes:
      - /mnt/disks:/mnt/disks  # expose disks to container
      - /var/run/hostagent.sock:/var/run/hostagent.sock
      - /etc/host-agent/config:/app/config
    ports:
      - "8080:8080"            # Admin web UI
    restart: unless-stopped
```

**Notes:**

* `privileged` is required to run commands like `smartctl`, `hdparm`, `mdadm`.
* Unix socket allows **host-level script execution** securely.

---

### **4. Unix Socket Communication**

**Host side:** agent runs as a system service or within container to execute commands.

```typescript
// socket-server.ts
import net from "net";
import { exec } from "child_process";

const SOCKET_PATH = "/var/run/hostagent.sock";

// Remove existing socket
import fs from "fs";
if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH);

const server = net.createServer((connection) => {
  connection.on("data", (data) => {
    const command = data.toString().trim();
    // Example: execute command safely
    exec(command, (err, stdout, stderr) => {
      connection.write(JSON.stringify({ err, stdout, stderr }));
    });
  });
});

server.listen(SOCKET_PATH, () => console.log("Host agent socket running"));
```

**Container side:** client sends commands:

```typescript
import net from "net";

function sendCommand(command: string) {
  return new Promise((resolve) => {
    const client = net.createConnection("/var/run/hostagent.sock", () => {
      client.write(command);
    });

    client.on("data", (data) => {
      resolve(JSON.parse(data.toString()));
      client.end();
    });
  });
}
```

---

### **5. Disk Management Module**

**Endpoints:**

* `GET /disks` – list all physical disks (mount point, size, model, SMART health)
* `POST /disks/raid` – create RAID (RAID 0,1,10)
* `POST /disks/power` – turn HDD on/off, set idle timeout
* `POST /files` – create/upload file
* `GET /files` – list files
* `PUT /files/:id` – update file
* `DELETE /files/:id` – delete file

**Example Node.js code for disks:**

```typescript
import { execSync } from "child_process";

function listDisks() {
  const raw = execSync("lsblk -J -o NAME,SIZE,TYPE,MOUNTPOINT,MODEL").toString();
  return JSON.parse(raw).blockdevices.filter((d: any) => d.type === "disk");
}

function getSMARTStatus(disk: string) {
  try {
    const output = execSync(`smartctl -H /dev/${disk}`).toString();
    return output.includes("PASSED") ? "Healthy" : "Warning";
  } catch {
    return "Unknown";
  }
}
```

---

### **6. RAID Management**

* Use **`mdadm`** for software RAID.
* Example commands:

```bash
# Create RAID1
mdadm --create --verbose /dev/md0 --level=1 --raid-devices=2 /dev/sdb /dev/sdc

# Create RAID0
mdadm --create --verbose /dev/md1 --level=0 --raid-devices=2 /dev/sdd /dev/sde

# Create RAID10
mdadm --create --verbose /dev/md10 --level=10 --raid-devices=4 /dev/sdf /dev/sdg /dev/sdh /dev/sdi
```

* Container calls these commands via **Unix socket**, not directly in container shell.

---

### **7. Disk Power Control**

* Using **`hdparm`**:

```bash
# Turn off disk
hdparm -Y /dev/sdb

# Set idle timeout (seconds)
hdparm -S 120 /dev/sdb  # 10 minutes
```

* Container triggers via socket API.

---

### **8. Admin Web Page**

* Built with React or Vue inside the container.
* Connects to container REST API.
* Features:

  * Disk list (name, model, mount point, SMART health)
  * RAID management buttons
  * File CRUD interface
  * Disk power management controls
* Periodic refresh of disk stats via `/disks` endpoint.

---

### **9. Example Usage Flow**

1. **List disks**: container calls `sendCommand("lsblk -J -o NAME,SIZE,TYPE,MOUNTPOINT,MODEL")`
2. **Get SMART status**: `sendCommand("smartctl -H /dev/sdb")`
3. **Create RAID**: `sendCommand("mdadm --create --verbose /dev/md0 --level=1 --raid-devices=2 /dev/sdb /dev/sdc")`
4. **Turn off disk**: `sendCommand("hdparm -Y /dev/sdb")`
5. **Manage files**: container writes directly to `/mnt/disks` mounted from host.

---

### **10. Security Notes**

* **Unix socket + agent pattern** is safer than `--privileged` container exec.
* Validate all commands in agent to **prevent arbitrary code execution**.
* Limit socket access to the container only.
* Consider adding **authentication** for admin panel API.

---

If you want, I can **also prepare a full working Docker+Node.js/TypeScript template**, including:

* REST API endpoints
* React admin panel
* Unix socket integration
* RAID and disk power scripts

This would let you **run the container and immediately manage host disks**.

Do you want me to create that template?
