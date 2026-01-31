import * as fs from "fs";
import * as path from "path";
import { log, LogLevel } from "./logging.service";

export interface SmartHistoryEntry {
  timestamp: string;
  healthy: boolean;
  temperature?: number;
  powerOnHours?: number;
  reallocatedSectors?: number;
  currentPendingSectors?: number;
  readErrors?: number;
  writeErrors?: number;
}

const HISTORY_DIR = path.join(__dirname, "../../data/smart-history");

// Ensure history directory exists
function ensureHistoryDir(): void {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
    log(LogLevel.INFO, "Created SMART history directory", { path: HISTORY_DIR });
  }
}

function getHistoryFilePath(disk: string): string {
  // Sanitize disk name for filename
  const safeDisk = disk.replace(/[^a-zA-Z0-9]/g, "_");
  return path.join(HISTORY_DIR, `${safeDisk}.json`);
}

export async function saveSmartHistory(disk: string, entry: SmartHistoryEntry): Promise<void> {
  ensureHistoryDir();

  const filePath = getHistoryFilePath(disk);
  let history: SmartHistoryEntry[] = [];

  // Load existing history
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      history = JSON.parse(content);
    } catch (err: any) {
      log(LogLevel.WARN, `Failed to read existing history for ${disk}`, { error: err.message });
    }
  }

  // Add new entry
  history.push(entry);

  // Keep only last 1000 entries (to prevent unbounded growth)
  if (history.length > 1000) {
    history = history.slice(-1000);
  }

  // Save back to file
  try {
    fs.writeFileSync(filePath, JSON.stringify(history, null, 2), "utf-8");
    log(LogLevel.DEBUG, `Saved SMART history for ${disk}`, { entries: history.length });
  } catch (err: any) {
    log(LogLevel.ERROR, `Failed to save SMART history for ${disk}`, { error: err.message, stack: err.stack });
    throw err;
  }
}

export async function getSmartHistory(disk: string, limit?: number): Promise<SmartHistoryEntry[]> {
  ensureHistoryDir();

  const filePath = getHistoryFilePath(disk);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    let history: SmartHistoryEntry[] = JSON.parse(content);

    // Apply limit if specified
    if (limit && limit > 0) {
      history = history.slice(-limit);
    }

    return history;
  } catch (err: any) {
    log(LogLevel.ERROR, `Failed to read SMART history for ${disk}`, { error: err.message, stack: err.stack });
    throw new Error(`Failed to read SMART history: ${err.message}`);
  }
}

export async function getAllDisksWithHistory(): Promise<string[]> {
  ensureHistoryDir();

  try {
    const files = fs.readdirSync(HISTORY_DIR);
    return files
      .filter(f => f.endsWith(".json"))
      .map(f => f.replace(".json", "").replace(/_/g, ""));
  } catch (err: any) {
    log(LogLevel.ERROR, "Failed to list disks with history", { error: err.message, stack: err.stack });
    return [];
  }
}
