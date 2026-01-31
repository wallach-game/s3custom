export enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export function log(level: LogLevel, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({ timestamp, level, message, data }));
}
