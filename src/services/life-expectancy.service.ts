import { getSmartStatus, SmartStatus } from "./disk.service";
import { getSmartHistory, SmartHistoryEntry } from "./smart-history.service";
import { log, LogLevel } from "./logging.service";

export interface LifeExpectancy {
  disk: string;
  estimatedRemainingYears: number;
  estimatedRemainingMonths: number;
  confidence: "high" | "medium" | "low";
  warnings: string[];
  factors: {
    powerOnHoursScore: number; // 0-100, 100 = like new
    reallocatedSectorsScore: number; // 0-100, 100 = no bad sectors
    temperatureScore: number; // 0-100, 100 = optimal temp
    errorRateScore: number; // 0-100, 100 = no errors
    trendScore: number; // 0-100, 100 = improving/stable
  };
}

// Constants for disk life expectancy calculations
const TYPICAL_LIFESPAN_HOURS = 43800; // 5 years
const MAX_SAFE_REALLOCATED_SECTORS = 10;
const CRITICAL_REALLOCATED_SECTORS = 50;
const OPTIMAL_TEMP = 35;
const MAX_SAFE_TEMP = 50;
const CRITICAL_TEMP = 60;

export async function calculateLifeExpectancy(disk: string): Promise<LifeExpectancy> {
  const warnings: string[] = [];

  // Get current SMART status
  let smart: SmartStatus;
  try {
    smart = await getSmartStatus(disk);
  } catch (err: any) {
    log(LogLevel.ERROR, `Failed to get SMART status for ${disk}`, { error: err.message });
    throw new Error(`Cannot calculate life expectancy: ${err.message}`);
  }

  if (!smart.healthy) {
    warnings.push("Disk is reporting SMART health failure");
  }

  // Get historical data for trend analysis
  const history = await getSmartHistory(disk, 100);

  // Parse additional SMART attributes from raw output
  const reallocatedSectors = parseSmartAttribute(smart.raw, "Reallocated_Sector_Ct");
  const currentPendingSectors = parseSmartAttribute(smart.raw, "Current_Pending_Sector");
  const readErrors = parseSmartAttribute(smart.raw, "Read_Error_Rate");
  const writeErrors = parseSmartAttribute(smart.raw, "Write_Error_Rate");

  // Calculate individual factor scores (0-100)
  const powerOnHoursScore = calculatePowerOnHoursScore(smart.powerOnHours, warnings);
  const reallocatedSectorsScore = calculateReallocatedSectorsScore(
    reallocatedSectors,
    currentPendingSectors,
    warnings
  );
  const temperatureScore = calculateTemperatureScore(smart.temperature, history, warnings);
  const errorRateScore = calculateErrorRateScore(readErrors, writeErrors, warnings);
  const trendScore = calculateTrendScore(history, warnings);

  // Calculate overall health score (weighted average)
  const overallScore =
    powerOnHoursScore * 0.3 +
    reallocatedSectorsScore * 0.35 +
    temperatureScore * 0.15 +
    errorRateScore * 0.1 +
    trendScore * 0.1;

  // Estimate remaining life based on overall score
  const baseRemainingHours = TYPICAL_LIFESPAN_HOURS - (smart.powerOnHours || 0);
  const adjustedRemainingHours = (baseRemainingHours * overallScore) / 100;
  const remainingYears = Math.max(0, adjustedRemainingHours / 8760);
  const remainingMonths = Math.max(0, (adjustedRemainingHours % 8760) / 730);

  // Determine confidence level
  let confidence: "high" | "medium" | "low" = "high";
  if (history.length < 10) {
    confidence = "low";
    warnings.push("Limited historical data available for trend analysis");
  } else if (history.length < 50) {
    confidence = "medium";
  }

  if (overallScore < 30) {
    confidence = "low";
    warnings.push("Disk health is critically low - replace immediately");
  }

  log(LogLevel.INFO, `Calculated life expectancy for ${disk}`, {
    remainingYears: remainingYears.toFixed(1),
    overallScore: overallScore.toFixed(1),
    confidence,
  });

  return {
    disk,
    estimatedRemainingYears: Math.floor(remainingYears),
    estimatedRemainingMonths: Math.floor(remainingMonths),
    confidence,
    warnings,
    factors: {
      powerOnHoursScore,
      reallocatedSectorsScore,
      temperatureScore,
      errorRateScore,
      trendScore,
    },
  };
}

function parseSmartAttribute(raw: string, attributeName: string): number | undefined {
  const regex = new RegExp(`${attributeName}\\s+\\S+\\s+\\S+\\s+\\S+\\s+\\S+\\s+\\S+\\s+\\S+\\s+\\S+\\s+\\S+\\s+(\\d+)`);
  const match = raw.match(regex);
  return match ? parseInt(match[1], 10) : undefined;
}

function calculatePowerOnHoursScore(powerOnHours: number | undefined, warnings: string[]): number {
  if (!powerOnHours) return 50; // Unknown, assume moderate

  const usageRatio = powerOnHours / TYPICAL_LIFESPAN_HOURS;

  if (usageRatio >= 1.5) {
    warnings.push(`Disk has exceeded typical lifespan (${powerOnHours} hours)`);
    return Math.max(0, 30 - (usageRatio - 1.5) * 20);
  } else if (usageRatio >= 1.0) {
    warnings.push(`Disk is near end of typical lifespan (${powerOnHours} hours)`);
    return 50;
  }

  return Math.max(30, 100 - usageRatio * 50);
}

function calculateReallocatedSectorsScore(
  reallocatedSectors: number | undefined,
  currentPendingSectors: number | undefined,
  warnings: string[]
): number {
  const realloc = reallocatedSectors || 0;
  const pending = currentPendingSectors || 0;

  if (realloc >= CRITICAL_REALLOCATED_SECTORS) {
    warnings.push(`Critical: ${realloc} reallocated sectors detected`);
    return 0;
  }

  if (realloc >= MAX_SAFE_REALLOCATED_SECTORS) {
    warnings.push(`Warning: ${realloc} reallocated sectors detected`);
    return Math.max(20, 60 - realloc);
  }

  if (pending > 0) {
    warnings.push(`${pending} sectors pending reallocation`);
    return Math.max(50, 90 - pending * 5);
  }

  return 100;
}

function calculateTemperatureScore(
  currentTemp: number | undefined,
  history: SmartHistoryEntry[],
  warnings: string[]
): number {
  if (!currentTemp) return 70; // Unknown, assume reasonable

  // Check current temperature
  if (currentTemp >= CRITICAL_TEMP) {
    warnings.push(`Critical temperature: ${currentTemp}°C (max safe: ${MAX_SAFE_TEMP}°C)`);
    return Math.max(0, 20 - (currentTemp - CRITICAL_TEMP) * 2);
  }

  if (currentTemp >= MAX_SAFE_TEMP) {
    warnings.push(`High temperature: ${currentTemp}°C (optimal: ${OPTIMAL_TEMP}°C)`);
    return Math.max(40, 70 - (currentTemp - MAX_SAFE_TEMP) * 3);
  }

  // Check temperature trend
  if (history.length >= 10) {
    const recentTemps = history.slice(-10).filter(h => h.temperature).map(h => h.temperature!);
    if (recentTemps.length >= 5) {
      const avgRecent = recentTemps.reduce((a, b) => a + b, 0) / recentTemps.length;
      if (avgRecent >= MAX_SAFE_TEMP) {
        warnings.push(`Average temperature trending high: ${avgRecent.toFixed(1)}°C`);
      }
    }
  }

  // Score based on distance from optimal
  const tempDiff = Math.abs(currentTemp - OPTIMAL_TEMP);
  return Math.max(60, 100 - tempDiff * 2);
}

function calculateErrorRateScore(
  readErrors: number | undefined,
  writeErrors: number | undefined,
  warnings: string[]
): number {
  const reads = readErrors || 0;
  const writes = writeErrors || 0;
  const totalErrors = reads + writes;

  if (totalErrors > 100) {
    warnings.push(`High error rate detected (${totalErrors} errors)`);
    return Math.max(0, 50 - totalErrors / 10);
  }

  if (totalErrors > 10) {
    warnings.push(`Moderate error rate detected (${totalErrors} errors)`);
    return Math.max(60, 90 - totalErrors);
  }

  return 100;
}

function calculateTrendScore(history: SmartHistoryEntry[], warnings: string[]): number {
  if (history.length < 5) return 70; // Not enough data, assume neutral

  // Check if health is degrading
  const recentEntries = history.slice(-10);
  const unhealthyCount = recentEntries.filter(h => !h.healthy).length;

  if (unhealthyCount > 5) {
    warnings.push("Health trend is degrading");
    return 20;
  }

  if (unhealthyCount > 2) {
    warnings.push("Health trend shows intermittent issues");
    return 50;
  }

  // Check temperature trend
  const temps = recentEntries.filter(h => h.temperature).map(h => h.temperature!);
  if (temps.length >= 5) {
    const firstHalf = temps.slice(0, Math.floor(temps.length / 2));
    const secondHalf = temps.slice(Math.floor(temps.length / 2));
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (avgSecond > avgFirst + 5) {
      warnings.push("Temperature trending upward");
      return 60;
    }
  }

  return 90; // Stable or improving
}
