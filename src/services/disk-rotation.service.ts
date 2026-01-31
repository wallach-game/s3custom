import * as fs from "fs";
import * as path from "path";
import { listDisks, DiskInfo } from "./disk.service";
import { spinDown, spinUp, getPowerStatus } from "./power.service";
import { log, LogLevel } from "./logging.service";

export interface RotationConfig {
  enabled: boolean;
  rotationIntervalMinutes: number;
  disksPerRotation: number;
  excludedDisks: string[];
  minIdleMinutesBeforeSpin: number;
}

export interface RotationState {
  currentRotationIndex: number;
  lastRotationTime: string | null;
  diskStates: { [disk: string]: DiskPowerState };
  totalPowerSavingsHours: number;
}

export interface DiskPowerState {
  disk: string;
  powerState: "active" | "standby" | "unknown";
  lastStateChange: string;
  totalStandbyHours: number;
}

export interface RotationStats {
  enabled: boolean;
  totalDisksManaged: number;
  currentlyActive: number;
  currentlyStandby: number;
  totalPowerSavingsHours: number;
  nextRotationTime: string | null;
  currentRotationSet: string[];
}

const CONFIG_FILE = path.join(__dirname, "../../data/rotation-config.json");
const STATE_FILE = path.join(__dirname, "../../data/rotation-state.json");

let rotationInterval: NodeJS.Timeout | null = null;
let currentConfig: RotationConfig = {
  enabled: false,
  rotationIntervalMinutes: 240,
  disksPerRotation: 1,
  excludedDisks: [],
  minIdleMinutesBeforeSpin: 5,
};

let currentState: RotationState = {
  currentRotationIndex: 0,
  lastRotationTime: null,
  diskStates: {},
  totalPowerSavingsHours: 0,
};

// Ensure data directory exists
function ensureDataDir(): void {
  const dataDir = path.join(__dirname, "../../data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    log(LogLevel.INFO, "Created data directory", { path: dataDir });
  }
}

// Load configuration from file
function loadConfig(): RotationConfig {
  ensureDataDir();

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const content = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(content);
    } catch (err: any) {
      log(LogLevel.WARN, "Failed to load rotation config, using defaults", { error: err.message });
    }
  }

  return currentConfig;
}

// Save configuration to file
function saveConfig(config: RotationConfig): void {
  ensureDataDir();

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
    log(LogLevel.INFO, "Saved rotation configuration", { config });
  } catch (err: any) {
    log(LogLevel.ERROR, "Failed to save rotation config", { error: err.message, stack: err.stack });
  }
}

// Load state from file
function loadState(): RotationState {
  ensureDataDir();

  if (fs.existsSync(STATE_FILE)) {
    try {
      const content = fs.readFileSync(STATE_FILE, "utf-8");
      return JSON.parse(content);
    } catch (err: any) {
      log(LogLevel.WARN, "Failed to load rotation state, using defaults", { error: err.message });
    }
  }

  return currentState;
}

// Save state to file
function saveState(state: RotationState): void {
  ensureDataDir();

  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
    log(LogLevel.DEBUG, "Saved rotation state");
  } catch (err: any) {
    log(LogLevel.ERROR, "Failed to save rotation state", { error: err.message, stack: err.stack });
  }
}

// Initialize service on module load
export function initializeRotationService(): void {
  currentConfig = loadConfig();
  currentState = loadState();

  if (currentConfig.enabled) {
    log(LogLevel.INFO, "Disk rotation service enabled, starting scheduler", {
      interval: currentConfig.rotationIntervalMinutes,
    });
    startRotationScheduler();
  } else {
    log(LogLevel.INFO, "Disk rotation service initialized but disabled");
  }
}

// Get eligible disks for rotation
async function getEligibleDisks(): Promise<string[]> {
  const allDisks = await listDisks();
  const eligible = allDisks
    .filter((d) => !currentConfig.excludedDisks.includes(d.name))
    .filter((d) => !d.mountpoint || d.mountpoint.startsWith("/mnt/")) // Don't rotate system disks
    .map((d) => d.name);

  return eligible;
}

// Perform rotation
async function performRotation(): Promise<void> {
  log(LogLevel.INFO, "Starting disk rotation cycle");

  try {
    const eligibleDisks = await getEligibleDisks();

    if (eligibleDisks.length < 3) {
      log(LogLevel.INFO, "Not enough eligible disks for rotation (need at least 3)", {
        eligible: eligibleDisks.length,
      });
      return;
    }

    // Calculate how many disks to keep active
    const activeCount = Math.max(1, Math.ceil(eligibleDisks.length / 3));

    // Determine which disks should be active in this rotation
    const activeDiskIndices: number[] = [];
    for (let i = 0; i < activeCount; i++) {
      const index = (currentState.currentRotationIndex + i) % eligibleDisks.length;
      activeDiskIndices.push(index);
    }

    const activeDisks = activeDiskIndices.map((i) => eligibleDisks[i]);
    const standbyDisks = eligibleDisks.filter((d) => !activeDisks.includes(d));

    log(LogLevel.INFO, "Rotation plan calculated", {
      total: eligibleDisks.length,
      active: activeDisks,
      standby: standbyDisks,
    });

    // Spin up active disks
    for (const disk of activeDisks) {
      try {
        const status = await getPowerStatus(disk);
        if (status === "standby") {
          log(LogLevel.INFO, `Spinning up disk ${disk}`);
          await spinUp(disk);
          updateDiskState(disk, "active");
        }
      } catch (err: any) {
        log(LogLevel.ERROR, `Failed to spin up disk ${disk}`, { error: err.message });
      }
    }

    // Spin down standby disks (after a delay to ensure active disks are ready)
    setTimeout(async () => {
      for (const disk of standbyDisks) {
        try {
          const status = await getPowerStatus(disk);
          if (status === "active" || status === "unknown") {
            log(LogLevel.INFO, `Spinning down disk ${disk}`);
            await spinDown(disk);
            updateDiskState(disk, "standby");
          }
        } catch (err: any) {
          log(LogLevel.ERROR, `Failed to spin down disk ${disk}`, { error: err.message });
        }
      }
    }, 10000); // 10 second delay

    // Update rotation index
    currentState.currentRotationIndex =
      (currentState.currentRotationIndex + activeCount) % eligibleDisks.length;
    currentState.lastRotationTime = new Date().toISOString();

    saveState(currentState);

    log(LogLevel.INFO, "Disk rotation cycle completed", {
      nextIndex: currentState.currentRotationIndex,
    });
  } catch (err: any) {
    log(LogLevel.ERROR, "Failed to perform disk rotation", { error: err.message, stack: err.stack });
  }
}

// Update disk power state
function updateDiskState(disk: string, state: "active" | "standby"): void {
  const now = new Date();

  if (!currentState.diskStates[disk]) {
    currentState.diskStates[disk] = {
      disk,
      powerState: state,
      lastStateChange: now.toISOString(),
      totalStandbyHours: 0,
    };
  } else {
    const previousState = currentState.diskStates[disk].powerState;
    const lastChange = new Date(currentState.diskStates[disk].lastStateChange);
    const hoursSinceChange = (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60);

    // If transitioning from standby to active, add to standby hours
    if (previousState === "standby" && state === "active") {
      currentState.diskStates[disk].totalStandbyHours += hoursSinceChange;
      currentState.totalPowerSavingsHours += hoursSinceChange;
    }

    currentState.diskStates[disk].powerState = state;
    currentState.diskStates[disk].lastStateChange = now.toISOString();
  }
}

// Start rotation scheduler
function startRotationScheduler(): void {
  if (rotationInterval) {
    clearInterval(rotationInterval);
  }

  const intervalMs = currentConfig.rotationIntervalMinutes * 60 * 1000;

  rotationInterval = setInterval(() => {
    performRotation();
  }, intervalMs);

  // Perform initial rotation immediately
  performRotation();

  log(LogLevel.INFO, "Rotation scheduler started", {
    intervalMinutes: currentConfig.rotationIntervalMinutes,
  });
}

// Stop rotation scheduler
function stopRotationScheduler(): void {
  if (rotationInterval) {
    clearInterval(rotationInterval);
    rotationInterval = null;
    log(LogLevel.INFO, "Rotation scheduler stopped");
  }
}

// Public API functions

export function getRotationStatus(): RotationStats {
  const activeDisks = Object.values(currentState.diskStates).filter((s) => s.powerState === "active");
  const standbyDisks = Object.values(currentState.diskStates).filter((s) => s.powerState === "standby");

  let nextRotationTime: string | null = null;
  if (currentConfig.enabled && currentState.lastRotationTime) {
    const lastRotation = new Date(currentState.lastRotationTime);
    const nextRotation = new Date(
      lastRotation.getTime() + currentConfig.rotationIntervalMinutes * 60 * 1000
    );
    nextRotationTime = nextRotation.toISOString();
  }

  return {
    enabled: currentConfig.enabled,
    totalDisksManaged: Object.keys(currentState.diskStates).length,
    currentlyActive: activeDisks.length,
    currentlyStandby: standbyDisks.length,
    totalPowerSavingsHours: currentState.totalPowerSavingsHours,
    nextRotationTime,
    currentRotationSet: activeDisks.map((s) => s.disk),
  };
}

export function enableRotation(config?: Partial<RotationConfig>): void {
  currentConfig = {
    ...currentConfig,
    ...config,
    enabled: true,
  };

  saveConfig(currentConfig);
  startRotationScheduler();

  log(LogLevel.INFO, "Disk rotation enabled", { config: currentConfig });
}

export function disableRotation(): void {
  currentConfig.enabled = false;
  saveConfig(currentConfig);
  stopRotationScheduler();

  log(LogLevel.INFO, "Disk rotation disabled");
}

export function updateRotationConfig(config: Partial<RotationConfig>): void {
  currentConfig = {
    ...currentConfig,
    ...config,
  };

  saveConfig(currentConfig);

  if (currentConfig.enabled) {
    startRotationScheduler();
  }

  log(LogLevel.INFO, "Rotation configuration updated", { config: currentConfig });
}

export function getRotationConfig(): RotationConfig {
  return { ...currentConfig };
}

export function getDiskStates(): { [disk: string]: DiskPowerState } {
  return { ...currentState.diskStates };
}
