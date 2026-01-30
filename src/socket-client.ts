import * as net from "net";

const SOCKET_PATH = process.env.HOSTAGENT_SOCKET || "/var/run/hostagent.sock";

interface AgentResponse {
  ok: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export async function sendCommand(
  cmd: string,
  args: string[] = []
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(SOCKET_PATH);
    let buffer = "";

    client.on("connect", () => {
      const request = JSON.stringify({ cmd, args }) + "\n";
      client.write(request);
    });

    client.on("data", (data) => {
      buffer += data.toString();
      const idx = buffer.indexOf("\n");
      if (idx !== -1) {
        const line = buffer.slice(0, idx);
        client.end();

        let res: AgentResponse;
        try {
          res = JSON.parse(line);
        } catch {
          reject(new Error("Invalid response from host agent"));
          return;
        }

        if (res.ok) {
          resolve({ stdout: res.stdout || "", stderr: res.stderr || "" });
        } else {
          const err = new Error(res.error || "Host agent command failed");
          (err as any).stdout = res.stdout || "";
          (err as any).stderr = res.stderr || "";
          reject(err);
        }
      }
    });

    client.on("error", (err) => {
      reject(new Error(`Host agent connection failed: ${err.message}`));
    });

    client.setTimeout(30000, () => {
      client.destroy();
      reject(new Error("Host agent request timed out"));
    });
  });
}
