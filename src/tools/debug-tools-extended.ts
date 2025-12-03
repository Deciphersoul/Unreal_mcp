/**
 * Extended Debug Tools for UE MCP
 * Provides error watching, enhanced log access, and debugging utilities
 */

import { UnrealBridge } from '../unreal-bridge.js';
import { loadEnv } from '../types/env.js';
import { Logger } from '../utils/logger.js';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export interface LogEntry {
  timestamp?: string;
  frame?: string;
  category?: string;
  severity: 'Log' | 'Warning' | 'Error' | 'Fatal' | 'Display';
  message: string;
  raw: string;
}

export interface ErrorWatchEvent {
  type: 'error' | 'warning';
  entry: LogEntry;
  context: LogEntry[]; // Surrounding lines for context
}

export class DebugToolsExtended extends EventEmitter {
  private env = loadEnv();
  private log = new Logger('DebugToolsExtended');
  private cachedLogPath?: string;
  private lastReadPosition: number = 0;
  private lastErrorCheckPosition: number = 0;
  private errorWatchInterval?: NodeJS.Timeout;
  private isWatching: boolean = false;
  private recentErrors: LogEntry[] = [];
  private maxRecentErrors: number = 50;

  constructor(private bridge: UnrealBridge) {
    super();
  }

  /**
   * Get the project log file path
   */
  private async getLogPath(): Promise<string | undefined> {
    if (this.cachedLogPath) {
      try {
        await fs.access(this.cachedLogPath);
        return this.cachedLogPath;
      } catch {
        this.cachedLogPath = undefined;
      }
    }

    const projectPath = this.env.UE_PROJECT_PATH;
    if (projectPath) {
      // Handle both .uproject file path and directory path
      const projectDir = projectPath.endsWith('.uproject') 
        ? path.dirname(projectPath) 
        : projectPath;
      
      const logsDir = path.join(projectDir, 'Saved', 'Logs');
      
      try {
        const files = await fs.readdir(logsDir);
        const logFiles = files.filter(f => f.endsWith('.log') && !f.includes('backup'));
        
        if (logFiles.length > 0) {
          // Get the most recently modified log file
          let newestFile = logFiles[0];
          let newestTime = 0;
          
          for (const file of logFiles) {
            const filePath = path.join(logsDir, file);
            const stat = await fs.stat(filePath);
            if (stat.mtimeMs > newestTime) {
              newestTime = stat.mtimeMs;
              newestFile = file;
            }
          }
          
          this.cachedLogPath = path.join(logsDir, newestFile);
          return this.cachedLogPath;
        }
      } catch (err) {
        this.log.debug('Failed to find log file:', err);
      }
    }

    return undefined;
  }

  /**
   * Parse a single UE log line
   * Format: [2025.12.02-00.05.31:024][298]LogCategory: Severity: Message
   */
  private parseLine(line: string): LogEntry | null {
    // Pattern for UE log format
    const pattern = /^\[(\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2}:\d+)\]\s*\[(\d+)\]\s*(\w+):\s*(?:(Error|Warning|Display|Fatal|Log|Verbose|VeryVerbose):\s*)?(.*)$/;
    const match = line.match(pattern);
    
    if (match) {
      const [, timestamp, frame, category, severityMatch, message] = match;
      let severity: LogEntry['severity'] = 'Log';
      
      if (severityMatch) {
        severity = severityMatch as LogEntry['severity'];
      } else if (message.toLowerCase().startsWith('error')) {
        severity = 'Error';
      } else if (message.toLowerCase().startsWith('warning')) {
        severity = 'Warning';
      }
      
      return {
        timestamp,
        frame,
        category,
        severity,
        message: message.trim(),
        raw: line
      };
    }

    // Fallback for continuation lines or different formats
    const simplePattern = /^(\w+):\s*(?:(Error|Warning|Display):\s*)?(.*)$/;
    const simpleMatch = line.match(simplePattern);
    
    if (simpleMatch) {
      const [, category, severityMatch, message] = simpleMatch;
      return {
        category,
        severity: (severityMatch as LogEntry['severity']) || 'Log',
        message: message.trim(),
        raw: line
      };
    }

    // Return as plain message if no pattern matches
    if (line.trim()) {
      return {
        severity: 'Log',
        message: line.trim(),
        raw: line
      };
    }

    return null;
  }

  /**
   * Read the last N lines from the log file efficiently
   */
  private async tailLog(maxLines: number = 100): Promise<LogEntry[]> {
    const logPath = await this.getLogPath();
    if (!logPath) {
      return [];
    }

    try {
      const handle = await fs.open(logPath, 'r');
      try {
        const stat = await handle.stat();
        const chunkSize = 128 * 1024; // 128KB chunks
        let position = stat.size;
        let remaining = '';
        const lines: string[] = [];

        while (position > 0 && lines.length < maxLines) {
          const readSize = Math.min(chunkSize, position);
          position -= readSize;
          const buf = Buffer.alloc(readSize);
          await handle.read(buf, 0, readSize, position);
          remaining = buf.toString('utf8') + remaining;
          
          const parts = remaining.split(/\r?\n/);
          remaining = parts.shift() || '';
          
          while (parts.length && lines.length < maxLines) {
            const line = parts.pop();
            if (line && line.trim()) {
              lines.unshift(line);
            }
          }
        }

        if (lines.length < maxLines && remaining.trim()) {
          lines.unshift(remaining);
        }

        return lines
          .map(line => this.parseLine(line))
          .filter((entry): entry is LogEntry => entry !== null);
      } finally {
        await handle.close();
      }
    } catch (err) {
      this.log.error('Failed to tail log:', err);
      return [];
    }
  }

  /**
   * Get recent log entries with filtering options
   */
  async getLogs(params: {
    lines?: number;
    category?: string;
    severity?: 'all' | 'errors' | 'warnings' | 'errors_and_warnings';
    search?: string;
    since?: string;
  } = {}): Promise<{
    success: boolean;
    entries: LogEntry[];
    logPath?: string;
    totalCount: number;
    filteredCount: number;
    error?: string;
  }> {
    const maxLines = params.lines || 100;
    const entries = await this.tailLog(maxLines * 2); // Read extra for filtering
    const logPath = await this.getLogPath();

    let filtered = entries;

    // Filter by category
    if (params.category) {
      const cat = params.category.toLowerCase();
      filtered = filtered.filter(e => e.category?.toLowerCase().includes(cat));
    }

    // Filter by severity
    if (params.severity && params.severity !== 'all') {
      switch (params.severity) {
        case 'errors':
          filtered = filtered.filter(e => e.severity === 'Error' || e.severity === 'Fatal');
          break;
        case 'warnings':
          filtered = filtered.filter(e => e.severity === 'Warning');
          break;
        case 'errors_and_warnings':
          filtered = filtered.filter(e => 
            e.severity === 'Error' || 
            e.severity === 'Fatal' || 
            e.severity === 'Warning'
          );
          break;
      }
    }

    // Filter by search term
    if (params.search) {
      const searchLower = params.search.toLowerCase();
      filtered = filtered.filter(e => 
        e.message.toLowerCase().includes(searchLower) ||
        e.category?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by timestamp
    if (params.since) {
      filtered = filtered.filter(e => {
        if (!e.timestamp) return false;
        return e.timestamp >= params.since!;
      });
    }

    // Limit results
    const result = filtered.slice(-maxLines);

    return {
      success: true,
      entries: result,
      logPath: logPath?.replace(/\\/g, '/'),
      totalCount: entries.length,
      filteredCount: result.length
    };
  }

  /**
   * Get only error entries
   */
  async getErrors(lines: number = 50): Promise<{
    success: boolean;
    errors: LogEntry[];
    count: number;
  }> {
    const result = await this.getLogs({ lines: lines * 3, severity: 'errors' });
    return {
      success: true,
      errors: result.entries.slice(-lines),
      count: result.entries.length
    };
  }

  /**
   * Get only warning entries  
   */
  async getWarnings(lines: number = 50): Promise<{
    success: boolean;
    warnings: LogEntry[];
    count: number;
  }> {
    const result = await this.getLogs({ lines: lines * 3, severity: 'warnings' });
    return {
      success: true,
      warnings: result.entries.slice(-lines),
      count: result.entries.length
    };
  }

  /**
   * Start watching for new errors in the log
   * Polls the log file and emits 'error' events when new errors are found
   */
  async startErrorWatch(intervalMs: number = 2000): Promise<{
    success: boolean;
    message: string;
  }> {
    if (this.isWatching) {
      return { success: true, message: 'Error watching already active' };
    }

    const logPath = await this.getLogPath();
    if (!logPath) {
      return { success: false, message: 'Log file not found' };
    }

    // Get current file size as starting point
    try {
      const stat = await fs.stat(logPath);
      this.lastErrorCheckPosition = stat.size;
    } catch {
      this.lastErrorCheckPosition = 0;
    }

    this.isWatching = true;
    this.log.info('Starting error watch on:', logPath);

    this.errorWatchInterval = setInterval(async () => {
      await this.checkForNewErrors();
    }, intervalMs);

    return { success: true, message: `Error watching started (checking every ${intervalMs}ms)` };
  }

  /**
   * Stop watching for errors
   */
  stopErrorWatch(): { success: boolean; message: string } {
    if (this.errorWatchInterval) {
      clearInterval(this.errorWatchInterval);
      this.errorWatchInterval = undefined;
    }
    this.isWatching = false;
    this.log.info('Error watching stopped');
    return { success: true, message: 'Error watching stopped' };
  }

  /**
   * Check for new errors since last check
   */
  private async checkForNewErrors(): Promise<void> {
    const logPath = await this.getLogPath();
    if (!logPath) return;

    try {
      const stat = await fs.stat(logPath);
      if (stat.size <= this.lastErrorCheckPosition) {
        // File hasn't grown or was truncated
        if (stat.size < this.lastErrorCheckPosition) {
          // File was truncated (new session), reset position
          this.lastErrorCheckPosition = 0;
        }
        return;
      }

      // Read new content
      const handle = await fs.open(logPath, 'r');
      try {
        const newSize = stat.size - this.lastErrorCheckPosition;
        const buffer = Buffer.alloc(newSize);
        await handle.read(buffer, 0, newSize, this.lastErrorCheckPosition);
        this.lastErrorCheckPosition = stat.size;

        const newContent = buffer.toString('utf8');
        const lines = newContent.split(/\r?\n/);

        for (const line of lines) {
          const entry = this.parseLine(line);
          if (entry && (entry.severity === 'Error' || entry.severity === 'Fatal')) {
            // Store in recent errors
            this.recentErrors.push(entry);
            if (this.recentErrors.length > this.maxRecentErrors) {
              this.recentErrors.shift();
            }

            // Emit error event
            this.emit('error', {
              type: 'error',
              entry,
              context: [] // Could add surrounding lines here
            } as ErrorWatchEvent);

            this.log.warn('New error detected:', entry.message);
          }
        }
      } finally {
        await handle.close();
      }
    } catch (err) {
      this.log.debug('Error checking for new errors:', err);
    }
  }

  /**
   * Get errors detected since watching started
   */
  getRecentWatchedErrors(): {
    success: boolean;
    errors: LogEntry[];
    count: number;
    isWatching: boolean;
  } {
    return {
      success: true,
      errors: [...this.recentErrors],
      count: this.recentErrors.length,
      isWatching: this.isWatching
    };
  }

  /**
   * Clear the recent errors buffer
   */
  clearRecentErrors(): { success: boolean; message: string } {
    const count = this.recentErrors.length;
    this.recentErrors = [];
    return { success: true, message: `Cleared ${count} recent errors` };
  }

  /**
   * Check if error watching is active
   */
  isErrorWatchActive(): boolean {
    return this.isWatching;
  }

  /**
   * Get connection status with UE
   * Makes actual HTTP call to verify connectivity, not just cached flag
   */
  async checkConnection(): Promise<{
    success: boolean;
    connected: boolean;
    message: string;
    details?: {
      host: string;
      httpPort: number;
      wsPort: number;
      responseTimeMs?: number;
      engineInfo?: any;
    };
  }> {
    const startTime = Date.now();
    const details = {
      host: this.env.UE_HOST,
      httpPort: this.env.UE_RC_HTTP_PORT,
      wsPort: this.env.UE_RC_WS_PORT,
      responseTimeMs: 0,
      engineInfo: undefined as any
    };

    try {
      // Make actual HTTP call to /remote/info endpoint
      const response = await fetch(
        `http://${this.env.UE_HOST}:${this.env.UE_RC_HTTP_PORT}/remote/info`,
        { 
          method: 'GET',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        }
      );
      
      details.responseTimeMs = Date.now() - startTime;
      
      if (response.ok) {
        try {
          details.engineInfo = await response.json();
        } catch {
          // Response OK but not JSON - still connected
        }
        
        return {
          success: true,
          connected: true,
          message: `Connected to Unreal Engine (${details.responseTimeMs}ms)`,
          details
        };
      } else {
        return {
          success: true,
          connected: false,
          message: `Unreal Engine responded with status ${response.status}`,
          details
        };
      }
    } catch (error: any) {
      details.responseTimeMs = Date.now() - startTime;
      
      // Determine specific error type
      let message = 'Not connected to Unreal Engine';
      if (error.code === 'ECONNREFUSED') {
        message = `Connection refused - Unreal Engine not running or Remote Control not enabled (${this.env.UE_HOST}:${this.env.UE_RC_HTTP_PORT})`;
      } else if (error.name === 'TimeoutError' || error.code === 'UND_ERR_CONNECT_TIMEOUT') {
        message = `Connection timeout after 5s - Unreal Engine may be unresponsive`;
      } else if (error.code === 'ENOTFOUND') {
        message = `Host not found: ${this.env.UE_HOST}`;
      }
      
      return {
        success: true,
        connected: false,
        message,
        details
      };
    }
  }
}
