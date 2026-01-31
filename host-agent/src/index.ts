import * as net from "net";
import * as fs from "fs";
import { execFile } from "child_process";

const SOCKET_PATH = process.env.HOSTAGENT_SOCKET || "/var/run/hostagent.sock";

const WHITELISTED_COMMANDS: Record<string, string> = {
  lsblk: "/usr/bin/lsblk",
  smartctl: "/usr/sbin/smartctl",
  hdparm: "/usr/sbin/hdparm",
  mdadm: "/usr/sbin/mdadm",
  df: "/usr/bin/df",
  mount: "/usr/bin/mount",
  umount: "/usr/bin/umount",
  fdisk: "/usr/sbin/fdisk",
  blkid: "/usr/sbin/blkid",
  file: "/usr/bin/file",
  mkdir: "/usr/bin/mkdir",
  "ntfs-3g": "/usr/bin/ntfs-3g",
  ddrescue: "/usr/bin/ddrescue",
};

const DANGEROUS_PATTERNS = /[;&|`$(){}*?[\]<>\n\r'"`\\]/;
const MAX_ARG_LENGTH = 4096;
const MAX_ARGS_COUNT = 20;

interface Request {
  cmd: string;
  args?: string[];
}

interface Response {
  ok: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

function validateArgs(args: string[]): boolean {
  for (const arg of args) {
    if (DANGEROUS_PATTERNS.test(arg)) {
      return false;
    }
  }
  return true;
}

function handleRequest(req: Request): Promise<Response> {
  return new Promise((resolve) => {
    if (!req.cmd || typeof req.cmd !== "string") {
      resolve({ ok: false, error: "Missing or invalid cmd" });
      return;
    }

    const bin = WHITELISTED_COMMANDS[req.cmd];
    if (!bin) {
      resolve({ ok: false, error: `Command not whitelisted: ${req.cmd}` });
      return;
    }

    const args = req.args ?? [];
    if (!Array.isArray(args) || !args.every((a) => typeof a === "string")) {
      resolve({ ok: false, error: "Args must be an array of strings" });
      return;
    }

    if (args.length > MAX_ARGS_COUNT) {
      resolve({ ok: false, error: `Too many arguments (max ${MAX_ARGS_COUNT})` });
      return;
    }

    if (args.some((a) => a.length > MAX_ARG_LENGTH)) {
      resolve({ ok: false, error: `Argument exceeds maximum length (max ${MAX_ARG_LENGTH})` });
      return;
    }

    if (!validateArgs(args)) {
      resolve({ ok: false, error: "Args contain disallowed characters" });
      return;
    }

    execFile(bin, args, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({
          ok: false,
          error: err.message,
          stdout: stdout || undefined,
          stderr: stderr || undefined,
        });
      } else {
        resolve({ ok: true, stdout, stderr: stderr || undefined });
      }
    });
  });
}

function startServer(): void {
  if (fs.existsSync(SOCKET_PATH)) {
    fs.unlinkSync(SOCKET_PATH);
  }

  const server = net.createServer((conn) => {
    let buffer = "";

    conn.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop()!;

      for (const line of lines) {
        if (!line.trim()) continue;

        let req: Request;
        try {
          req = JSON.parse(line);
        } catch {
          conn.write(JSON.stringify({ ok: false, error: "Invalid JSON" }) + "\n");
          continue;
        }

        handleRequest(req).then((res) => {
          conn.write(JSON.stringify(res) + "\n");
        });
      }
    });

    conn.on("error", (err) => {
      console.error("Connection error:", err.message);
    });
  });

  server.listen(SOCKET_PATH, () => {
    fs.chmodSync(SOCKET_PATH, 0o660);
    // Note: Set proper group ownership with: chown :docker /var/run/hostagent.sock
    // Ensure users are in the appropriate group for socket access
    console.log(`Host agent listening on ${SOCKET_PATH}`);
  });

  const shutdown = () => {
    console.log("Shutting down...");
    server.close();
    if (fs.existsSync(SOCKET_PATH)) {
      fs.unlinkSync(SOCKET_PATH);
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer();
