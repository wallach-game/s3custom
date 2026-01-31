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

/**
 * Send command with retry logic and exponential backoff
 * @param cmd Command name
 * @param args Command arguments
 * @param maxRetries Maximum number of retry attempts (default: 3)
 * @returns Command output
 */
export async function sendCommandWithRetry(
  cmd: string,
  args: string[] = [],
  maxRetries: number = 3
): Promise<{ stdout: string; stderr: string }> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await sendCommand(cmd, args);
    } catch (err) {
      lastError = err as Error;

      // Don't retry on validation errors or command not found
      if (
        lastError.message.includes("not whitelisted") ||
        lastError.message.includes("Invalid JSON") ||
        lastError.message.includes("disallowed characters")
      ) {
        throw lastError;
      }

      // If this isn't the last attempt, wait before retrying
      if (attempt < maxRetries - 1) {
        const backoffMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError!;
}
