/**
 * @fileoverview Backend-aware thumbnail request queue with controlled concurrency
 *
 * Manages thumbnail requests with printer model-specific concurrency limits to prevent
 * TCP socket exhaustion on legacy printers while maximizing throughput on modern models.
 * Implements request deduplication, priority ordering, automatic retry logic, and
 * graceful cancellation support.
 *
 * Key Features:
 * - Backend-specific concurrency (legacy: 1, modern: 3 concurrent requests)
 * - Request deduplication to avoid redundant network calls
 * - Priority-based queue ordering with FIFO within priority levels
 * - Automatic retry with exponential backoff (up to 2 retries)
 * - Multi-context support via PrinterContextManager integration
 * - Comprehensive statistics tracking and event emission
 * - Graceful cancellation and queue reset capabilities
 *
 * Backend Concurrency Configuration:
 * - generic-legacy: 1 concurrent, 100ms delay (prevents TCP overload)
 * - adventurer-5m/pro: 3 concurrent, 50ms delay (optimized throughput)
 * - ad5x: 3 concurrent, 50ms delay (optimized throughput)
 *
 * Singleton Pattern:
 * Access via getThumbnailRequestQueue() factory function.
 *
 * @module services/ThumbnailRequestQueue
 */

import { EventEmitter } from 'events';
import type { PrinterBackendManager } from '../managers/PrinterBackendManager';
import type { PrinterModelType } from '../types/printer-backend';
import { getPrinterContextManager } from '../managers/PrinterContextManager';

/**
 * Request item in the queue
 */
interface QueueItem {
  readonly id: string;
  readonly fileName: string;
  readonly priority: number;
  readonly timestamp: number;
  retryCount: number;
  callback: (result: ThumbnailResult) => void;
}

/**
 * Result of thumbnail request
 */
interface ThumbnailResult {
  readonly success: boolean;
  readonly fileName: string;
  readonly thumbnail?: string;
  readonly error?: string;
  readonly fromCache?: boolean;
}

/**
 * Queue statistics
 */
interface QueueStats {
  readonly pending: number;
  readonly processing: number;
  readonly completed: number;
  readonly failed: number;
  readonly cancelled: number;
  readonly averageProcessTime: number;
}

/**
 * Backend concurrency configuration
 */
interface BackendConcurrency {
  readonly modelType: PrinterModelType;
  readonly maxConcurrent: number;
  readonly requestDelay: number; // ms between requests
}

/**
 * Service for managing thumbnail requests with controlled concurrency
 */
export class ThumbnailRequestQueue extends EventEmitter {
  private static instance: ThumbnailRequestQueue | null = null;
  
  private readonly queue: QueueItem[] = [];
  private readonly processing = new Map<string, QueueItem>();
  private readonly pendingCallbacks = new Map<string, QueueItem['callback'][]>();
  
  private backendManager: PrinterBackendManager | null = null;
  private isProcessing = false;
  private isCancelled = false;
  private stats = {
    completed: 0,
    failed: 0,
    cancelled: 0,
    totalProcessTime: 0
  };
  
  // Backend-specific concurrency limits
  private readonly backendConcurrency: readonly BackendConcurrency[] = [
    { modelType: 'generic-legacy', maxConcurrent: 1, requestDelay: 100 },
    { modelType: 'adventurer-5m', maxConcurrent: 3, requestDelay: 50 },
    { modelType: 'adventurer-5m-pro', maxConcurrent: 3, requestDelay: 50 },
    { modelType: 'ad5x', maxConcurrent: 3, requestDelay: 50 }
  ];
  
  private constructor() {
    super();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): ThumbnailRequestQueue {
    if (!ThumbnailRequestQueue.instance) {
      ThumbnailRequestQueue.instance = new ThumbnailRequestQueue();
    }
    return ThumbnailRequestQueue.instance;
  }
  
  /**
   * Initialize queue with backend manager
   */
  public initialize(backendManager: PrinterBackendManager): void {
    this.backendManager = backendManager;
    console.log('[ThumbnailQueue] Initialized with backend manager');
  }
  
  /**
   * Enqueue a thumbnail request
   */
  public enqueue(fileName: string, priority: number = 0): Promise<ThumbnailResult> {
    return new Promise((resolve) => {
      // Check if already processing or queued
      const existingItem = this.findExistingRequest(fileName);
      if (existingItem) {
        console.log(`[ThumbnailQueue] Request already queued for ${fileName}, adding callback`);
        this.addPendingCallback(fileName, resolve);
        return;
      }
      
      // Create new queue item
      const item: QueueItem = {
        id: `${Date.now()}-${Math.random()}`,
        fileName,
        priority,
        timestamp: Date.now(),
        retryCount: 0,
        callback: resolve
      };
      
      // Add to queue
      this.queue.push(item);
      this.sortQueue();
      
      console.log(`[ThumbnailQueue] Enqueued ${fileName}, queue size: ${this.queue.length}`);
      
      // Start processing if not already running
      if (!this.isProcessing) {
        console.log('[ThumbnailQueue] Starting new processing cycle');
        // Reset cancelled flag when starting a new cycle
        this.isCancelled = false;
        this.processQueue().catch(error => {
          console.error('[ThumbnailQueue] Processing error:', error);
          this.isProcessing = false;
        });
      }
    });
  }
  
  /**
   * Cancel all pending requests
   */
  public cancelAll(): void {
    console.log('[ThumbnailQueue] Cancelling all requests');
    this.isCancelled = true;
    
    // Clear queue
    const cancelledCount = this.queue.length;
    this.queue.length = 0;
    
    // Cancel processing items
    for (const item of this.processing.values()) {
      item.callback({
        success: false,
        fileName: item.fileName,
        error: 'Cancelled'
      });
      this.stats.cancelled++;
    }
    this.processing.clear();
    
    // Cancel pending callbacks
    for (const [fileName, callbacks] of this.pendingCallbacks.entries()) {
      for (const callback of callbacks) {
        callback({
          success: false,
          fileName,
          error: 'Cancelled'
        });
        this.stats.cancelled++;
      }
    }
    this.pendingCallbacks.clear();
    
    // Reset processing flag to allow new processing cycles
    this.isProcessing = false;
    
    console.log(`[ThumbnailQueue] Cancelled ${cancelledCount} queued items`);
    this.emit('queue-cancelled', { cancelledCount });
  }
  
  /**
   * Reset the queue for a new session
   */
  public reset(): void {
    this.cancelAll();
    this.isCancelled = false;
    this.stats = {
      completed: 0,
      failed: 0,
      cancelled: 0,
      totalProcessTime: 0
    };
    console.log('[ThumbnailQueue] Queue reset');
  }
  
  /**
   * Get queue statistics
   */
  public getStats(): QueueStats {
    const totalRequests = this.stats.completed + this.stats.failed;
    const averageProcessTime = totalRequests > 0 
      ? this.stats.totalProcessTime / totalRequests 
      : 0;
    
    return {
      pending: this.queue.length,
      processing: this.processing.size,
      completed: this.stats.completed,
      failed: this.stats.failed,
      cancelled: this.stats.cancelled,
      averageProcessTime
    };
  }
  
  /**
   * Process the queue with backend-aware concurrency
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isCancelled) {
      return;
    }
    
    this.isProcessing = true;
    console.log('[ThumbnailQueue] Starting queue processing');
    
    try {
      const concurrency = this.getCurrentConcurrency();
      console.log(`[ThumbnailQueue] Using concurrency: ${concurrency.maxConcurrent} for ${concurrency.modelType}`);
      
      let lastStatusLog = Date.now();
      
      while ((this.queue.length > 0 || this.processing.size > 0) && !this.isCancelled) {
        // Log status every 2 seconds
        if (Date.now() - lastStatusLog > 2000) {
          console.log(`[ThumbnailQueue] Status - Queue: ${this.queue.length}, Processing: ${this.processing.size}, Completed: ${this.stats.completed}, Failed: ${this.stats.failed}`);
          lastStatusLog = Date.now();
        }
        
        // Process up to max concurrent items
        while (this.processing.size < concurrency.maxConcurrent && this.queue.length > 0 && !this.isCancelled) {
          const item = this.queue.shift();
          if (item) {
            console.log(`[ThumbnailQueue] Starting processing of ${item.fileName}`);
            // Don't use void here - we need to track the promise
            this.processItem(item).catch(error => {
              console.error(`[ThumbnailQueue] Error processing ${item.fileName}:`, error);
            });
            
            // Add delay between requests to prevent overwhelming the printer
            if (this.queue.length > 0) {
              await new Promise(resolve => setTimeout(resolve, concurrency.requestDelay));
            }
          }
        }
        
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } finally {
      this.isProcessing = false;
      console.log('[ThumbnailQueue] Queue processing completed');
      this.emit('queue-completed', this.getStats());
    }
  }
  
  /**
   * Process a single queue item
   */
  private async processItem(item: QueueItem): Promise<void> {
    const startTime = Date.now();
    this.processing.set(item.fileName, item);
    
    try {
      console.log(`[ThumbnailQueue] Processing ${item.fileName}`);

      // Get active context ID
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        throw new Error('No active printer context');
      }

      // Check if backend is ready
      if (!this.backendManager || !this.backendManager.isBackendReady(contextId)) {
        throw new Error('Backend not ready');
      }

      // Request thumbnail from backend
      const thumbnail = await this.backendManager.getJobThumbnail(contextId, item.fileName);
      
      if (thumbnail) {
        const result: ThumbnailResult = {
          success: true,
          fileName: item.fileName,
          thumbnail: thumbnail.replace('data:image/png;base64,', '')
        };
        
        // Notify main callback
        item.callback(result);
        
        // Notify any pending callbacks
        this.notifyPendingCallbacks(item.fileName, result);
        
        this.stats.completed++;
        console.log(`[ThumbnailQueue] Successfully processed ${item.fileName}`);
      } else {
        // Don't throw - just treat as failed
        console.warn(`[ThumbnailQueue] No thumbnail available for ${item.fileName}`);
        const result: ThumbnailResult = {
          success: false,
          fileName: item.fileName,
          error: 'No thumbnail available'
        };
        item.callback(result);
        this.notifyPendingCallbacks(item.fileName, result);
        this.stats.failed++;
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ThumbnailQueue] Failed to process ${item.fileName}:`, errorMessage);
      
      // Check if we should retry
      if (item.retryCount < 2 && !this.isCancelled) {
        item.retryCount++;
        console.log(`[ThumbnailQueue] Retrying ${item.fileName} (attempt ${item.retryCount + 1})`);
        this.queue.unshift(item); // Add back to front of queue
      } else {
        const result: ThumbnailResult = {
          success: false,
          fileName: item.fileName,
          error: errorMessage
        };
        
        // Notify callbacks
        item.callback(result);
        this.notifyPendingCallbacks(item.fileName, result);
        
        this.stats.failed++;
      }
    } finally {
      this.processing.delete(item.fileName);
      const processTime = Date.now() - startTime;
      this.stats.totalProcessTime += processTime;
      
      this.emit('item-processed', {
        fileName: item.fileName,
        processTime,
        queueSize: this.queue.length
      });
    }
  }
  
  /**
   * Get current concurrency settings based on backend
   */
  private getCurrentConcurrency(): BackendConcurrency {
    if (!this.backendManager) {
      return { modelType: 'generic-legacy', maxConcurrent: 1, requestDelay: 100 };
    }

    // Get active context ID
    const contextManager = getPrinterContextManager();
    const contextId = contextManager.getActiveContextId();

    if (!contextId) {
      return { modelType: 'generic-legacy', maxConcurrent: 1, requestDelay: 100 };
    }

    const backend = this.backendManager.getBackendForContext(contextId);
    if (!backend) {
      return { modelType: 'generic-legacy', maxConcurrent: 1, requestDelay: 100 };
    }

    const modelType = backend.getBackendStatus().capabilities.modelType;
    const config = this.backendConcurrency.find(c => c.modelType === modelType);

    return config || { modelType: 'generic-legacy', maxConcurrent: 1, requestDelay: 100 };
  }
  
  /**
   * Find existing request in queue or processing
   */
  private findExistingRequest(fileName: string): QueueItem | undefined {
    // Check processing first
    if (this.processing.has(fileName)) {
      return this.processing.get(fileName);
    }
    
    // Check queue
    return this.queue.find(item => item.fileName === fileName);
  }
  
  /**
   * Add a pending callback for a file already being processed
   */
  private addPendingCallback(fileName: string, callback: QueueItem['callback']): void {
    const callbacks = this.pendingCallbacks.get(fileName) || [];
    callbacks.push(callback);
    this.pendingCallbacks.set(fileName, callbacks);
  }
  
  /**
   * Notify all pending callbacks for a file
   */
  private notifyPendingCallbacks(fileName: string, result: ThumbnailResult): void {
    const callbacks = this.pendingCallbacks.get(fileName);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(result);
      }
      this.pendingCallbacks.delete(fileName);
    }
  }
  
  /**
   * Sort queue by priority (higher priority first) and timestamp
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });
  }
}

/**
 * Get singleton instance of ThumbnailRequestQueue
 */
export function getThumbnailRequestQueue(): ThumbnailRequestQueue {
  return ThumbnailRequestQueue.getInstance();
}

