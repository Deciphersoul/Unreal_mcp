/**
 * Command queue utilities for throttling and queueing commands to Unreal Engine
 * Prevents rapid command execution that can overwhelm the engine
 */

import { Logger } from './logger.js';

/**
 * Command queue item interface
 */
export interface CommandQueueItem {
  command: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  priority: number;
  retryCount?: number;
}

/**
 * Command queue configuration
 */
export interface CommandQueueConfig {
  minCommandDelay?: number;
  maxCommandDelay?: number;
  statCommandDelay?: number;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Default command queue configuration
 */
export const DEFAULT_QUEUE_CONFIG: Required<CommandQueueConfig> = {
  minCommandDelay: 100,    // Increased to prevent console spam
  maxCommandDelay: 500,    // Maximum delay for heavy operations
  statCommandDelay: 300,   // Special delay for stat commands to avoid warnings
  maxRetries: 3,
  retryDelay: 500
};

/**
 * Command queue manager for throttling commands to Unreal Engine
 */
export class CommandQueue {
  private queue: CommandQueueItem[] = [];
  private isProcessing = false;
  private lastCommandTime = 0;
  private lastStatCommandTime = 0;
  private config: Required<CommandQueueConfig>;
  private log: Logger;
  private processingInterval?: NodeJS.Timeout;

  constructor(config: CommandQueueConfig = {}, logger?: Logger) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
    this.log = logger || new Logger('CommandQueue');
  }

  /**
   * Add a command to the queue and execute when ready
   */
  async enqueue<T>(command: () => Promise<T>, priority: number = 5): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        command,
        resolve,
        reject,
        priority
      });
      
      // Sort by priority (lower number = higher priority)
      this.queue.sort((a, b) => a.priority - b.priority);
      
      // Process queue if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the command queue with appropriate delays
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;
      
      // Calculate delay based on time since last command
      const timeSinceLastCommand = Date.now() - this.lastCommandTime;
      const requiredDelay = this.calculateDelay(item.priority);
      
      if (timeSinceLastCommand < requiredDelay) {
        await this.delay(requiredDelay - timeSinceLastCommand);
      }
      
      try {
        const result = await item.command();
        item.resolve(result);
      } catch (error: any) {
        // Retry logic for transient failures
        const msg = (error?.message || String(error)).toLowerCase();
        const notConnected = msg.includes('not connected to unreal');
        if (item.retryCount === undefined) {
          item.retryCount = 0;
        }
        
        if (!notConnected && item.retryCount < this.config.maxRetries) {
          item.retryCount++;
          this.log.warn(`Command failed, retrying (${item.retryCount}/${this.config.maxRetries})`);
          
          // Re-add to queue with increased priority
          this.queue.unshift({
            command: item.command,
            resolve: item.resolve,
            reject: item.reject,
            priority: Math.max(1, item.priority - 1),
            retryCount: item.retryCount
          });
          
          // Add extra delay before retry
          await this.delay(this.config.retryDelay);
        } else {
          item.reject(error);
        }
      }
      
      this.lastCommandTime = Date.now();
    }
    
    this.isProcessing = false;
  }

  /**
   * Calculate appropriate delay based on command priority and type
   */
  private calculateDelay(priority: number): number {
    // Priority 1-3: Heavy operations (asset creation, lighting build)
    if (priority <= 3) {
      return this.config.maxCommandDelay;
    }
    // Priority 4-6: Medium operations (actor spawning, material changes)
    else if (priority <= 6) {
      return 200;
    }
    // Priority 8: Stat commands - need special handling
    else if (priority === 8) {
      // Check time since last stat command to avoid FindConsoleObject warnings
      const timeSinceLastStat = Date.now() - this.lastStatCommandTime;
      if (timeSinceLastStat < this.config.statCommandDelay) {
        return this.config.statCommandDelay;
      }
      this.lastStatCommandTime = Date.now();
      return 150;
    }
    // Priority 7,9-10: Light operations (console commands, queries)
    else {
      // For light operations, add some jitter to prevent thundering herd
      const baseDelay = this.config.minCommandDelay;
      const jitter = Math.random() * 50; // Add up to 50ms random jitter
      return baseDelay + jitter;
    }
  }

  /**
   * Start periodic queue processing to handle stuck commands
   */
  startPeriodicProcessing(intervalMs: number = 1000): void {
    if (this.processingInterval) {
      return;
    }
    this.processingInterval = setInterval(() => {
      if (!this.isProcessing && this.queue.length > 0) {
        this.processQueue();
      }
    }, intervalMs);
  }

  /**
   * Stop periodic queue processing
   */
  stopPeriodicProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
  }

  /**
   * Get the current queue length
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * Check if the queue is currently processing
   */
  get processing(): boolean {
    return this.isProcessing;
  }

  /**
   * Clear the queue (rejects all pending commands)
   */
  clear(reason: string = 'Queue cleared'): void {
    const items = [...this.queue];
    this.queue = [];
    for (const item of items) {
      item.reject(new Error(reason));
    }
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Priority levels for commands
 */
export const CommandPriority = {
  CRITICAL: 1,      // Must execute immediately (lighting build, asset creation)
  HIGH: 3,          // Important operations
  MEDIUM: 5,        // Normal operations (actor spawning)
  NORMAL: 7,        // Default priority
  STAT: 8,          // Stat commands with special handling
  LOW: 9,           // Low priority operations
  BACKGROUND: 10    // Background tasks
} as const;

export type CommandPriorityLevel = typeof CommandPriority[keyof typeof CommandPriority];
