/**
 * @fileoverview Debug logging service for file-based log persistence
 *
 * Provides file-based debug logging with automatic session management, log rotation,
 * and network-specific logging capabilities. Creates timestamped log files in the
 * application's userData directory with automatic cleanup of old files.
 *
 * Key Features:
 * - Session-based log files with timestamps (debug-YYYY-MM-DD_HH-mm-ss.log)
 * - Separate network logging file (network-debug-YYYY-MM-DD_HH-mm-ss.log)
 * - Automatic cleanup of old log files (configurable retention count)
 * - Real-time log writing with buffering for performance
 * - Integration with ConfigManager for debug mode state
 * - CLI argument support for headless mode activation
 *
 * Log File Locations:
 * - Debug logs: <userData>/logs/debug-<timestamp>.log
 * - Network logs: <userData>/logs/network-debug-<timestamp>.log
 *
 * Usage:
 *   const debugLog = DebugLogService.getInstance();
 *   debugLog.log('MyService', 'Application started');
 *   debugLog.logNetwork('Connection', 'Connected to 192.168.1.100', { port: 8080 });
 *
 * @module services/DebugLogService
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

import { ConfigManager } from '../managers/ConfigManager.js';

/**
 * Log entry structure for internal processing
 */
interface LogEntry {
  readonly timestamp: Date;
  readonly namespace: string;
  readonly message: string;
  readonly data?: unknown;
  readonly level: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Network log entry with additional connection details
 */
interface NetworkLogEntry extends LogEntry {
  readonly ip?: string;
  readonly port?: number;
  readonly reason?: string;
  readonly retryCount?: number;
  readonly errorCode?: string;
  readonly stackTrace?: string;
}

/**
 * Configuration options for the debug log service
 */
interface DebugLogServiceOptions {
  /** Maximum number of log files to retain (default: 5) */
  maxLogFiles?: number;
  /** Flush interval in milliseconds (default: 1000) */
  flushIntervalMs?: number;
}

/**
 * Singleton service for managing debug log files
 */
export class DebugLogService {
  private static instance: DebugLogService | null = null;

  private readonly logsDir: string;
  private readonly maxLogFiles: number;
  private readonly flushIntervalMs: number;

  private debugLogPath: string | null = null;
  private networkLogPath: string | null = null;
  private debugLogStream: fs.WriteStream | null = null;
  private networkLogStream: fs.WriteStream | null = null;

  private debugBuffer: string[] = [];
  private networkBuffer: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  private isEnabled: boolean = false;
  private isNetworkLoggingEnabled: boolean = false;
  private cliDebugOverride: boolean = false;
  private cliNetworkOverride: boolean = false;
  private sessionStartTime: Date | null = null;

  private constructor(options: DebugLogServiceOptions = {}) {
    this.maxLogFiles = options.maxLogFiles ?? 5;
    this.flushIntervalMs = options.flushIntervalMs ?? 1000;
    this.logsDir = path.join(app.getPath('userData'), 'logs');

    // Ensure logs directory exists
    this.ensureLogsDirExists();
  }

  /**
   * Get the singleton instance of DebugLogService
   */
  public static getInstance(): DebugLogService {
    if (!DebugLogService.instance) {
      DebugLogService.instance = new DebugLogService();
    }
    return DebugLogService.instance;
  }

  /**
   * Initialize the service with optional CLI overrides
   * Should be called early in app startup after ConfigManager is available
   */
  public initialize(cliDebug: boolean = false, cliNetwork: boolean = false): void {
    this.cliDebugOverride = cliDebug;
    this.cliNetworkOverride = cliNetwork;

    // updateEnabledState() handles starting/stopping sessions based on state transitions
    this.updateEnabledState();

    console.log(`[DebugLogService] Initialized - Debug: ${this.isEnabled}, Network: ${this.isNetworkLoggingEnabled}`);
  }

  /**
   * Update enabled state from config and CLI overrides
   */
  public updateEnabledState(): void {
    const config = ConfigManager.getInstance().getConfig();
    const wasEnabled = this.isEnabled;
    const wasNetworkEnabled = this.isNetworkLoggingEnabled;

    // CLI flags override config settings (OR logic)
    this.isEnabled = config.DebugMode || this.cliDebugOverride;
    this.isNetworkLoggingEnabled = (config.DebugNetworkLogging || this.cliNetworkOverride) && this.isEnabled;

    // Handle state transitions
    if (this.isEnabled && !wasEnabled) {
      this.startSession();
    } else if (!this.isEnabled && wasEnabled) {
      this.endSession();
    }

    // Handle network logging state change within an active session
    if (this.isEnabled && this.isNetworkLoggingEnabled && !wasNetworkEnabled) {
      this.startNetworkLog();
    } else if (this.isEnabled && !this.isNetworkLoggingEnabled && wasNetworkEnabled) {
      this.closeNetworkLog();
    }
  }

  /**
   * Check if debug logging is currently enabled
   */
  public isDebugEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Check if network logging is currently enabled
   */
  public isNetworkEnabled(): boolean {
    return this.isNetworkLoggingEnabled;
  }

  /**
   * Get the path to the current debug log file
   */
  public getDebugLogPath(): string | null {
    return this.debugLogPath;
  }

  /**
   * Get the path to the current network log file
   */
  public getNetworkLogPath(): string | null {
    return this.networkLogPath;
  }

  /**
   * Get the logs directory path
   */
  public getLogsDirectory(): string {
    return this.logsDir;
  }

  /**
   * Log a debug message
   */
  public log(namespace: string, message: string, data?: unknown): void {
    if (!this.isEnabled) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      namespace,
      message,
      data,
      level: 'debug',
    };

    this.writeDebugEntry(entry);
  }

  /**
   * Log an info message
   */
  public info(namespace: string, message: string, data?: unknown): void {
    if (!this.isEnabled) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      namespace,
      message,
      data,
      level: 'info',
    };

    this.writeDebugEntry(entry);
  }

  /**
   * Log a warning message
   */
  public warn(namespace: string, message: string, data?: unknown): void {
    if (!this.isEnabled) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      namespace,
      message,
      data,
      level: 'warn',
    };

    this.writeDebugEntry(entry);
  }

  /**
   * Log an error message
   */
  public error(namespace: string, message: string, error?: Error | unknown): void {
    if (!this.isEnabled) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      namespace,
      message,
      data: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      level: 'error',
    };

    this.writeDebugEntry(entry);
  }

  /**
   * Log a network-related event with detailed connection information
   */
  public logNetwork(
    namespace: string,
    message: string,
    details?: {
      ip?: string;
      port?: number;
      reason?: string;
      retryCount?: number;
      errorCode?: string;
      error?: Error;
      data?: unknown;
    }
  ): void {
    // Always log to main debug log if enabled
    if (this.isEnabled) {
      this.log(namespace, `[NETWORK] ${message}`, details);
    }

    // Also log to network-specific file if network logging is enabled
    if (!this.isNetworkLoggingEnabled) return;

    const entry: NetworkLogEntry = {
      timestamp: new Date(),
      namespace,
      message,
      level: 'info',
      ip: details?.ip,
      port: details?.port,
      reason: details?.reason,
      retryCount: details?.retryCount,
      errorCode: details?.errorCode,
      stackTrace: details?.error?.stack,
      data: details?.data,
    };

    this.writeNetworkEntry(entry);
  }

  /**
   * Log a connection attempt
   */
  public logConnectionAttempt(ip: string, port: number, printerType: string): void {
    this.logNetwork('Connection', `Attempting connection to printer`, {
      ip,
      port,
      data: { printerType },
    });
  }

  /**
   * Log a successful connection
   */
  public logConnectionSuccess(ip: string, port: number, printerName?: string): void {
    this.logNetwork('Connection', `Successfully connected to printer`, {
      ip,
      port,
      data: { printerName },
    });
  }

  /**
   * Log a connection failure
   */
  public logConnectionFailure(ip: string, port: number, reason: string, error?: Error, retryCount?: number): void {
    this.logNetwork('Connection', `Connection failed`, {
      ip,
      port,
      reason,
      error,
      retryCount,
      errorCode: error?.name,
    });
  }

  /**
   * Log a disconnection event
   */
  public logDisconnection(ip: string, reason: string, wasExpected: boolean, error?: Error): void {
    this.logNetwork('Connection', `Disconnected from printer`, {
      ip,
      reason,
      error,
      data: { wasExpected },
    });
  }

  /**
   * Log a polling failure
   */
  public logPollingFailure(ip: string, errorMessage: string, consecutiveFailures: number): void {
    this.logNetwork('Polling', `Polling failed`, {
      ip,
      reason: errorMessage,
      retryCount: consecutiveFailures,
    });
  }

  /**
   * Log when polling is stopped due to exhausted retries
   * This is distinct from a disconnection event - polling stopped due to errors, not network disconnect
   */
  public logPollingStopped(ip: string, maxRetries: number, lastError?: string): void {
    this.logNetwork('Polling', `Polling stopped - max retries (${maxRetries}) exhausted`, {
      ip,
      reason: lastError || 'Max retries reached',
      data: { maxRetries, stoppedAt: new Date().toISOString() },
    });
  }

  /**
   * Log a reconnection attempt
   */
  public logReconnectAttempt(ip: string, attemptNumber: number, maxAttempts: number): void {
    this.logNetwork('Connection', `Reconnection attempt ${attemptNumber}/${maxAttempts}`, {
      ip,
      retryCount: attemptNumber,
      data: { maxAttempts },
    });
  }

  /**
   * List all available debug log files
   */
  public listDebugLogs(): string[] {
    return this.listLogFiles('debug-');
  }

  /**
   * List all available network log files
   */
  public listNetworkLogs(): string[] {
    return this.listLogFiles('network-debug-');
  }

  /**
   * Read the contents of a specific log file
   */
  public readLogFile(filename: string): string | null {
    try {
      const filePath = path.join(this.logsDir, filename);
      if (!fs.existsSync(filePath)) {
        return null;
      }
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error(`[DebugLogService] Failed to read log file ${filename}:`, error);
      return null;
    }
  }

  /**
   * Get the most recent debug log file path
   */
  public getMostRecentDebugLog(): string | null {
    const logs = this.listDebugLogs();
    return logs.length > 0 ? path.join(this.logsDir, logs[0]) : null;
  }

  /**
   * Get the most recent network log file path
   */
  public getMostRecentNetworkLog(): string | null {
    const logs = this.listNetworkLogs();
    return logs.length > 0 ? path.join(this.logsDir, logs[0]) : null;
  }

  /**
   * Flush any buffered log entries to disk
   */
  public flush(): void {
    this.flushDebugBuffer();
    this.flushNetworkBuffer();
  }

  /**
   * Clean up resources and close log files
   */
  public dispose(): void {
    this.endSession();
    DebugLogService.instance = null;
  }

  // Private methods

  private ensureLogsDirExists(): void {
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
    } catch (error) {
      console.error('[DebugLogService] Failed to create logs directory:', error);
    }
  }

  private startSession(): void {
    this.sessionStartTime = new Date();
    const timestamp = this.formatTimestamp(this.sessionStartTime);

    // Create debug log file
    this.debugLogPath = path.join(this.logsDir, `debug-${timestamp}.log`);
    this.debugLogStream = fs.createWriteStream(this.debugLogPath, { flags: 'a' });

    // Write session header
    const header = this.createSessionHeader('Debug Log');
    this.debugLogStream.write(header);

    // Start network log if enabled
    if (this.isNetworkLoggingEnabled) {
      this.startNetworkLog();
    }

    // Start flush timer
    this.startFlushTimer();

    // Cleanup old logs
    this.cleanupOldLogs();

    console.log(`[DebugLogService] Session started - Log file: ${this.debugLogPath}`);
  }

  private startNetworkLog(): void {
    if (!this.sessionStartTime) return;

    const timestamp = this.formatTimestamp(this.sessionStartTime);
    this.networkLogPath = path.join(this.logsDir, `network-debug-${timestamp}.log`);
    this.networkLogStream = fs.createWriteStream(this.networkLogPath, { flags: 'a' });

    const header = this.createSessionHeader('Network Debug Log');
    this.networkLogStream.write(header);

    console.log(`[DebugLogService] Network logging started - Log file: ${this.networkLogPath}`);
  }

  private endSession(): void {
    // Flush remaining entries
    this.flush();

    // Stop flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Write session footer and close streams
    if (this.debugLogStream) {
      const footer = this.createSessionFooter();
      this.debugLogStream.write(footer);
      this.debugLogStream.end();
      this.debugLogStream = null;
    }

    this.closeNetworkLog();

    this.debugLogPath = null;
    this.sessionStartTime = null;

    console.log('[DebugLogService] Session ended');
  }

  private closeNetworkLog(): void {
    if (this.networkLogStream) {
      // Flush any buffered entries before closing
      this.flushNetworkBuffer();
      const footer = this.createSessionFooter();
      this.networkLogStream.write(footer);
      this.networkLogStream.end();
      this.networkLogStream = null;
    }
    this.networkLogPath = null;
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  private createSessionHeader(title: string): string {
    const divider = '='.repeat(80);
    const timestamp = new Date().toISOString();
    const appVersion = app.getVersion();
    const platform = process.platform;

    return [
      divider,
      `${title}`,
      `Session started: ${timestamp}`,
      `FlashForgeUI v${appVersion} - ${platform}`,
      divider,
      '',
    ].join('\n');
  }

  private createSessionFooter(): string {
    const divider = '='.repeat(80);
    const timestamp = new Date().toISOString();

    return ['', divider, `Session ended: ${timestamp}`, divider, ''].join('\n');
  }

  private formatTimestamp(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  }

  private formatLogTimestamp(date: Date): string {
    return date.toISOString();
  }

  private writeDebugEntry(entry: LogEntry): void {
    const line = this.formatLogEntry(entry);
    this.debugBuffer.push(line);

    // Also output to console in development
    if (process.env.NODE_ENV === 'development') {
      console.debug(line.trim());
    }
  }

  private writeNetworkEntry(entry: NetworkLogEntry): void {
    const line = this.formatNetworkEntry(entry);
    this.networkBuffer.push(line);
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = this.formatLogTimestamp(entry.timestamp);
    const level = entry.level.toUpperCase().padEnd(5);
    let line = `[${timestamp}] [${level}] [${entry.namespace}] ${entry.message}`;

    if (entry.data !== undefined) {
      try {
        const dataStr = JSON.stringify(entry.data, null, 2);
        line += `\n  Data: ${dataStr}`;
      } catch {
        line += `\n  Data: [Unable to serialize]`;
      }
    }

    return line + '\n';
  }

  private formatNetworkEntry(entry: NetworkLogEntry): string {
    const timestamp = this.formatLogTimestamp(entry.timestamp);
    const parts: string[] = [`[${timestamp}] [${entry.namespace}] ${entry.message}`];

    if (entry.ip) parts.push(`  IP: ${entry.ip}`);
    if (entry.port) parts.push(`  Port: ${entry.port}`);
    if (entry.reason) parts.push(`  Reason: ${entry.reason}`);
    if (entry.retryCount !== undefined) parts.push(`  Retry Count: ${entry.retryCount}`);
    if (entry.errorCode) parts.push(`  Error Code: ${entry.errorCode}`);
    if (entry.stackTrace) parts.push(`  Stack Trace:\n    ${entry.stackTrace.replace(/\n/g, '\n    ')}`);
    if (entry.data !== undefined) {
      try {
        const dataStr = JSON.stringify(entry.data, null, 2);
        parts.push(`  Additional Data: ${dataStr}`);
      } catch {
        parts.push(`  Additional Data: [Unable to serialize]`);
      }
    }

    return parts.join('\n') + '\n\n';
  }

  private flushDebugBuffer(): void {
    if (this.debugBuffer.length === 0 || !this.debugLogStream) return;

    const content = this.debugBuffer.join('');
    this.debugBuffer = [];

    try {
      this.debugLogStream.write(content);
    } catch (error) {
      console.error('[DebugLogService] Failed to write to debug log:', error);
    }
  }

  private flushNetworkBuffer(): void {
    if (this.networkBuffer.length === 0 || !this.networkLogStream) return;

    const content = this.networkBuffer.join('');
    this.networkBuffer = [];

    try {
      this.networkLogStream.write(content);
    } catch (error) {
      console.error('[DebugLogService] Failed to write to network log:', error);
    }
  }

  private listLogFiles(prefix: string): string[] {
    try {
      const files = fs.readdirSync(this.logsDir);
      return files.filter((f) => f.startsWith(prefix) && f.endsWith('.log')).sort((a, b) => b.localeCompare(a)); // Most recent first
    } catch {
      return [];
    }
  }

  private cleanupOldLogs(): void {
    try {
      // Cleanup debug logs
      const debugLogs = this.listDebugLogs();
      if (debugLogs.length > this.maxLogFiles) {
        const toDelete = debugLogs.slice(this.maxLogFiles);
        for (const file of toDelete) {
          fs.unlinkSync(path.join(this.logsDir, file));
          console.log(`[DebugLogService] Deleted old debug log: ${file}`);
        }
      }

      // Cleanup network logs
      const networkLogs = this.listNetworkLogs();
      if (networkLogs.length > this.maxLogFiles) {
        const toDelete = networkLogs.slice(this.maxLogFiles);
        for (const file of toDelete) {
          fs.unlinkSync(path.join(this.logsDir, file));
          console.log(`[DebugLogService] Deleted old network log: ${file}`);
        }
      }
    } catch (error) {
      console.error('[DebugLogService] Failed to cleanup old logs:', error);
    }
  }
}

/**
 * Get the singleton DebugLogService instance
 */
export function getDebugLogService(): DebugLogService {
  return DebugLogService.getInstance();
}
