// src/services/recovery.service.ts

import { sendCommand } from "../socket-client";
import { log, LogLevel } from "./logging.service";
import { DiskExaminationResult, examineDisk } from "./disk.service"; // Assuming examineDisk is available

export async function mountDiskReadOnly(
  disk: string,
  mountPath: string
): Promise<string> {
  const devicePath = disk.startsWith("/dev/") ? disk : `/dev/${disk}`;

  // Validate mount path to prevent unauthorized mounts
  const mountPathPattern = /^\/mnt\/(recovery|temp|disks)[a-zA-Z0-9_\-\/]*$/;
  if (!mountPathPattern.test(mountPath)) {
    throw new Error("Invalid mount path. Must start with /mnt/recovery, /mnt/temp, or /mnt/disks");
  }

  // Prevent path traversal in mount path
  if (mountPath.includes("..")) {
    throw new Error("Mount path cannot contain '..'");
  }

  // Ensure mount path exists and is empty, or create it
  try {
    await sendCommand("mkdir", ["-p", mountPath]);
  } catch (mkdirErr: any) {
    log(
      LogLevel.ERROR,
      `Failed to create mount path ${mountPath}`,
      mkdirErr.message
    );
    throw new Error(`Failed to create mount path: ${mkdirErr.message}`);
  }

  const examinationResult = await examineDisk(disk);

  if (!examinationResult.exists) {
    throw new Error(`Disk ${disk} not found.`);
  }

  if (examinationResult.raidInfo.isRaid) {
      log(LogLevel.WARN, `Attempting to mount a disk with RAID metadata in recovery mode. Consider stopping kernel RAID first if assembled. Disk: ${disk}`);
      // In a real scenario, we might try to stop mdadm assembly here if needed.
      // For now, we'll proceed with a read-only mount attempt.
  }

  let mountCommandArgs: string[] = [];
  let command = "mount"; // Default to mount

  // Determine mount command based on filesystem type
  // Prioritize partition filesystem if available, otherwise use disk's fs
  const fstype =
    examinationResult.partitions.length > 0
      ? examinationResult.partitions[0].fstype // Assuming we are trying to mount the first partition for now
      : examinationResult.filesystemInfo?.type;

  // Validate filesystem type - whitelist known safe filesystems
  const allowedFilesystems = ["ntfs", "ntfs3", "ext4", "ext3", "ext2", "btrfs", "xfs", "vfat", "exfat"];
  if (fstype && !allowedFilesystems.includes(fstype)) {
    log(LogLevel.WARN, `Attempting to mount disk with non-whitelisted filesystem type: ${fstype}`);
  }

  log(LogLevel.INFO, `Attempting read-only mount for ${disk} (FS: ${fstype}) to ${mountPath}`);

  switch (fstype) {
    case "ntfs":
    case "ntfs3": // For newer kernels that might use ntfs3
      command = "ntfs-3g";
      mountCommandArgs = ["-o", "ro,recover", devicePath, mountPath];
      break;
    case "ext4":
    case "ext3":
    case "ext2":
      mountCommandArgs = ["-o", "ro,noload", devicePath, mountPath];
      break;
    case "btrfs":
      mountCommandArgs = ["-o", "ro,recovery,skip_balance", devicePath, mountPath];
      break;
    default:
      // Generic read-only mount for other types
      mountCommandArgs = ["-o", "ro", devicePath, mountPath];
      break;
  }

  try {
    const { stdout, stderr } = await sendCommand(command, mountCommandArgs);
    log(LogLevel.INFO, `Successfully mounted ${disk} to ${mountPath}`, { stdout, stderr });
    return `Disk ${disk} successfully mounted read-only to ${mountPath}.`;
  } catch (err: any) {
    log(LogLevel.ERROR, `Failed to mount ${disk} read-only to ${mountPath}`, {
      command,
      args: mountCommandArgs,
      error: err.message,
      stdout: err.stdout,
      stderr: err.stderr,
    });
    throw new Error(`Failed to mount ${disk} read-only: ${err.message}`);
  }
}

export async function cloneDisk(
  sourceDisk: string,
  destinationPath: string,
  logfilePath?: string
): Promise<string> {
  const sourceDevicePath = sourceDisk.startsWith("/dev/") ? sourceDisk : `/dev/${sourceDisk}`;

  const args = ["-f", "-r3", sourceDevicePath, destinationPath]; // -f: force, -r3: retry 3 times on bad sectors
  if (logfilePath) {
    args.push(logfilePath);
  }

  log(LogLevel.INFO, `Starting disk clone from ${sourceDisk} to ${destinationPath}`);

  try {
    const { stdout, stderr } = await sendCommand("ddrescue", args);
    log(LogLevel.INFO, `Disk clone successful for ${sourceDisk}`, { stdout, stderr });
    return `Disk ${sourceDisk} successfully cloned to ${destinationPath}.`;
  } catch (err: any) {
    log(LogLevel.ERROR, `Failed to clone disk ${sourceDisk} to ${destinationPath}`, {
      command: "ddrescue",
      args,
      error: err.message,
      stdout: err.stdout,
      stderr: err.stderr,
    });
    throw new Error(`Failed to clone disk ${sourceDisk}: ${err.message}`);
  }
}
