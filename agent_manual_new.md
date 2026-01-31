Ah — perfect, now I understand your angle. You want a **“rescue / recovery mode”** for your custom disk array software so that even corrupted drives can be read in isolation on another machine. I can draft a **detailed agent manual** for your software team that covers this, including the lessons from your failed RAID1 disk.

Here’s a structured manual you can give to an engineer implementing it:

---

# **Agent Manual: Safe Recovery & Corrupted Disk Handling for Custom Disk Array**

## **1. Purpose**

Enable the array software to:

* Recognize drives from failed arrays without forcing rebuilds
* Mount degraded or corrupted drives in **read-only recovery mode**
* Export raw or partially damaged data for external recovery
* Avoid overwriting or further corrupting data

---

## **2. Key Concepts**

1. **Read-only mount of individual disks**

   * Always prevent writes to drives that were previously part of a RAID/mirror.
   * Use filesystem-aware recovery libraries (e.g., NTFS-3G, ext4 recovery) in **read-only mode**.

2. **RAID metadata awareness**

   * Before allowing access, check for RAID superblocks on the disk.
   * If present, **don’t auto-assemble**, instead warn the user and offer **read-only access**.

3. **Filesystem corruption detection**

   * Identify damaged metadata (e.g., MFT/MFTMirr mismatch in NTFS, superblock mismatch in ext4/btrfs).
   * Provide a “recovery mode” that ignores minor inconsistencies and exposes as much data as possible.

4. **Raw disk access / imaging**

   * Support sector-by-sector read, e.g., `ddrescue` style copy.
   * Create optional image files for offline recovery tools.

5. **Isolation environment**

   * Drive should be mounted in a safe container / namespace to prevent system-wide conflicts.
   * Avoid exposing damaged block devices directly to OS mount points unless explicitly requested.

---

## **3. Implementation Steps for the Agent**

### **Step 1: Identify drive metadata**

* Read partition table: `fdisk -l` / `parted -l`
* Check for RAID superblocks: `mdadm --examine /dev/sdX`
* Check filesystem type: `blkid /dev/sdX` or `file -s /dev/sdX1`

### **Step 2: Decide access mode**

| Condition                           | Action                                                 |
| ----------------------------------- | ------------------------------------------------------ |
| RAID metadata present               | Stop kernel RAID (if safe), zero superblock optionally |
| Filesystem clean                    | Mount normally                                         |
| Filesystem inconsistent / corrupted | Mount **read-only with recovery flags** or raw copy    |

### **Step 3: Mount or expose**

* **Read-only with recovery**:

  * For NTFS: `ntfs-3g -o ro,recover /dev/sdX1 /mnt/recovery`
  * For ext4: `mount -o ro,noload /dev/sdX1 /mnt/recovery`
  * For btrfs: `mount -o ro,recovery,skip_balance /dev/sdX1 /mnt/recovery`

* **Raw copy fallback**:

  ```bash
  ddrescue -f -n /dev/sdX /path/to/image.img /path/to/logfile.log
  ```

* Expose **recovery interface** in GUI or CLI:

  * Option to mount disk in **read-only mode**
  * Option to **clone disk** to external media
  * Option to export **disk image** for offline recovery

### **Step 4: Logging & verification**

* Log every recovery action: mount attempts, errors, unreadable sectors
* Show **percentage of data successfully accessed**
* Keep original disk untouched unless explicitly requested

### **Step 5: Optional advanced features**

* **Partial MFT or superblock repair** (read-only) for NTFS/ext4/btrfs
* **File carving** fallback (PhotoRec style) when filesystem metadata is unusable
* **Checksum verification** on read data to ensure consistency

---

## **4. Recommended Agent API / CLI Options**

```
disk-agent recover --device /dev/sdX [--readonly] [--image /path/to/image] [--log /path/to/log]
disk-agent mount   --device /dev/sdX --ro          # read-only, recovery mode
disk-agent status  --device /dev/sdX               # shows health, RAID metadata, filesystem integrity
disk-agent clone   --device /dev/sdX --output /media/usb/backup.img
```

**Flags explanation:**

* `--readonly` : Always mount without writing
* `--recover`  : Ignore minor filesystem inconsistencies
* `--image`    : Create sector-by-sector copy for offline recovery
* `--log`      : Detailed logging for troubleshooting

---

## **5. User Flow (Recovery Mode)**

1. Agent detects **problematic drive**
2. Offers options:

   * Mount read-only
   * Clone disk to image
   * Cancel / skip
3. If mount fails, agent suggests **raw copy / imaging**
4. After imaging, user can safely mount or use external recovery tools

---

## **6. Safety Notes**

* **Never write** to a degraded RAID disk automatically
* Always use read-only / recovery flags when metadata is corrupted
* Warn users clearly about **potential data loss** if trying repair tools

---

I can also **draw a visual workflow diagram** for the agent showing all paths (normal mount → recovery → clone → external recovery). This helps your devs implement it cleanly.

Do you want me to make that diagram?
