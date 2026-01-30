import * as fs from "fs/promises";
import * as path from "path";

const BASE_DIR = process.env.FILES_ROOT || "/mnt/disks";

function safePath(userPath: string): string {
  // Strip leading slashes so path.resolve treats it as relative to BASE_DIR
  const cleaned = userPath.replace(/^\/+/, "");
  const resolved = path.resolve(BASE_DIR, cleaned);
  if (!resolved.startsWith(BASE_DIR)) {
    throw new Error("Path traversal denied");
  }
  return resolved;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
}

export async function listFiles(dirPath: string = "/"): Promise<FileEntry[]> {
  const absPath = safePath(dirPath);
  const entries = await fs.readdir(absPath, { withFileTypes: true });

  const results: FileEntry[] = [];
  for (const entry of entries) {
    const fullPath = path.join(absPath, entry.name);
    const stat = await fs.stat(fullPath);
    results.push({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      isDirectory: entry.isDirectory(),
      size: stat.size,
      modified: stat.mtime.toISOString(),
    });
  }

  return results;
}

export async function createFile(
  filePath: string,
  content: Buffer | string
): Promise<void> {
  const absPath = safePath(filePath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content);
}

export async function readFile(filePath: string): Promise<Buffer> {
  const absPath = safePath(filePath);
  return fs.readFile(absPath);
}

export async function updateFile(
  filePath: string,
  content: Buffer | string
): Promise<void> {
  const absPath = safePath(filePath);
  await fs.access(absPath);
  await fs.writeFile(absPath, content);
}

export async function deleteFile(filePath: string): Promise<void> {
  const absPath = safePath(filePath);
  const stat = await fs.stat(absPath);
  if (stat.isDirectory()) {
    await fs.rm(absPath, { recursive: true });
  } else {
    await fs.unlink(absPath);
  }
}

export async function createDirectory(dirPath: string): Promise<void> {
  const absPath = safePath(dirPath);
  await fs.mkdir(absPath, { recursive: true });
}
