import { sendCommand } from "../socket-client";
import { log, LogLevel } from "./logging.service";
import { checkSpeedAnomaly } from "./anomaly.service";

export interface DiskInfo {
  name: string;
  size: string;
  type: string;
  mountpoint: string | null;
  model: string | null;
  smart?: SmartStatus;
}

export interface SmartStatus {
  healthy: boolean;
  temperature?: number;
  powerOnHours?: number;
  raw: string;
}

// New interfaces for disk examination
export interface PartitionInfo {
  name: string;
  size: string;
  fstype: string | null;
  mountpoint: string | null;
}

export interface RaidInfo {
  isRaid: boolean;
  metadata: string | null; // Raw output from mdadm --examine
}

export interface FilesystemInfo {
  type: string | null;
  label: string | null;
  uuid: string | null;
}

export interface DiskExaminationResult {
  disk: string;
  exists: boolean;
  partitions: PartitionInfo[];
  raidInfo: RaidInfo;
  filesystemInfo: FilesystemInfo | null; // For the entire disk, if applicable
  rawLsblk: string;
  rawMdadmExamine: string;
  rawBlkid: string;
}


export async function listDisks(): Promise<DiskInfo[]> {
  const { stdout } = await sendCommand("lsblk", [
    "-J",
    "-o",
    "NAME,SIZE,TYPE,MOUNTPOINT,MODEL",
  ]);

  const data = JSON.parse(stdout);
  const disks: DiskInfo[] = [];

  for (const dev of data.blockdevices || []) {
    if (dev.type === "disk") {
      disks.push({
        name: dev.name,
        size: dev.size,
        type: dev.type,
        mountpoint: dev.mountpoint || null,
        model: dev.model || null,
      });
    }
  }

  return disks;
}

export async function getSmartStatus(disk: string): Promise<SmartStatus> {
  const devicePath = disk.startsWith("/dev/") ? disk : `/dev/${disk}`;

  try {
    const { stdout } = await sendCommand("smartctl", [
      "-H",
      "-A",
      "-i",
      devicePath,
    ]);

    const healthy = /SMART overall-health.*(PASSED|OK)/i.test(stdout);

    const tempMatch = stdout.match(/Temperature_Celsius.*?(\d+)/m);
    const temperature = tempMatch ? parseInt(tempMatch[1], 10) : undefined;

    const hoursMatch = stdout.match(/Power_On_Hours.*?(\d+)/m);
    const powerOnHours = hoursMatch ? parseInt(hoursMatch[1], 10) : undefined;

    return { healthy, temperature, powerOnHours, raw: stdout };
  } catch (err: any) {
    return { healthy: false, raw: err.stdout || err.message };
  }
}

export async function listDisksWithSmart(): Promise<DiskInfo[]> {
  const disks = await listDisks();

  const results = await Promise.allSettled(
    disks.map(async (disk) => {
      disk.smart = await getSmartStatus(disk.name);
      return disk;
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<DiskInfo> => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function getDiskSpeed(disk: string): Promise<{ speed: number; isAnomaly: boolean }> {
  const devicePath = disk.startsWith("/dev/") ? disk : `/dev/${disk}`;

  const { stdout } = await sendCommand("hdparm", ["-t", devicePath]);

  const match = stdout.match(/=\s*([\d.]+)\s*MB\/sec/);
  if (!match) {
    throw new Error(`Could not parse disk speed from hdparm output: ${stdout}`);
  }

  const speed = parseFloat(match[1]);

  log(LogLevel.INFO, `Disk speed test for ${disk}`, { speed_mbs: speed });

  const isAnomaly = checkSpeedAnomaly(disk, speed);

  return { speed, isAnomaly };
}

// New function to examine disk metadata
export async function examineDisk(disk: string): Promise<DiskExaminationResult> {
  const devicePath = disk.startsWith("/dev/") ? disk : `/dev/${disk}`;
  let rawLsblk = "";
  let rawMdadmExamine = "";
  let rawBlkid = "";
  const partitions: PartitionInfo[] = [];
  let filesystemInfo: FilesystemInfo | null = null;
  let raidInfo: RaidInfo = { isRaid: false, metadata: null };

  try {
    // 1. Get partition table and filesystem types using lsblk
    const { stdout: lsblkOutput } = await sendCommand("lsblk", [
      "-J",
      "-o",
      "NAME,SIZE,FSTYPE,MOUNTPOINT",
      devicePath,
    ]);
    rawLsblk = lsblkOutput;
    const lsblkData = JSON.parse(lsblkOutput);

    if (lsblkData.blockdevices && lsblkData.blockdevices.length > 0) {
      const mainDisk = lsblkData.blockdevices[0];
      if (mainDisk.children) {
        for (const child of mainDisk.children) {
          partitions.push({
            name: child.name,
            size: child.size,
            fstype: child.fstype || null,
            mountpoint: child.mountpoint || null,
          });
        }
      }
      // Check filesystem for the main disk itself, if it's not partitioned
      if (mainDisk.fstype && partitions.length === 0) {
        filesystemInfo = {
          type: mainDisk.fstype,
          label: null, // blkid will give us label/uuid
          uuid: null,
        };
      }
    }
  } catch (err: any) {
    log(LogLevel.WARN, `lsblk for ${disk} failed`, { error: err.message });
  }

  // 2. Check for RAID superblocks
  try {
    const { stdout: mdadmOutput, stderr: mdadmStderr } = await sendCommand("mdadm", [
      "--examine",
      devicePath,
    ]);
    rawMdadmExamine = mdadmOutput;
    if (mdadmOutput.includes("MD device") || mdadmOutput.includes("RAID")) {
      raidInfo.isRaid = true;
      raidInfo.metadata = mdadmOutput;
    } else if (mdadmStderr.includes("No super block found") || mdadmStderr.includes("No RAID superblock on")) {
      // Expected stderr for non-RAID disks, don't treat as error
      raidInfo.isRaid = false;
      raidInfo.metadata = "No RAID superblock found.";
    } else {
      // Other unexpected stderr
      raidInfo.isRaid = false;
      raidInfo.metadata = mdadmStderr || "Unknown error during mdadm --examine.";
    }
  } catch (err: any) {
    // mdadm --examine can fail if not a RAID disk, check stderr for specific messages
    if ((err.stderr || '').includes("No super block found") || (err.stderr || '').includes("No RAID superblock on")) {
      raidInfo.isRaid = false;
      raidInfo.metadata = err.stderr;
    } else {
      log(LogLevel.WARN, `mdadm --examine for ${disk} failed`, { error: err.message, stderr: err.stderr });
      raidInfo.isRaid = false;
      raidInfo.metadata = err.stderr || err.message;
    }
  }

  // 3. Check filesystem type, label, UUID using blkid (for disk and partitions)
  try {
    const { stdout: blkidOutput } = await sendCommand("blkid", [
      "-o",
      "export",
      devicePath,
    ]);
    rawBlkid = blkidOutput;
    const blkidLines = blkidOutput.split("\n").filter(Boolean);
    const blkidMap: { [key: string]: string } = {};
    blkidLines.forEach(line => {
      const parts = line.split("=");
      if (parts.length === 2) {
        blkidMap[parts[0]] = parts[1];
      }
    });

    if (blkidMap.TYPE) {
      // If fs info was not set by lsblk, set it here for the main disk
      if (!filesystemInfo) {
        filesystemInfo = {
          type: blkidMap.TYPE || null,
          label: blkidMap.LABEL || null,
          uuid: blkidMap.UUID || null,
        };
      } else {
        // Update existing info with label/uuid
        filesystemInfo.label = blkidMap.LABEL || null;
        filesystemInfo.uuid = blkidMap.UUID || null;
      }
    }

    // Also get blkid for partitions to update fstype if lsblk didn't provide it
    for (const part of partitions) {
        try {
            const { stdout: partBlkidOutput } = await sendCommand("blkid", ["-o", "export", `/dev/${part.name}`]);
            const partBlkidLines = partBlkidOutput.split("\n").filter(Boolean);
            const partBlkidMap: { [key: string]: string } = {};
            partBlkidLines.forEach(line => {
                const parts = line.split("=");
                if (parts.length === 2) {
                    partBlkidMap[parts[0]] = parts[1];
                }
            });
            if (partBlkidMap.TYPE) {
                part.fstype = partBlkidMap.TYPE;
            }
        } catch (partBlkidErr: any) {
            log(LogLevel.DEBUG, `blkid for partition ${part.name} failed`, { error: partBlkidErr.message });
        }
    }

  } catch (err: any) {
    log(LogLevel.WARN, `blkid for ${disk} failed`, { error: err.message });
  }


  return {
    disk,
    exists: true, // Assuming if we got this far, the disk exists
    partitions,
    raidInfo,
    filesystemInfo,
    rawLsblk,
    rawMdadmExamine,
    rawBlkid,
  };
}
