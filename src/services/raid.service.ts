import { sendCommand } from "../socket-client";

export interface RaidStatus {
  device: string;
  level: string;
  state: string;
  devices: string[];
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
          const devicesInArray: string[] = [];
          const devRegex = /\/dev\/\w+/g;
          let m;
          // Extract member devices from detail output
          const activeSection = detail.split("Number   Major   Minor")[1] || "";
          while ((m = devRegex.exec(activeSection)) !== null) {
            devicesInArray.push(m[0]);
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
