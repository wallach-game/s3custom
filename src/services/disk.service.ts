import { sendCommand } from "../socket-client";

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

    const healthy = /SMART overall-health.*PASSED/i.test(stdout);

    const tempMatch = stdout.match(/Temperature_Celsius.*?(\d+)\s*$/m);
    const temperature = tempMatch ? parseInt(tempMatch[1], 10) : undefined;

    const hoursMatch = stdout.match(/Power_On_Hours.*?(\d+)\s*$/m);
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
