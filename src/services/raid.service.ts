import { sendCommand } from "../socket-client";

export interface RaidDevice {
  name: string;
  state: string;
}

export interface RaidStatus {
  device: string;
  level: string;
  state: string;
  devices: RaidDevice[];
  raw: string;
}

export async function createRaid(
  level: string,
  devices: string[]
): Promise<string> {
  const validLevels = ["0", "1", "5", "6", "10"];
  if (!validLevels.includes(level)) {
    throw new Error(`Invalid RAID level: ${level}. Must be one of: ${validLevels.join(", ")}`);
  }

  if (devices.length < 2) {
    throw new Error("At least 2 devices required for RAID");
  }

  const devicePaths = devices.map((d) =>
    d.startsWith("/dev/") ? d : `/dev/${d}`
  );

  // Find next available md device
  const { stdout: mdstat } = await sendCommand("lsblk", [
    "-J",
    "-o",
    "NAME,TYPE",
  ]);
  const existing = JSON.parse(mdstat);
  const mdDevices = (existing.blockdevices || [])
    .filter((d: any) => d.type === "raid0" || d.type === "raid1" || d.type === "raid5" || d.type === "raid6" || d.type === "raid10")
    .map((d: any) => d.name);

  let mdNum = 0;
  while (mdDevices.includes(`md${mdNum}`)) mdNum++;
  const mdDevice = `/dev/md${mdNum}`;

  const { stdout } = await sendCommand("mdadm", [
    "--create",
    mdDevice,
    "--level",
    level,
    "--raid-devices",
    String(devices.length),
    "--run",
    ...devicePaths,
  ]);

  return stdout;
}

export async function getRaidStatus(): Promise<RaidStatus[]> {
  try {
    const { stdout } = await sendCommand("mdadm", ["--detail", "--scan"]);

    if (!stdout.trim()) return [];

    const arrays: RaidStatus[] = [];
    const lines = stdout.trim().split("\n");

    for (const line of lines) {
      const deviceMatch = line.match(/ARRAY\s+(\/dev\/\S+)/);
      const levelMatch = line.match(/level=(\S+)/);

      if (deviceMatch) {
        const device = deviceMatch[1];
        try {
          const { stdout: detail } = await sendCommand("mdadm", [
            "--detail",
            device,
          ]);

          const stateMatch = detail.match(/State\s*:\s*(.+)/);
          const devicesInArray: RaidDevice[] = [];
          
          const deviceSection = detail.split("Number   Major   Minor   RaidDevice State")[1] || "";
          const deviceLines = deviceSection.trim().split("\n");

          for(const deviceLine of deviceLines) {
            const parts = deviceLine.trim().split(/\s+/);
            if(parts.length < 5) continue;
            const name = parts[parts.length -1];
            const state = parts.slice(4, parts.length - 1).join(" ");
            devicesInArray.push({ name, state });
          }
          
          arrays.push({
            device,
            level: levelMatch?.[1] || "unknown",
            state: stateMatch?.[1]?.trim() || "unknown",
            devices: devicesInArray,
            raw: detail,
          });
        } catch {
          arrays.push({
            device,
            level: levelMatch?.[1] || "unknown",
            state: "unknown",
            devices: [],
            raw: line,
          });
        }
      }
    }

    return arrays;
  } catch {
    return [];
  }
}

export async function removeRaid(device: string): Promise<string> {
  const devicePath = device.startsWith("/dev/") ? device : `/dev/${device}`;

  await sendCommand("mdadm", ["--stop", devicePath]);
  const { stdout } = await sendCommand("mdadm", ["--remove", devicePath]);

  return stdout;
}

export async function failDisk(
  raidDevice: string,
  disk: string
): Promise<string> {
  const raidDevicePath = raidDevice.startsWith("/dev/")
    ? raidDevice
    : `/dev/${raidDevice}`;
  const diskPath = disk.startsWith("/dev/") ? disk : `/dev/${disk}`;
  const { stdout } = await sendCommand("mdadm", [
    raidDevicePath,
    "--fail",
    diskPath,
  ]);
  return stdout;
}

export async function removeDisk(
  raidDevice: string,
  disk: string
): Promise<string> {
  const raidDevicePath = raidDevice.startsWith("/dev/")
    ? raidDevice
    : `/dev/${raidDevice}`;
  const diskPath = disk.startsWith("/dev/") ? disk : `/dev/${disk}`;
  const { stdout } = await sendCommand("mdadm", [
    raidDevicePath,
    "--remove",
    diskPath,
  ]);
  return stdout;
}

export async function addDisk(
  raidDevice: string,
  disk: string
): Promise<string> {
  const raidDevicePath = raidDevice.startsWith("/dev/")
    ? raidDevice
    : `/dev/${raidDevice}`;
  const diskPath = disk.startsWith("/dev/") ? disk : `/dev/${disk}`;
  const { stdout } = await sendCommand("mdadm", [
    raidDevicePath,
    "--add",
    diskPath,
  ]);
  return stdout;
}

export async function cloneToRaid(disk: string): Promise<string> {
  const devicePath = disk.startsWith("/dev/") ? disk : `/dev/${disk}`;

  // Find next available md device
  const { stdout: mdstat } = await sendCommand("lsblk", [
    "-J",
    "-o",
    "NAME,TYPE",
  ]);
  const existing = JSON.parse(mdstat);
  const mdDevices = (existing.blockdevices || [])
    .filter((d: any) => d.type === "raid0" || d.type === "raid1" || d.type === "raid5" || d.type === "raid6" || d.type === "raid10")
    .map((d: any) => d.name);

  let mdNum = 0;
  while (mdDevices.includes(`md${mdNum}`)) mdNum++;
  const mdDevice = `/dev/md${mdNum}`;

  const { stdout } = await sendCommand("mdadm", [
    "--create",
    mdDevice,
    "--level",
    "1",
    "--raid-devices",
    "2",
    "--run",
    devicePath,
    "missing",
  ]);

  return stdout;
}
