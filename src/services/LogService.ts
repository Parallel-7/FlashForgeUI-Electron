/**
 * @fileoverview Centralized Log Service
 * 
 * This service provides centralized log message storage and management for the application.
 * It stores log messages in memory and provides APIs for:
 * - Adding new log messages
 * - Retrieving all stored messages
 * - Clearing log messages
 * - Broadcasting new messages to interested parties (like the log dialog)
 * 
 * The service uses the EventEmitter pattern to notify subscribers of new log messages,
 * allowing for real-time updates in the log dialog window.
 * 
 * Key features:
 * - Memory-based log storage with configurable maximum entries
 * - Real-time message broadcasting via EventEmitter
 * - Timestamp management for log entries
 * - Thread-safe operations for concurrent access
 * 
 * Usage:
 *   const logService = LogService.getInstance();
 *   logService.addMessage('Application started');
 *   const messages = logService.getMessages();
 */

import { EventEmitter } from 'events';

export interface LogMessage {
  readonly timestamp: string;
  readonly message: string;
}

export class LogService extends EventEmitter {
  private static instance: LogService | null = null;
  
  private readonly messages: LogMessage[] = [];
  private readonly maxMessages: number = 1000; // Limit memory usage
  
  private constructor() {
    super();
    console.log('LogService: Initialized');
  }
  
  /**
   * Get the singleton instance of LogService
   */
  public static getInstance(): LogService {
    if (!LogService.instance) {
      LogService.instance = new LogService();
    }
    return LogService.instance;
  }
  
  /**
   * Add a new log message
   * @param message - The message to log
   */
  public addMessage(message: string): void {
    try {
      const logMessage: LogMessage = {
        timestamp: new Date().toLocaleTimeString(),
        message: message
      };
      
      // Add to storage
      this.messages.push(logMessage);
      
      // Maintain maximum message limit
      if (this.messages.length > this.maxMessages) {
        this.messages.shift(); // Remove oldest message
      }
      
      // Emit event for real-time updates
      this.emit('message-added', logMessage);
      
      // Also log to console for development
      console.log(`[LogService] ${logMessage.timestamp} ${message}`);
    } catch (error) {
      console.error('LogService: Failed to add message:', error);
    }
  }
  
  /**
   * Get all stored log messages
   * @returns Array of log messages in chronological order
   */
  public getMessages(): LogMessage[] {
    return [...this.messages]; // Return copy to prevent external modification
  }
  
  /**
   * Clear all stored log messages
   */
  public clearMessages(): void {
    try {
      this.messages.length = 0; // Clear array efficiently
      this.emit('messages-cleared');
      console.log('LogService: All messages cleared');
    } catch (error) {
      console.error('LogService: Failed to clear messages:', error);
    }
  }
  
  /**
   * Get the current number of stored messages
   * @returns Number of messages currently stored
   */
  public getMessageCount(): number {
    return this.messages.length;
  }
  
  /**
   * Get the maximum number of messages that can be stored
   * @returns Maximum message limit
   */
  public getMaxMessages(): number {
    return this.maxMessages;
  }
  
  /**
   * Clean up resources and remove all listeners
   */
  public dispose(): void {
    this.removeAllListeners();
    this.messages.length = 0;
    console.log('LogService: Disposed');
  }
}

/**
 * Get the singleton LogService instance
 * @returns LogService instance
 */
export function getLogService(): LogService {
  return LogService.getInstance();
}
