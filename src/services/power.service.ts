import { sendCommand } from "../socket-client";

export async function spinDown(disk: string): Promise<string> {
  const devicePath = disk.startsWith("/dev/") ? disk : `/dev/${disk}`;
  const { stdout } = await sendCommand("hdparm", ["-y", devicePath]);
  return stdout;
}

export async function spinUp(disk: string): Promise<string> {
  const devicePath = disk.startsWith("/dev/") ? disk : `/dev/${disk}`;
  // Reading from disk forces spin-up; hdparm -C checks and triggers it
  const { stdout } = await sendCommand("hdparm", ["-C", devicePath]);
  return stdout;
}

export async function setIdleTimeout(
  disk: string,
  seconds: number
): Promise<string> {
  const devicePath = disk.startsWith("/dev/") ? disk : `/dev/${disk}`;

  // hdparm -S value: 0=off, 1-240 = value*5sec, 241-251 = (value-240)*30min
  let value: number;
  if (seconds === 0) {
    value = 0;
  } else if (seconds <= 1200) {
    value = Math.max(1, Math.round(seconds / 5));
  } else {
    value = Math.min(251, 240 + Math.round(seconds / 1800));
  }

  const { stdout } = await sendCommand("hdparm", [
    "-S",
    String(value),
    devicePath,
  ]);
  return stdout;
}

export async function getPowerStatus(disk: string): Promise<string> {
  const devicePath = disk.startsWith("/dev/") ? disk : `/dev/${disk}`;
  const { stdout } = await sendCommand("hdparm", ["-C", devicePath]);

  if (/standby/i.test(stdout)) return "standby";
  if (/active|idle/i.test(stdout)) return "active";
  return "unknown";
}
