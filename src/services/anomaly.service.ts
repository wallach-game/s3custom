import { log, LogLevel } from "./logging.service";

const HISTORY_SIZE = 10;
const ANOMALY_THRESHOLD = 0.5; // 50% drop from average

const speedHistory: Record<string, number[]> = {};

export function checkSpeedAnomaly(disk: string, newSpeed: number): boolean {
  if (!speedHistory[disk]) {
    speedHistory[disk] = [];
  }

  const history = speedHistory[disk];
  let isAnomaly = false;

  if (history.length > 0) {
    const average = history.reduce((a, b) => a + b, 0) / history.length;
    if (newSpeed < average * ANOMALY_THRESHOLD) {
      isAnomaly = true;
      log(LogLevel.WARN, `Anomaly detected for disk ${disk}`, {
        currentSpeed: newSpeed,
        averageSpeed: average,
        history,
      });
    }
  }

  history.push(newSpeed);
  if (history.length > HISTORY_SIZE) {
    history.shift();
  }

  return isAnomaly;
}
